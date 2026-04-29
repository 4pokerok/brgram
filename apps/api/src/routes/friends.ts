import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAuthUser } from "../auth.js";
import { db } from "../lib/db.js";

const usernameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_-]+$/, "Username can contain only letters, numbers, _ and -");

const friendRequestSchema = z.object({
  username: z.string().min(1).max(64),
});

const requestIdParamsSchema = z.object({
  requestId: z.string().min(1),
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

type FriendshipRow = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
};

type RequestViewRow = {
  id: string;
  userId: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
};

async function isBlockedBetweenUsers(firstUserId: string, secondUserId: string) {
  const result = await db.query<{ id: string }>(
    `
SELECT id
FROM "UserBlock"
WHERE ("blockerId" = $1 AND "blockedId" = $2)
   OR ("blockerId" = $2 AND "blockedId" = $1)
LIMIT 1
`,
    [firstUserId, secondUserId]
  );

  return Boolean(result.rowCount && result.rowCount > 0);
}

export async function friendRoutes(app: FastifyInstance) {
  app.get("/friends", { preHandler: app.authenticate }, async (request) => {
    const user = getAuthUser(request);

    const friendsResult = await db.query<PublicUser>(
      `
SELECT
  u.id,
  u.email,
  u.username,
  u."avatarUrl",
  u.bio
FROM "Friendship" f
JOIN "User" u ON u.id = CASE WHEN f."requesterId" = $1 THEN f."addresseeId" ELSE f."requesterId" END
WHERE (f."requesterId" = $1 OR f."addresseeId" = $1)
  AND f.status = 'ACCEPTED'
ORDER BY u.username ASC
`,
      [user.id]
    );

    const incomingResult = await db.query<RequestViewRow>(
      `
SELECT
  f.id,
  u.id AS "userId",
  u.username,
  u.email,
  u."avatarUrl",
  u.bio,
  f."createdAt"
FROM "Friendship" f
JOIN "User" u ON u.id = f."requesterId"
WHERE f."addresseeId" = $1
  AND f.status = 'PENDING'
ORDER BY f."createdAt" DESC
`,
      [user.id]
    );

    const outgoingResult = await db.query<RequestViewRow>(
      `
SELECT
  f.id,
  u.id AS "userId",
  u.username,
  u.email,
  u."avatarUrl",
  u.bio,
  f."createdAt"
FROM "Friendship" f
JOIN "User" u ON u.id = f."addresseeId"
WHERE f."requesterId" = $1
  AND f.status = 'PENDING'
ORDER BY f."createdAt" DESC
`,
      [user.id]
    );

    const blockedResult = await db.query<PublicUser>(
      `
SELECT
  u.id,
  u.email,
  u.username,
  u."avatarUrl",
  u.bio
FROM "UserBlock" b
JOIN "User" u ON u.id = b."blockedId"
WHERE b."blockerId" = $1
ORDER BY u.username ASC
`,
      [user.id]
    );

    return {
      friends: friendsResult.rows,
      blockedUsers: blockedResult.rows,
      incomingRequests: incomingResult.rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        user: {
          id: row.userId,
          username: row.username,
          email: row.email,
          avatarUrl: row.avatarUrl,
          bio: row.bio,
        },
      })),
      outgoingRequests: outgoingResult.rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        user: {
          id: row.userId,
          username: row.username,
          email: row.email,
          avatarUrl: row.avatarUrl,
          bio: row.bio,
        },
      })),
    };
  });

  app.delete("/friends/:userId", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = userIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const user = getAuthUser(request);
    const targetUserId = paramsParsed.data.userId;
    if (targetUserId === user.id) {
      return reply.code(400).send({ error: "You cannot remove yourself from friends" });
    }

    const removed = await db.query<FriendshipRow>(
      `
DELETE FROM "Friendship"
WHERE status = 'ACCEPTED'
  AND (
    ("requesterId" = $1 AND "addresseeId" = $2)
    OR ("requesterId" = $2 AND "addresseeId" = $1)
  )
RETURNING id, "requesterId", "addresseeId", status, "createdAt"
`,
      [user.id, targetUserId]
    );

    if (!removed.rowCount || removed.rowCount === 0) {
      return reply.code(404).send({ error: "Friend not found" });
    }

    app.io.to(`user:${user.id}`).emit("friends:updated");
    app.io.to(`user:${targetUserId}`).emit("friends:updated");

    return reply.send({ status: "REMOVED" });
  });

  app.post("/friends/request", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = friendRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    const user = getAuthUser(request);
    const usernameRaw = parsed.data.username.trim().replace(/^@+/, "");
    const usernameParsed = usernameSchema.safeParse(usernameRaw);
    if (!usernameParsed.success) {
      return reply.code(400).send({
        error: "Invalid payload",
        details: usernameParsed.error.flatten(),
      });
    }
    const username = usernameParsed.data;

    const targetResult = await db.query<PublicUser>(
      'SELECT id, email, username, "avatarUrl", bio FROM "User" WHERE username = $1 LIMIT 1',
      [username]
    );

    if (!targetResult.rowCount || targetResult.rowCount === 0) {
      return reply.code(404).send({ error: "User not found" });
    }

    const target = targetResult.rows[0];
    if (target.id === user.id) {
      return reply.code(400).send({ error: "You cannot add yourself" });
    }

    const blocked = await isBlockedBetweenUsers(user.id, target.id);
    if (blocked) {
      return reply.code(403).send({ error: "Cannot send request: one of users is blocked" });
    }

    const existingResult = await db.query<FriendshipRow>(
      `
SELECT id, "requesterId", "addresseeId", status, "createdAt"
FROM "Friendship"
WHERE ("requesterId" = $1 AND "addresseeId" = $2)
   OR ("requesterId" = $2 AND "addresseeId" = $1)
LIMIT 1
`,
      [user.id, target.id]
    );

    if (existingResult.rowCount && existingResult.rowCount > 0) {
      const existing = existingResult.rows[0];

      if (existing.status === "ACCEPTED") {
        return reply.code(409).send({ error: "Already friends" });
      }

      if (existing.status === "PENDING") {
        if (existing.requesterId === user.id) {
          return reply.code(409).send({ error: "Friend request already sent" });
        }

        const accepted = await db.query<FriendshipRow>(
          `
UPDATE "Friendship"
SET status = 'ACCEPTED',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, "requesterId", "addresseeId", status, "createdAt"
`,
          [existing.id]
        );

        const friendship = accepted.rows[0];
        app.io.to(`user:${friendship.requesterId}`).emit("friends:updated");
        app.io.to(`user:${friendship.addresseeId}`).emit("friends:updated");

        return reply.send({
          status: "ACCEPTED",
          friendshipId: friendship.id,
          user: target,
        });
      }

      await db.query('DELETE FROM "Friendship" WHERE id = $1', [existing.id]);
    }

    const inserted = await db.query<FriendshipRow>(
      `
INSERT INTO "Friendship" (id, "requesterId", "addresseeId", status)
VALUES ($1, $2, $3, 'PENDING')
RETURNING id, "requesterId", "addresseeId", status, "createdAt"
`,
      [randomUUID(), user.id, target.id]
    );

    const friendship = inserted.rows[0];
    app.io.to(`user:${friendship.requesterId}`).emit("friends:updated");
    app.io.to(`user:${friendship.addresseeId}`).emit("friends:updated");

    return reply.code(201).send({
      status: "PENDING",
      friendshipId: friendship.id,
      user: target,
    });
  });

  app.post("/friends/:requestId/accept", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = requestIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const user = getAuthUser(request);
    const result = await db.query<FriendshipRow>(
      `
UPDATE "Friendship"
SET status = 'ACCEPTED',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE id = $1
  AND "addresseeId" = $2
  AND status = 'PENDING'
RETURNING id, "requesterId", "addresseeId", status, "createdAt"
`,
      [paramsParsed.data.requestId, user.id]
    );

    if (!result.rowCount || result.rowCount === 0) {
      return reply.code(404).send({ error: "Friend request not found" });
    }

    const friendship = result.rows[0];
    app.io.to(`user:${friendship.requesterId}`).emit("friends:updated");
    app.io.to(`user:${friendship.addresseeId}`).emit("friends:updated");

    return reply.send({ status: "ACCEPTED" });
  });

  app.post("/friends/:requestId/decline", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = requestIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const user = getAuthUser(request);
    const result = await db.query<FriendshipRow>(
      `
UPDATE "Friendship"
SET status = 'DECLINED',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE id = $1
  AND "addresseeId" = $2
  AND status = 'PENDING'
RETURNING id, "requesterId", "addresseeId", status, "createdAt"
`,
      [paramsParsed.data.requestId, user.id]
    );

    if (!result.rowCount || result.rowCount === 0) {
      return reply.code(404).send({ error: "Friend request not found" });
    }

    const friendship = result.rows[0];
    app.io.to(`user:${friendship.requesterId}`).emit("friends:updated");
    app.io.to(`user:${friendship.addresseeId}`).emit("friends:updated");

    return reply.send({ status: "DECLINED" });
  });
}
