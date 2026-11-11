import type { Role } from "@/lib/types";

export function canReadQuote(actor: { id: string; role: Role }, quoteUserId: string): boolean {
  if (actor.role === "admin" || actor.role === "sales") return true;
  return actor.id === quoteUserId;
}

export function canManageStaff(role: Role): boolean {
  return role === "admin";
}

export function canPublishRates(role: Role): boolean {
  return role === "admin";
}

export function canDraftRates(role: Role): boolean {
  return role === "admin" || role === "sales";
}

export function canHandleInquiries(role: Role): boolean {
  return role === "admin" || role === "sales";
}

export function isStaffRole(role: Role): boolean {
  return role === "admin" || role === "sales";
}
