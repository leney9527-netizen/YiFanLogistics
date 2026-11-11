import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const CAPTCHA_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CAPTCHA_LENGTH = 5;
export const CAPTCHA_TTL_MS = 5 * 60 * 1000;

export type CaptchaPurpose = "login" | "register";

export type CaptchaRecord = {
  id: string;
  purpose: CaptchaPurpose;
  sessionHash: string;
  answerHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

export interface CaptchaStore {
  insert(record: CaptchaRecord): Promise<void>;
  invalidateOpen(sessionHash: string, purpose: CaptchaPurpose): Promise<void>;
  consumeIfOpen(id: string, now: Date): Promise<CaptchaRecord | null>;
}

export function normalizeCaptchaAnswer(answer: string): string {
  return answer.trim().toUpperCase().replace(/\s+/g, "");
}

export function hashCaptchaAnswer(answer: string, pepper: string): string {
  return createHmac("sha256", pepper).update(normalizeCaptchaAnswer(answer)).digest("hex");
}

export function createCaptchaAnswer(): string {
  let value = "";
  for (let index = 0; index < CAPTCHA_LENGTH; index += 1) {
    value += CAPTCHA_ALPHABET[randomInt(CAPTCHA_ALPHABET.length)];
  }
  return value;
}

export function newCaptchaSession(): string {
  return randomBytes(32).toString("hex");
}

export function hashSession(sessionId: string, pepper: string): string {
  return createHmac("sha256", pepper).update(`captcha-session:${sessionId}`).digest("hex");
}

export async function verifyCaptcha(
  store: CaptchaStore,
  input: {
    id: string;
    answer: string;
    purpose: CaptchaPurpose;
    sessionHash: string;
    pepper: string;
    now: Date;
  },
): Promise<{ ok: true } | { ok: false; reason: "captcha_invalid" | "captcha_expired" }> {
  const row = await store.consumeIfOpen(input.id, input.now);
  if (!row) return { ok: false, reason: "captcha_invalid" };
  if (row.expiresAt.getTime() <= input.now.getTime()) return { ok: false, reason: "captcha_expired" };
  if (row.purpose !== input.purpose || row.sessionHash !== input.sessionHash) {
    return { ok: false, reason: "captcha_invalid" };
  }
  const actual = hashCaptchaAnswer(input.answer, input.pepper);
  const left = Buffer.from(actual);
  const right = Buffer.from(row.answerHash);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, reason: "captcha_invalid" };
  }
  return { ok: true };
}

export class MemoryCaptchaStore implements CaptchaStore {
  records: CaptchaRecord[] = [];

  async insert(record: CaptchaRecord): Promise<void> {
    this.records.push({ ...record });
  }

  async invalidateOpen(sessionHash: string, purpose: CaptchaPurpose): Promise<void> {
    const now = new Date();
    for (const record of this.records) {
      if (record.sessionHash === sessionHash && record.purpose === purpose && record.consumedAt == null) {
        record.consumedAt = now;
      }
    }
  }

  async consumeIfOpen(id: string, now: Date): Promise<CaptchaRecord | null> {
    const record = this.records.find((item) => item.id === id);
    if (!record || record.consumedAt) return null;
    record.consumedAt = now;
    return { ...record, consumedAt: null };
  }
}

export function sessionAllowed(input: {
  iat: number;
  tokensValidAfter: number;
  revoked: boolean;
}): boolean {
  if (input.revoked) return false;
  return input.iat >= input.tokensValidAfter;
}
