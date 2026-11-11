import "server-only";
import { cookies } from "next/headers";
import sharp from "sharp";
import { randomInt } from "node:crypto";
import {
  CAPTCHA_TTL_MS,
  createCaptchaAnswer,
  hashCaptchaAnswer,
  hashSession,
  newCaptchaSession,
  verifyCaptcha,
  type CaptchaPurpose,
  type CaptchaRecord,
  type CaptchaStore,
} from "@/lib/captcha";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";

const COOKIE = "yifan_sid";

export async function captchaSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
  const created = newCaptchaSession();
  store.set(COOKIE, created, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return created;
}

function dbStore(): CaptchaStore {
  const admin = createAdminClient();
  if (!admin) throw new Error("unavailable");
  return {
    async insert(record: CaptchaRecord) {
      const { error } = await admin.from("captcha_challenges").insert({
        id: record.id,
        purpose: record.purpose,
        session_hash: record.sessionHash,
        answer_hash: record.answerHash,
        expires_at: record.expiresAt.toISOString(),
      });
      if (error) throw new Error("captcha_store");
    },
    async invalidateOpen(sessionHash: string, purpose: CaptchaPurpose) {
      const { error } = await admin
        .from("captcha_challenges")
        .update({ consumed_at: new Date().toISOString() })
        .eq("session_hash", sessionHash)
        .eq("purpose", purpose)
        .is("consumed_at", null);
      if (error) throw new Error("captcha_store");
    },
    async consumeIfOpen(id: string) {
      const { data, error } = await admin
        .from("captcha_challenges")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", id)
        .is("consumed_at", null)
        .select("id, purpose, session_hash, answer_hash, expires_at")
        .maybeSingle();
      if (error || !data) return null;
      return {
        id: data.id,
        purpose: data.purpose,
        sessionHash: data.session_hash,
        answerHash: data.answer_hash,
        expiresAt: new Date(data.expires_at),
        consumedAt: null,
      } satisfies CaptchaRecord;
    },
  };
}

export async function renderCaptchaPng(answer: string): Promise<Buffer> {
  const width = 188;
  const height = 68;
  const glyphs = answer.split("").map((char, index) => {
    const x = 16 + index * 34;
    const y = 46;
    const rotate = randomInt(-16, 17);
    return `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})" font-size="34" font-family="Georgia, Times, serif" fill="#1d1d1f">${char}</text>`;
  });
  const noise = Array.from({ length: 7 }, () => {
    return `<line x1="${randomInt(0, width)}" y1="${randomInt(0, height)}" x2="${randomInt(0, width)}" y2="${randomInt(0, height)}" stroke="#8a8a8e" stroke-width="1.2"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f5f5f7"/>${noise.join("")}${glyphs.join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function issueCaptcha(purpose: CaptchaPurpose): Promise<{ challengeId: string; image: string }> {
  const env = getServerEnv();
  if (!env) throw new Error("unavailable");
  const sessionId = await captchaSessionId();
  const sessionHash = hashSession(sessionId, env.pepper);
  const answer = createCaptchaAnswer();
  const id = crypto.randomUUID();
  const store = dbStore();
  await store.invalidateOpen(sessionHash, purpose);
  await store.insert({
    id,
    purpose,
    sessionHash,
    answerHash: hashCaptchaAnswer(answer, env.pepper),
    expiresAt: new Date(Date.now() + CAPTCHA_TTL_MS),
    consumedAt: null,
  });
  const png = await renderCaptchaPng(answer);
  return { challengeId: id, image: `data:image/png;base64,${png.toString("base64")}` };
}

export async function checkCaptcha(input: { id: string; answer: string; purpose: CaptchaPurpose }) {
  const env = getServerEnv();
  if (!env) return { ok: false as const, reason: "unavailable" as const };
  const sessionId = await captchaSessionId();
  return verifyCaptcha(dbStore(), {
    id: input.id,
    answer: input.answer,
    purpose: input.purpose,
    sessionHash: hashSession(sessionId, env.pepper),
    pepper: env.pepper,
    now: new Date(),
  });
}
