import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAuthUser } from "../auth.js";
import { db } from "../lib/db.js";
import { MAX_CHAT_FILE_SIZE_BYTES } from "../lib/fileUploads.js";

const openDmSchema = z.object({
  peerUserId: z.string().min(1),
});

const chatIdParamsSchema = z.object({
  chatId: z.string().min(1),
});

const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function isValidAttachmentUrl(value: string): boolean {
  if (value.startsWith("/uploads/")) return true;

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

const attachmentSchema = z.object({
  url: z.string().min(1).max(1024).refine((value) => isValidAttachmentUrl(value), "Invalid attachment URL"),
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_CHAT_FILE_SIZE_BYTES),
  mimeType: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().max(255).nullable()).optional(),
});

const createMessageSchema = z
  .object({
    content: z.string().max(2000).optional().default(""),
    attachment: attachmentSchema.optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.content.trim().length > 0 || value.attachment) {
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Message content or attachment is required",
      path: ["content"],
    });
  });

type PublicUser = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
};

type DirectChatRow = {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string;
  updatedAt: string;
};

type DirectChatListRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  peerId: string;
  peerUsername: string;
  peerEmail: string;
  peerAvatarUrl: string | null;
  peerBio: string | null;
  lastMessageId: string | null;
  lastMessageContent: string | null;
  lastMessageCreatedAt: string | null;
  lastMessageAuthorId: string | null;
};

type DirectMessageRow = {
  id: string;
  chatId: string;
  authorId: string;
  content: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentSize: number | string | null;
  attachmentMimeType: string | null;
  createdAt: string;
  userId: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
};

function mapDirectMessage(row: DirectMessageRow) {
  const parsedAttachmentSize =
    row.attachmentSize === null || row.attachmentSize === undefined ? null : Number(row.attachmentSize);
  const hasAttachment =
    typeof row.attachmentUrl === "string" &&
    row.attachmentUrl.length > 0 &&
    typeof row.attachmentName === "string" &&
    row.attachmentName.length > 0 &&
    Number.isFinite(parsedAttachmentSize) &&
    (parsedAttachmentSize as number) > 0;

  return {
    id: row.id,
    chatId: row.chatId,
    authorId: row.authorId,
    content: row.content,
    attachment: hasAttachment
      ? {
          url: row.attachmentUrl as string,
          name: row.attachmentName as string,
          size: parsedAttachmentSize as number,
          mimeType: row.attachmentMimeType,
        }
      : null,
    createdAt: row.createdAt,
    author: {
      id: row.userId,
      username: row.username,
      email: row.email,
      avatarUrl: row.avatarUrl,
      bio: row.bio,
    },
  };
}

function normalizePair(firstUserId: string, secondUserId: string): [string, string] {
  return firstUserId < secondUserId ? [firstUserId, secondUserId] : [secondUserId, firstUserId];
}

async function ensureUsersAreFriends(userId: string, peerUserId: string) {
  const friendship = await db.query<{ id: string }>(
    `
SELECT id
FROM "Friendship"
WHERE status = 'ACCEPTED'
  AND (
    ("requesterId" = $1 AND "addresseeId" = $2)
    OR ("requesterId" = $2 AND "addresseeId" = $1)
  )
LIMIT 1
`,
    [userId, peerUserId]
  );

  return Boolean(friendship.rowCount && friendship.rowCount > 0);
}

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

async function upsertDirectChat(userId: string, peerUserId: string): Promise<DirectChatRow> {
  const [userAId, userBId] = normalizePair(userId, peerUserId);
  const existing = await db.query<DirectChatRow>(
    `
SELECT
  id,
  "userAId",
  "userBId",
  "createdAt",
  "updatedAt"
FROM "DirectChat"
WHERE "userAId" = $1
  AND "userBId" = $2
LIMIT 1
`,
    [userAId, userBId]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    return existing.rows[0];
  }

  const inserted = await db.query<DirectChatRow>(
    `
INSERT INTO "DirectChat" (id, "userAId", "userBId")
VALUES ($1, $2, $3)
RETURNING id, "userAId", "userBId", "createdAt", "updatedAt"
`,
    [randomUUID(), userAId, userBId]
  );

  return inserted.rows[0];
}

