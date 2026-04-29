import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../lib/db.js";

const usernameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_-]+$/, "Username can contain only letters, numbers, _ and -");

const registerSchema = z.object({
  email: z.string().email(),
  username: usernameSchema,
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

const passkeyRegisterOptionsSchema = z.object({
  email: z.string().email(),
  username: usernameSchema,
});

const passkeyRegisterVerifySchema = z.object({
  flowId: z.string().uuid(),
  response: z.unknown(),
});

const passkeyLoginOptionsSchema = z.object({
  email: z.string().email(),
});

const passkeyLoginVerifySchema = z.object({
  flowId: z.string().uuid(),
  response: z.unknown(),
});

type PublicUser = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
};

type PendingPasskeyChallenge =
  | {
      type: "register";
      challenge: string;
      email: string;
      username: string;
      userId: string;
      expiresAt: number;
    }
  | {
      type: "login";
      challenge: string;
      userId: string;
      expiresAt: number;
    };

const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const pendingPasskeyChallenges = new Map<string, PendingPasskeyChallenge>();

function cleanupExpiredPasskeyChallenges() {
  const now = Date.now();
  for (const [flowId, challenge] of pendingPasskeyChallenges.entries()) {
    if (challenge.expiresAt <= now) {
      pendingPasskeyChallenges.delete(flowId);
    }
  }
}

function issueToken(app: FastifyInstance, user: PublicUser) {
  return app.jwt.sign(
    {
      sub: user.id,
      email: user.email,
      username: user.username,
    },
    {
      expiresIn: "7d",
    }
  );
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    const { email, username, password } = parsed.data;

    const existing = await db.query<{ id: string }>(
      'SELECT id FROM "User" WHERE email = $1 OR username = $2 LIMIT 1',
      [email, username]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      return reply.code(409).send({
        error: "User with this email or username already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newId = randomUUID();

    const inserted = await db.query<PublicUser>(
      'INSERT INTO "User" (id, email, username, "passwordHash") VALUES ($1, $2, $3, $4) RETURNING id, email, username, "avatarUrl", bio',
      [newId, email, username, passwordHash]
    );

    const user = inserted.rows[0];
    const token = issueToken(app, user);

    return reply.code(201).send({ token, user });
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    const { email, password } = parsed.data;

    const result = await db.query<{
      id: string;
      email: string;
      username: string;
      avatarUrl: string | null;
      bio: string | null;
      passwordHash: string;
    }>('SELECT id, email, username, "avatarUrl", bio, "passwordHash" FROM "User" WHERE email = $1 LIMIT 1', [email]);

    if (!result.rowCount || result.rowCount === 0) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const publicUser: PublicUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    };

    const token = issueToken(app, publicUser);

    return reply.send({
      token,
      user: publicUser,
    });
  });

  app.post("/auth/passkey/register/options", async (request, reply) => {
    cleanupExpiredPasskeyChallenges();

    const parsed = passkeyRegisterOptionsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const username = parsed.data.username.trim();

    const existing = await db.query<{ id: string }>(
      'SELECT id FROM "User" WHERE email = $1 OR username = $2 LIMIT 1',
      [email, username]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      return reply.code(409).send({
        error: "User with this email or username already exists",
      });
    }

    const userId = randomUUID();
    const options = await generateRegistrationOptions({
      rpName: "brgram",
      rpID: config.WEBAUTHN_RP_ID,
      userName: email,
      userDisplayName: username,
      userID: new TextEncoder().encode(userId),
      attestationType: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        userVerification: "required",
      },
      preferredAuthenticatorType: "localDevice",
      timeout: 60_000,
    });

    const flowId = randomUUID();
    pendingPasskeyChallenges.set(flowId, {
      type: "register",
      challenge: options.challenge,
      email,
      username,
      userId,
      expiresAt: Date.now() + PASSKEY_CHALLENGE_TTL_MS,
    });

    return reply.send({ flowId, options });
  });

  app.post("/auth/passkey/register/verify", async (request, reply) => {
    cleanupExpiredPasskeyChallenges();

    const parsed = passkeyRegisterVerifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    const challenge = pendingPasskeyChallenges.get(parsed.data.flowId);
    pendingPasskeyChallenges.delete(parsed.data.flowId);

    if (!challenge || challenge.type !== "register" || challenge.expiresAt <= Date.now()) {
      return reply.code(400).send({
        error: "Registration session expired. Try again.",
      });
    }

    let verifiedRegistration;
    try {
      verifiedRegistration = await verifyRegistrationResponse({
        response: parsed.data.response as RegistrationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: config.WEBAUTHN_ORIGINS,
        expectedRPID: config.WEBAUTHN_RP_ID,
        requireUserVerification: true,
      });
    } catch {
      return reply.code(400).send({ error: "Touch ID verification failed" });
    }

    if (!verifiedRegistration.verified || !verifiedRegistration.registrationInfo) {
      return reply.code(400).send({ error: "Touch ID verification failed" });
    }

    const credential = verifiedRegistration.registrationInfo.credential;
    const passwordHash = await bcrypt.hash(randomUUID(), 10);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        'INSERT INTO "User" (id, email, username, "passwordHash") VALUES ($1, $2, $3, $4)',
        [challenge.userId, challenge.email, challenge.username, passwordHash]
      );

      await client.query(
        'INSERT INTO "Passkey" (id, "userId", "credentialId", "publicKey", "counter", "transports", "deviceType", "backedUp") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          randomUUID(),
          challenge.userId,
          credential.id,
          isoBase64URL.fromBuffer(credential.publicKey),
          credential.counter,
          credential.transports ?? [],
          verifiedRegistration.registrationInfo.credentialDeviceType,
          verifiedRegistration.registrationInfo.credentialBackedUp,
        ]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");

      if (typeof error === "object" && error && "code" in error && error.code === "23505") {
        return reply.code(409).send({
          error: "User with this email or username already exists",
        });
      }

      throw error;
    } finally {
      client.release();
    }

    const user: PublicUser = {
      id: challenge.userId,
      email: challenge.email,
      username: challenge.username,
      avatarUrl: null,
      bio: null,
    };
    const token = issueToken(app, user);

    return reply.code(201).send({ token, user });
  });

  app.post("/auth/passkey/login/options", async (request, reply) => {
    cleanupExpiredPasskeyChallenges();

    const parsed = passkeyLoginOptionsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    const email = parsed.data.email.trim().toLowerCase();

    const userResult = await db.query<PublicUser>(
      'SELECT id, email, username, "avatarUrl", bio FROM "User" WHERE email = $1 LIMIT 1',
      [email]
    );
    if (!userResult.rowCount || userResult.rowCount === 0) {
      return reply.code(404).send({ error: "User not found" });
    }

    const user = userResult.rows[0];
    const passkeys = await db.query<{
      credentialId: string;
      transports: string[];
    }>('SELECT "credentialId", "transports" FROM "Passkey" WHERE "userId" = $1 ORDER BY "createdAt" ASC', [user.id]);

    if (!passkeys.rowCount || passkeys.rowCount === 0) {
      return reply.code(400).send({ error: "Touch ID is not enabled for this account" });
    }

    const options = await generateAuthenticationOptions({
      rpID: config.WEBAUTHN_RP_ID,
      allowCredentials: passkeys.rows.map((passkey) => ({
        id: passkey.credentialId,
        transports: (passkey.transports ?? []).filter(Boolean) as AuthenticatorTransportFuture[],
      })),
      userVerification: "required",
      timeout: 60_000,
    });

    const flowId = randomUUID();
    pendingPasskeyChallenges.set(flowId, {
      type: "login",
      challenge: options.challenge,
      userId: user.id,
      expiresAt: Date.now() + PASSKEY_CHALLENGE_TTL_MS,
    });

    return reply.send({ flowId, options });
  });

  app.post("/auth/passkey/login/verify", async (request, reply) => {
    cleanupExpiredPasskeyChallenges();

    const parsed = passkeyLoginVerifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    const challenge = pendingPasskeyChallenges.get(parsed.data.flowId);
    pendingPasskeyChallenges.delete(parsed.data.flowId);

    if (!challenge || challenge.type !== "login" || challenge.expiresAt <= Date.now()) {
      return reply.code(400).send({ error: "Login session expired. Try again." });
    }

    const response = parsed.data.response as AuthenticationResponseJSON;
    if (!response || typeof response !== "object" || typeof response.id !== "string") {
      return reply.code(400).send({ error: "Invalid payload" });
    }

    const result = await db.query<{
      passkeyId: string;
      credentialId: string;
      publicKey: string;
      counter: number;
      transports: string[];
      userId: string;
      email: string;
      username: string;
      avatarUrl: string | null;
      bio: string | null;
    }>(
      'SELECT p.id AS "passkeyId", p."credentialId", p."publicKey", p."counter", p."transports", u.id AS "userId", u.email, u.username, u."avatarUrl", u.bio FROM "Passkey" p JOIN "User" u ON u.id = p."userId" WHERE p."credentialId" = $1 AND p."userId" = $2 LIMIT 1',
      [response.id, challenge.userId]
    );

    if (!result.rowCount || result.rowCount === 0) {
      return reply.code(401).send({ error: "Passkey is not linked to this account" });
    }

    const row = result.rows[0];
    const credential: WebAuthnCredential = {
      id: row.credentialId,
      publicKey: isoBase64URL.toBuffer(row.publicKey),
      counter: Number(row.counter),
      transports: (row.transports ?? []).filter(Boolean) as AuthenticatorTransportFuture[],
    };

    let verifiedAuth;
    try {
      verifiedAuth = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: config.WEBAUTHN_ORIGINS,
        expectedRPID: config.WEBAUTHN_RP_ID,
        credential,
        requireUserVerification: true,
      });
    } catch {
      return reply.code(401).send({ error: "Touch ID verification failed" });
    }

    if (!verifiedAuth.verified) {
      return reply.code(401).send({ error: "Touch ID verification failed" });
    }

    await db.query(
      'UPDATE "Passkey" SET "counter" = $2, "deviceType" = $3, "backedUp" = $4, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1',
      [
        row.passkeyId,
        verifiedAuth.authenticationInfo.newCounter,
        verifiedAuth.authenticationInfo.credentialDeviceType,
        verifiedAuth.authenticationInfo.credentialBackedUp,
      ]
    );

    const user: PublicUser = {
      id: row.userId,
      email: row.email,
      username: row.username,
      avatarUrl: row.avatarUrl,
      bio: row.bio,
    };
    const token = issueToken(app, user);

    return reply.send({ token, user });
  });
}
