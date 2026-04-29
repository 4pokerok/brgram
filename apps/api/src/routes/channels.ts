import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../lib/db.js";
import { getAuthUser } from "../auth.js";
import { MAX_CHAT_FILE_SIZE_BYTES } from "../lib/fileUploads.js";

const channelTypeSchema = z.enum(["TEXT", "VOICE"]);

const createChannelSchema = z.object({
  name: z.string().min(2).max(40),
  description: z.string().max(200).optional(),
  type: channelTypeSchema,
});

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
}, z.string().max(4_000_000).refine((value) => isValidAvatarSource(value), "Invalid avatar URL").nullable());

const updateChannelSchema = z.object({
  avatarUrl: avatarUrlSchema,
});

const inviteToChannelSchema = z.object({
  userId: z.string().min(1),
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

const channelIdParamsSchema = z.object({
  channelId: z.string().min(1),
});

const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

type DbChannelRow = {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  ownerId: string | null;
  isPrivate: boolean;
  type: "TEXT" | "VOICE";
  createdAt: string;
  updatedAt: string;
};

type DbChannelListRow = DbChannelRow & {
  messagesCount: number;
};

type DbChannelAccessRow = DbChannelRow & {
  isMember: boolean;
};

type DbMessageRow = {
  id: string;
  channelId: string;
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

type DbMemberUser = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
};

function mapChannel(row: DbChannelRow, messagesCount?: number) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    avatarUrl: row.avatarUrl,
    ownerId: row.ownerId,
    isPrivate: row.isPrivate,
    type: row.type,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    _count: typeof messagesCount === "number" ? { messages: messagesCount } : undefined,
  };
}

