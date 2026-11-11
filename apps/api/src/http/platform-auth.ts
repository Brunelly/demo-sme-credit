import { createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { z } from "zod";
import { AuthenticationError } from "../errors.ts";

const principalSchema = z.object({
  sub: z.string().trim().min(1).max(200),
  profileId: z.enum(["maha-alotaibi", "faisal-alqahtani", "noura-alharbi"]),
  role: z.enum(["relationship_manager", "credit_analyst", "senior_credit_officer", "credit_committee"]),
  iss: z.literal("brunelly-platform"),
  aud: z.literal("sme-credit-desk"),
  exp: z.number().int().positive(),
});

export type AuthenticatedPrincipal = z.infer<typeof principalSchema>;

function decodePart(value: string): unknown {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

/** Verifies a platform-issued HS256 bearer token and exposes only its validated principal. */
export function verifyPlatformToken(token: string, secret: string, now = Date.now()): AuthenticatedPrincipal {
  const parts = token.split(".");
  if (parts.length !== 3) throw new AuthenticationError("A valid platform identity is required to record a credit decision.");
  const [encodedHeader, encodedPayload, signature] = parts as [string, string, string];
  let header: unknown;
  let payload: unknown;
  try {
    header = decodePart(encodedHeader);
    payload = decodePart(encodedPayload);
  } catch {
    throw new AuthenticationError("A valid platform identity is required to record a credit decision.");
  }
  if (!z.object({ alg: z.literal("HS256"), typ: z.literal("JWT") }).safeParse(header).success) {
    throw new AuthenticationError("A valid platform identity is required to record a credit decision.");
  }
  const expected = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "base64url"); } catch { supplied = Buffer.alloc(0); }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new AuthenticationError("A valid platform identity is required to record a credit decision.");
  }
  const parsed = principalSchema.safeParse(payload);
  if (!parsed.success || parsed.data.exp <= Math.floor(now / 1000)) {
    throw new AuthenticationError("The platform identity is missing, invalid or expired. Sign in again and retry.");
  }
  return parsed.data;
}

export function requirePlatformIdentity(secret: string | undefined): RequestHandler {
  return (request, response, next) => {
    try {
      if (!secret) throw new AuthenticationError("Platform identity verification is not configured.");
      const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(request.get("authorization") ?? "");
      if (!match) throw new AuthenticationError("A platform sign-in is required to record a credit decision.");
      response.locals.principal = verifyPlatformToken(match[1]!, secret);
      next();
    } catch (error) { next(error); }
  };
}
