import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAuthUser } from "../auth.js";
import { db } from "../lib/db.js";

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_-]+$/, "Username can contain only letters, numbers, _ and -");

function isValidAvatarSource(value: string) {
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value)) return true;

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

const avatarUrlSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}, z.string().max(4_000_000).refine((value) => isValidAvatarSource(value), "Invalid avatar URL").nullable().optional());

const bioSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}, z.string().max(200).nullable().optional());

const updateProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    avatarUrl: avatarUrlSchema,
    bio: bioSchema,
  })
  .refine((value) => value.username !== undefined || value.avatarUrl !== undefined || value.bio !== undefined, {
    message: "No fields to update",
  });

const userIdParamsSchema = z.object({
  userId: z.string().min(1),
});

type PublicUser = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
};

type PublicUserProfile = {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
};

type FriendshipRow = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
};

async function isBlockedByUser(blockerId: string, blockedId: string) {
  const result = await db.query<{ id: string }>(
    `
SELECT id
FROM "UserBlock"
WHERE "blockerId" = $1
  AND "blockedId" = $2
LIMIT 1
`,
    [blockerId, blockedId]
  );

  return Boolean(result.rowCount && result.rowCount > 0);
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

export async function profileRoutes(app: FastifyInstance) {
  app.get("/profile", { preHandler: app.authenticate }, async (request, reply) => {
    const authUser = getAuthUser(request);

    const result = await db.query<PublicUser>(
      'SELECT id, email, username, "avatarUrl", bio FROM "User" WHERE id = $1 LIMIT 1',
      [authUser.id]
    );

    if (!result.rowCount || result.rowCount === 0) {
      return reply.code(404).send({ error: "User not found" });
    }

    return result.rows[0];
  });

  app.get("/users/:userId/profile", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = userIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const authUser = getAuthUser(request);
    const targetUserId = paramsParsed.data.userId;

    const result = await db.query<PublicUserProfile>(
      'SELECT id, username, "avatarUrl", bio FROM "User" WHERE id = $1 LIMIT 1',
      [targetUserId]
    );

    if (!result.rowCount || result.rowCount === 0) {
      return reply.code(404).send({ error: "User not found" });
    }

    const profile = result.rows[0];
    const blocked = await isBlockedByUser(authUser.id, targetUserId);

    return {
      ...profile,
      isBlocked: blocked,
    };
  });

  app.patch("/profile", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    const authUser = getAuthUser(request);
    const currentResult = await db.query<PublicUser>(
      'SELECT id, email, username, "avatarUrl", bio FROM "User" WHERE id = $1 LIMIT 1',
      [authUser.id]
    );

    if (!currentResult.rowCount || currentResult.rowCount === 0) {
      return reply.code(404).send({ error: "User not found" });
    }

    const current = currentResult.rows[0];
    const nextUsername = parsed.data.username ?? current.username;
    const nextAvatarUrl = parsed.data.avatarUrl === undefined ? current.avatarUrl : parsed.data.avatarUrl;
    const nextBio = parsed.data.bio === undefined ? current.bio : parsed.data.bio;

    if (nextUsername !== current.username) {
      const existing = await db.query<{ id: string }>('SELECT id FROM "User" WHERE username = $1 AND id <> $2 LIMIT 1', [
        nextUsername,
        authUser.id,
      ]);

      if (existing.rowCount && existing.rowCount > 0) {
        return reply.code(409).send({
          error: "User with this username already exists",
        });
      }
    }

    const updated = await db.query<PublicUser>(
      `
UPDATE "User"
SET username = $2,
    "avatarUrl" = $3,
    bio = $4,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, email, username, "avatarUrl", bio
`,
      [authUser.id, nextUsername, nextAvatarUrl, nextBio]
    );

    const user = updated.rows[0];
    const token = issueToken(app, user);

    return reply.send({
      token,
      user,
    });
  });

  app.post("/users/:userId/block", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = userIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const authUser = getAuthUser(request);
    const targetUserId = paramsParsed.data.userId;
    if (targetUserId === authUser.id) {
      return reply.code(400).send({ error: "You cannot block yourself" });
    }

    const targetExists = await db.query<{ id: string }>('SELECT id FROM "User" WHERE id = $1 LIMIT 1', [targetUserId]);
    if (!targetExists.rowCount || targetExists.rowCount === 0) {
      return reply.code(404).send({ error: "User not found" });
    }

    await db.query(
      `
INSERT INTO "UserBlock" (id, "blockerId", "blockedId")
VALUES ($1, $2, $3)
ON CONFLICT ("blockerId", "blockedId") DO NOTHING
`,
      [crypto.randomUUID(), authUser.id, targetUserId]
    );

    // Remove friend relations and pending requests after block.
    await db.query(
      `
DELETE FROM "Friendship"
WHERE ("requesterId" = $1 AND "addresseeId" = $2)
   OR ("requesterId" = $2 AND "addresseeId" = $1)
`,
      [authUser.id, targetUserId]
    );

    app.io.to(`user:${authUser.id}`).emit("friends:updated");
    app.io.to(`user:${targetUserId}`).emit("friends:updated");
    app.io.to(`user:${authUser.id}`).emit("user:block-updated", {
      targetUserId,
      action: "BLOCKED",
    });
    app.io.to(`user:${targetUserId}`).emit("user:block-updated", {
      targetUserId: authUser.id,
      action: "BLOCKED",
    });

    return reply.send({ status: "BLOCKED" });
  });

  app.delete("/users/:userId/block", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = userIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const authUser = getAuthUser(request);
    const targetUserId = paramsParsed.data.userId;

    await db.query('DELETE FROM "UserBlock" WHERE "blockerId" = $1 AND "blockedId" = $2', [authUser.id, targetUserId]);

    const existingFriendship = await db.query<FriendshipRow>(
      `
SELECT id, "requesterId", "addresseeId", status
FROM "Friendship"
WHERE ("requesterId" = $1 AND "addresseeId" = $2)
   OR ("requesterId" = $2 AND "addresseeId" = $1)
LIMIT 1
`,
      [authUser.id, targetUserId]
    );

    if (!existingFriendship.rowCount || existingFriendship.rowCount === 0) {
      await db.query(
        `
INSERT INTO "Friendship" (id, "requesterId", "addresseeId", status)
VALUES ($1, $2, $3, 'ACCEPTED')
`,
        [randomUUID(), authUser.id, targetUserId]
      );
    } else {
      await db.query(
        `
UPDATE "Friendship"
SET status = 'ACCEPTED',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE id = $1
`,
        [existingFriendship.rows[0].id]
      );
    }

    app.io.to(`user:${authUser.id}`).emit("friends:updated");
    app.io.to(`user:${targetUserId}`).emit("friends:updated");
    app.io.to(`user:${authUser.id}`).emit("user:block-updated", {
      targetUserId,
      action: "UNBLOCKED",
    });
    app.io.to(`user:${targetUserId}`).emit("user:block-updated", {
      targetUserId: authUser.id,
      action: "UNBLOCKED",
    });

    return reply.send({ status: "UNBLOCKED" });
  });
}