function mapMessage(row: DbMessageRow) {
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
    channelId: row.channelId,
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

async function createChannelActivityMessage(channelId: string, authorId: string, content: string) {
  const channelResult = await db.query<{ id: string; type: "TEXT" | "VOICE" }>(
    'SELECT id, type FROM "Channel" WHERE id = $1 LIMIT 1',
    [channelId]
  );

  if (!channelResult.rowCount || channelResult.rowCount === 0) {
    return null;
  }

  if (channelResult.rows[0].type !== "TEXT") {
    return null;
  }

  const inserted = await db.query<DbMessageRow>(
    `
WITH inserted AS (
  INSERT INTO "Message" (id, "channelId", "authorId", content)
  VALUES ($1, $2, $3, $4)
  RETURNING id, "channelId", "authorId", content, "attachmentUrl", "attachmentName", "attachmentSize", "attachmentMimeType", "createdAt"
)
SELECT
  i.id,
  i."channelId",
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
    [randomUUID(), channelId, authorId, content]
  );

  return mapMessage(inserted.rows[0]);
}

async function getChannelAccess(channelId: string, userId: string) {
  const result = await db.query<DbChannelAccessRow>(
    `
SELECT
  c.id,
  c.name,
  c.description,
  c."avatarUrl",
  c."ownerId",
  c."isPrivate",
  c.type,
  c."createdAt",
  c."updatedAt",
  EXISTS (
    SELECT 1
    FROM "ChannelMember" cm
    WHERE cm."channelId" = c.id
      AND cm."userId" = $2
  ) AS "isMember"
FROM "Channel" c
WHERE c.id = $1
LIMIT 1
`,
    [channelId, userId]
  );

  if (!result.rowCount || result.rowCount === 0) {
    return null;
  }

  const channel = result.rows[0];
  return {
    channel,
    canAccess: !channel.isPrivate || channel.isMember,
  };
}

async function getChannelForDelivery(channelId: string) {
  const result = await db.query<DbChannelListRow>(
    `
SELECT
  c.id,
  c.name,
  c.description,
  c."avatarUrl",
  c."ownerId",
  c."isPrivate",
  c.type,
  c."createdAt",
  c."updatedAt",
  COALESCE(mc.count, 0)::int AS "messagesCount"
FROM "Channel" c
LEFT JOIN (
  SELECT "channelId", COUNT(*)::int AS count
  FROM "Message"
  GROUP BY "channelId"
) mc ON mc."channelId" = c.id
WHERE c.id = $1
LIMIT 1
`,
    [channelId]
  );

  if (!result.rowCount || result.rowCount === 0) return null;
  const channel = result.rows[0];
  return mapChannel(channel, channel.messagesCount);
}

async function getChannelMemberIds(channelId: string) {
  const result = await db.query<{ userId: string }>(
    'SELECT "userId" FROM "ChannelMember" WHERE "channelId" = $1',
    [channelId]
  );

  return result.rows.map((row) => row.userId);
}

export async function channelRoutes(app: FastifyInstance) {
  app.get("/channels", { preHandler: app.authenticate }, async (request) => {
    const user = getAuthUser(request);

    const result = await db.query<DbChannelListRow>(
      `
SELECT
  c.id,
  c.name,
  c.description,
  c."avatarUrl",
  c."ownerId",
  c."isPrivate",
  c.type,
  c."createdAt",
  c."updatedAt",
  COALESCE(mc.count, 0)::int AS "messagesCount"
FROM "Channel" c
LEFT JOIN (
  SELECT "channelId", COUNT(*)::int AS count
  FROM "Message"
  GROUP BY "channelId"
) mc ON mc."channelId" = c.id
LEFT JOIN "ChannelMember" cm
  ON cm."channelId" = c.id
 AND cm."userId" = $1
WHERE c."isPrivate" = FALSE
   OR cm."userId" IS NOT NULL
ORDER BY c.type ASC, c."createdAt" ASC
`,
      [user.id]
    );

    return result.rows.map((row) => mapChannel(row, row.messagesCount));
  });

  app.post("/channels", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = createChannelSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    const user = getAuthUser(request);
    const { name, description, type } = parsed.data;

    const inserted = await db.query<DbChannelRow>(
      `
INSERT INTO "Channel" (id, name, description, "avatarUrl", "ownerId", "isPrivate", type)
VALUES ($1, $2, $3, $4, $5, TRUE, $6)
RETURNING id, name, description, "avatarUrl", "ownerId", "isPrivate", type, "createdAt", "updatedAt"
`,
      [randomUUID(), name, description ?? null, null, user.id, type]
    );

    const channel = inserted.rows[0];

    await db.query(
      `
INSERT INTO "ChannelMember" (id, "channelId", "userId")
VALUES ($1, $2, $3)
ON CONFLICT ("channelId", "userId") DO NOTHING
`,
      [randomUUID(), channel.id, user.id]
    );

    const payload = mapChannel(channel, 0);
    app.io.to(`user:${user.id}`).emit("channel:created", { id: payload.id });

    return reply.code(201).send(payload);
  });

  app.get("/channels/:channelId/members", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = channelIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const user = getAuthUser(request);
    const { channelId } = paramsParsed.data;
    const access = await getChannelAccess(channelId, user.id);
    if (!access || !access.canAccess) {
      return reply.code(404).send({ error: "Channel not found" });
    }

    const membersResult = await db.query<DbMemberUser>(
      `
SELECT
  u.id,
  u.email,
  u.username,
  u."avatarUrl",
  u.bio
FROM "ChannelMember" cm
JOIN "User" u ON u.id = cm."userId"
WHERE cm."channelId" = $1
ORDER BY u.username ASC
`,
      [channelId]
    );

    return membersResult.rows;
  });

  app.post("/channels/:channelId/invite", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = channelIdParamsSchema.safeParse(request.params);
    const bodyParsed = inviteToChannelSchema.safeParse(request.body);
    if (!paramsParsed.success || !bodyParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const user = getAuthUser(request);
    const { channelId } = paramsParsed.data;
    const { userId } = bodyParsed.data;

    const access = await getChannelAccess(channelId, user.id);
    if (!access || !access.canAccess) {
      return reply.code(404).send({ error: "Channel not found" });
    }

    if (!access.channel.isPrivate) {
      return reply.code(400).send({ error: "Invites are available only for private channels" });
    }

    if (!access.channel.ownerId || access.channel.ownerId !== user.id) {
      return reply.code(403).send({ error: "Only channel owner can invite members" });
    }

    if (userId === user.id) {
      return reply.code(400).send({ error: "You are already in this channel" });
    }

    const targetExists = await db.query<{ id: string }>('SELECT id FROM "User" WHERE id = $1 LIMIT 1', [userId]);
    if (!targetExists.rowCount || targetExists.rowCount === 0) {
      return reply.code(404).send({ error: "User not found" });
    }

    const friendshipResult = await db.query<{ id: string }>(
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
      [user.id, userId]
    );

    if (!friendshipResult.rowCount || friendshipResult.rowCount === 0) {
      return reply.code(403).send({ error: "You can invite only friends" });
    }

    const insertedMember = await db.query<{ id: string }>(
      `
INSERT INTO "ChannelMember" (id, "channelId", "userId")
VALUES ($1, $2, $3)
ON CONFLICT ("channelId", "userId") DO NOTHING
RETURNING id
`,
      [randomUUID(), channelId, userId]
    );

    if (insertedMember.rowCount && insertedMember.rowCount > 0) {
      const joinMessage = await createChannelActivityMessage(channelId, userId, "вступил в группу");
      if (joinMessage) {
        app.io.to(`channel:${channelId}`).emit("message:new", joinMessage);
      }
      app.io.to(`user:${userId}`).emit("channel:created", { id: channelId });
    }

    return reply.send({
      status: insertedMember.rowCount && insertedMember.rowCount > 0 ? "INVITED" : "ALREADY_MEMBER",
    });
  });

  app.patch("/channels/:channelId", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = channelIdParamsSchema.safeParse(request.params);
    const bodyParsed = updateChannelSchema.safeParse(request.body);

    if (!paramsParsed.success || !bodyParsed.success) {
      return reply.code(400).send({
        error: "Invalid request",
      });
    }

    const user = getAuthUser(request);
    const { channelId } = paramsParsed.data;
    const { avatarUrl } = bodyParsed.data;

    const access = await getChannelAccess(channelId, user.id);
    if (!access || !access.canAccess) {
      return reply.code(404).send({ error: "Channel not found" });
    }

    const updated = await db.query<DbChannelRow>(
      `
UPDATE "Channel"
SET "avatarUrl" = $2,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, name, description, "avatarUrl", "ownerId", "isPrivate", type, "createdAt", "updatedAt"
`,
      [channelId, avatarUrl]
    );

    if (!updated.rowCount || updated.rowCount === 0) {
      return reply.code(404).send({ error: "Channel not found" });
    }

    const channel = updated.rows[0];
    const payload = { id: channel.id };
    const responsePayload = mapChannel(channel);
    if (channel.isPrivate) {
      const memberIds = await getChannelMemberIds(channel.id);
      for (const memberId of memberIds) {
        app.io.to(`user:${memberId}`).emit("channel:updated", payload);
      }
    } else {
      app.io.emit("channel:updated", payload);
    }

    return reply.send(responsePayload);
  });

  app.delete("/channels/:channelId", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = channelIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const user = getAuthUser(request);
    const { channelId } = paramsParsed.data;

    const access = await getChannelAccess(channelId, user.id);
    if (!access || !access.canAccess) {
      return reply.code(404).send({ error: "Channel not found" });
    }

    if (access.channel.isPrivate && access.channel.ownerId && access.channel.ownerId !== user.id) {
      return reply.code(403).send({ error: "Only channel owner can delete channel" });
    }

    const privateMemberIds = access.channel.isPrivate ? await getChannelMemberIds(channelId) : [];

    const deleted = await db.query<{ id: string; type: "TEXT" | "VOICE"; isPrivate: boolean }>(
      'DELETE FROM "Channel" WHERE id = $1 RETURNING id, type, "isPrivate"',
      [channelId]
    );

    if (!deleted.rowCount || deleted.rowCount === 0) {
      return reply.code(404).send({ error: "Channel not found" });
    }

    const payload = {
      id: deleted.rows[0].id,
      type: deleted.rows[0].type,
    };

    if (deleted.rows[0].isPrivate) {
      for (const memberId of privateMemberIds) {
        app.io.to(`user:${memberId}`).emit("channel:deleted", payload);
      }
    } else {
      app.io.emit("channel:deleted", payload);
    }

    return reply.code(204).send();
  });

  app.post("/channels/:channelId/leave", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = channelIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const user = getAuthUser(request);
    const { channelId } = paramsParsed.data;

    const access = await getChannelAccess(channelId, user.id);
    if (!access || !access.canAccess) {
      return reply.code(404).send({ error: "Channel not found" });
    }

    if (!access.channel.isPrivate) {
      return reply.code(400).send({ error: "Cannot leave public channel" });
    }

    if (access.channel.ownerId && access.channel.ownerId === user.id) {
      return reply.code(400).send({ error: "Channel owner cannot leave. Delete channel instead" });
    }

    const removed = await db.query<{ id: string }>(
      `
DELETE FROM "ChannelMember"
WHERE "channelId" = $1
  AND "userId" = $2
RETURNING id
`,
      [channelId, user.id]
    );

    if (!removed.rowCount || removed.rowCount === 0) {
      return reply.code(404).send({ error: "Membership not found" });
    }

    const leaveMessage = await createChannelActivityMessage(channelId, user.id, "вышел из группы");
    if (leaveMessage) {
      app.io.to(`channel:${channelId}`).emit("message:new", leaveMessage);
    }

    app.io.to(`user:${user.id}`).emit("channel:deleted", {
      id: channelId,
      type: access.channel.type,
    });

    return reply.send({ status: "LEFT" });
  });

  app.get("/channels/:channelId/messages", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = channelIdParamsSchema.safeParse(request.params);
    const queryParsed = listMessagesQuerySchema.safeParse(request.query ?? {});

    if (!paramsParsed.success || !queryParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const user = getAuthUser(request);
    const { channelId } = paramsParsed.data;
    const { limit } = queryParsed.data;

    const access = await getChannelAccess(channelId, user.id);
    if (!access || !access.canAccess) {
      return reply.code(404).send({ error: "Channel not found" });
    }

    const messageResult = await db.query<DbMessageRow>(
      `
SELECT
  m.id,
  m."channelId",
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
FROM "Message" m
JOIN "User" u ON u.id = m."authorId"
WHERE m."channelId" = $1
ORDER BY m."createdAt" DESC
LIMIT $2
`,
      [channelId, limit]
    );

    return messageResult.rows.reverse().map(mapMessage);
  });

  app.post("/channels/:channelId/messages", { preHandler: app.authenticate }, async (request, reply) => {
    const paramsParsed = channelIdParamsSchema.safeParse(request.params);
    const bodyParsed = createMessageSchema.safeParse(request.body);

    if (!paramsParsed.success || !bodyParsed.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    const user = getAuthUser(request);
    const { channelId } = paramsParsed.data;
    const content = bodyParsed.data.content.trim();
    const attachment = bodyParsed.data.attachment ?? null;

    const access = await getChannelAccess(channelId, user.id);
    if (!access || !access.canAccess) {
      return reply.code(404).send({ error: "Channel not found" });
    }

    if (access.channel.type !== "TEXT") {
      return reply.code(400).send({ error: "Messages are allowed only in text channels" });
    }

    const inserted = await db.query<DbMessageRow>(
      `
WITH inserted AS (
  INSERT INTO "Message" (
    id,
    "channelId",
    "authorId",
    content,
    "attachmentUrl",
    "attachmentName",
    "attachmentSize",
    "attachmentMimeType"
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING id, "channelId", "authorId", content, "attachmentUrl", "attachmentName", "attachmentSize", "attachmentMimeType", "createdAt"
)
SELECT
  i.id,
  i."channelId",
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
        channelId,
        user.id,
        content,
        attachment?.url ?? null,
        attachment?.name ?? null,
        attachment?.size ?? null,
        attachment?.mimeType ?? null,
      ]
    );

    const message = mapMessage(inserted.rows[0]);

    app.io.to(`channel:${channelId}`).emit("message:new", message);

    return reply.code(201).send(message);
  });
}