export async function dmRoutes(app: FastifyInstance) {
  app.get("/dms", { preHandler: app.authenticate }, async (request) => {
    const user = getAuthUser(request);

    const result = await db.query<DirectChatListRow>(
      `
SELECT
  c.id,
  c."createdAt",
  c."updatedAt",
  u.id AS "peerId",
  u.username AS "peerUsername",
  u.email AS "peerEmail",
  u."avatarUrl" AS "peerAvatarUrl",
  u.bio AS "peerBio",
  lm.id AS "lastMessageId",
  lm.content AS "lastMessageContent",
  lm."createdAt" AS "lastMessageCreatedAt",
  lm."authorId" AS "lastMessageAuthorId"
FROM "DirectChat" c
JOIN "User" u ON u.id = CASE WHEN c."userAId" = $1 THEN c."userBId" ELSE c."userAId" END
LEFT JOIN LATERAL (
  SELECT id, content, "createdAt", "authorId"
  FROM "DirectMessage"
  WHERE "chatId" = c.id
  ORDER BY "createdAt" DESC
  LIMIT 1
) lm ON true
WHERE (c."userAId" = $1 OR c."userBId" = $1)
  AND NOT EXISTS (
    SELECT 1
    FROM "UserBlock" b
    WHERE (b."blockerId" = $1 AND b."blockedId" = u.id)
       OR (b."blockerId" = u.id AND b."blockedId" = $1)
  )
ORDER BY COALESCE(lm."createdAt", c."createdAt") DESC
`,
      [user.id]
    );

    return result.rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      peer: {
        id: row.peerId,
        username: row.peerUsername,
        email: row.peerEmail,
        avatarUrl: row.peerAvatarUrl,
        bio: row.peerBio,
      },
      lastMessage: row.lastMessageId
        ? {
            id: row.lastMessageId,
            content: row.lastMessageContent,
            createdAt: row.lastMessageCreatedAt,
            authorId: row.lastMessageAuthorId,
          }
        : null,
    }));
  });

  app.post("/dms/open", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = openDmSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    const user = getAuthUser(request);
    const peerUserId = parsed.data.peerUserId;

    if (peerUserId === user.id) {
      return reply.code(400).send({ error: "Cannot start a chat with yourself" });
    }

    const peerResult = await db.query<PublicUser>(
      'SELECT id, email, username, "avatarUrl", bio FROM "User" WHERE id = $1 LIMIT 1',
      [peerUserId]
    );
    if (!peerResult.rowCount || peerResult.rowCount === 0) {
      return reply.code(404).send({ error: "User not found" });
    }

    const blocked = await isBlockedBetweenUsers(user.id, peerUserId);
    if (blocked) {
      return reply.code(403).send({ error: "Direct chat unavailable: one of users is blocked" });
    }

    const areFriends = await ensureUsersAreFriends(user.id, peerUserId);
    if (!areFriends) {
      return reply.code(403).send({ error: "Only friends can start direct chats" });
    }

    const chat = await upsertDirectChat(user.id, peerUserId);

    return reply.send({
      id: chat.id,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      peer: peerResult.rows[0],
      lastMessage: null,
    });
  });

  app.get("/dms/:chatId/messages", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = chatIdParamsSchema.safeParse(request.params);
    const queryParsed = listMessagesQuerySchema.safeParse(request.query ?? {});
    if (!paramsParsed.success || !queryParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const user = getAuthUser(request);
    const { chatId } = paramsParsed.data;
    const { limit } = queryParsed.data;

    const chatResult = await db.query<{
      id: string;
      userAId: string;
      userBId: string;
    }>(
      `
SELECT id, "userAId", "userBId"
FROM "DirectChat"
WHERE id = $1
  AND ("userAId" = $2 OR "userBId" = $2)
LIMIT 1
`,
      [chatId, user.id]
    );

    if (!chatResult.rowCount || chatResult.rowCount === 0) {
      return reply.code(404).send({ error: "Direct chat not found" });
    }

    const chat = chatResult.rows[0];
    const peerUserId = chat.userAId === user.id ? chat.userBId : chat.userAId;
    const blocked = await isBlockedBetweenUsers(user.id, peerUserId);
    if (blocked) {
      return reply.code(403).send({ error: "Direct chat unavailable: one of users is blocked" });
    }

    const messages = await db.query<DirectMessageRow>(
      `
SELECT
  m.id,
  m."chatId",
  m."authorId",
  m.content,
  m."attachmentUrl",
  m."attachmentName",
  m."attachmentSize",
  m."attachmentMimeType",
  m."createdAt",
  u.id AS "userId",
  u.username,
  u.email,
  u."avatarUrl",
  u.bio
FROM "DirectMessage" m
JOIN "User" u ON u.id = m."authorId"
WHERE m."chatId" = $1
ORDER BY m."createdAt" DESC
LIMIT $2
`,
      [chatId, limit]
    );

    return messages.rows.reverse().map(mapDirectMessage);
  });

  app.post("/dms/:chatId/messages", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = chatIdParamsSchema.safeParse(request.params);
    const bodyParsed = createMessageSchema.safeParse(request.body);
    if (!paramsParsed.success || !bodyParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const user = getAuthUser(request);
    const { chatId } = paramsParsed.data;
    const content = bodyParsed.data.content.trim();
    const attachment = bodyParsed.data.attachment ?? null;

    const chatResult = await db.query<{
      id: string;
      userAId: string;
      userBId: string;
    }>(
      `
SELECT id, "userAId", "userBId"
FROM "DirectChat"
WHERE id = $1
  AND ("userAId" = $2 OR "userBId" = $2)
LIMIT 1
`,
      [chatId, user.id]
    );

    if (!chatResult.rowCount || chatResult.rowCount === 0) {
      return reply.code(404).send({ error: "Direct chat not found" });
    }

    const chat = chatResult.rows[0];
    const recipientUserId = chat.userAId === user.id ? chat.userBId : chat.userAId;
    const blocked = await isBlockedBetweenUsers(user.id, recipientUserId);
    if (blocked) {
      return reply.code(403).send({ error: "Cannot send message: one of users is blocked" });
    }

    const inserted = await db.query<DirectMessageRow>(
      `
WITH inserted AS (
  INSERT INTO "DirectMessage" (
    id,
    "chatId",
    "authorId",
    content,
    "attachmentUrl",
    "attachmentName",
    "attachmentSize",
    "attachmentMimeType"
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING id, "chatId", "authorId", content, "attachmentUrl", "attachmentName", "attachmentSize", "attachmentMimeType", "createdAt"
)
SELECT
  i.id,
  i."chatId",
  i."authorId",
  i.content,
  i."attachmentUrl",
  i."attachmentName",
  i."attachmentSize",
  i."attachmentMimeType",
  i."createdAt",
  u.id AS "userId",
  u.username,
  u.email,
  u."avatarUrl",
  u.bio
FROM inserted i
JOIN "User" u ON u.id = i."authorId"
`,
      [
        randomUUID(),
        chatId,
        user.id,
        content,
        attachment?.url ?? null,
        attachment?.name ?? null,
        attachment?.size ?? null,
        attachment?.mimeType ?? null,
      ]
    );

    await db.query(
      `
UPDATE "DirectChat"
SET "updatedAt" = CURRENT_TIMESTAMP
WHERE id = $1
`,
      [chatId]
    );

    const message = mapDirectMessage(inserted.rows[0]);

    app.io.to(`user:${user.id}`).emit("dm:new", message);
    app.io.to(`user:${recipientUserId}`).emit("dm:new", message);

    return reply.code(201).send(message);
  });
}
