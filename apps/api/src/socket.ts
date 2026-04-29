import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import { z } from "zod";
import { isAllowedCorsOrigin } from "./config.js";
import { db } from "./lib/db.js";
import type { SocketIOServer, SocketWithUser } from "./types/socket.js";

type VoiceParticipant = {
  id: string;
  username: string;
};

const sendMessageSchema = z.object({
  channelId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

const channelRoomSchema = z.object({
  channelId: z.string().min(1),
});

const voiceSignalSchema = z.object({
  channelId: z.string().min(1),
  toUserId: z.string().min(1),
  data: z.unknown(),
});

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

type ParsedCallRoom =
  | {
      kind: "CHANNEL";
      id: string;
    }
  | {
      kind: "DM";
      id: string;
    };

type DirectChatMembershipRow = {
  id: string;
  userAId: string;
  userBId: string;
};

type ChannelAccessRow = {
  id: string;
  type: "TEXT" | "VOICE";
  isPrivate: boolean;
  isMember: boolean;
};

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

function parseCallRoomId(roomId: string): ParsedCallRoom {
  if (roomId.startsWith("dm:")) {
    return {
      kind: "DM",
      id: roomId.slice(3),
    };
  }

  if (roomId.startsWith("channel:")) {
    return {
      kind: "CHANNEL",
      id: roomId.slice("channel:".length),
    };
  }

  // Fallback for old clients that may still send plain channel IDs.
  return {
    kind: "CHANNEL",
    id: roomId,
  };
}

async function getChannelAccess(channelId: string, userId: string) {
  const result = await db.query<ChannelAccessRow>(
    `
SELECT
  c.id,
  c.type,
  c."isPrivate",
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

async function getDirectChatForUser(chatId: string, userId: string) {
  const result = await db.query<DirectChatMembershipRow>(
    `
SELECT id, "userAId", "userBId"
FROM "DirectChat"
WHERE id = $1
  AND ("userAId" = $2 OR "userBId" = $2)
LIMIT 1
`,
    [chatId, userId]
  );

  if (!result.rowCount || result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
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

export type { SocketIOServer };

export function createSocketServer(app: FastifyInstance): SocketIOServer {
  const io = new Server(app.server, {
    cors: {
      origin: (origin, callback) => {
        callback(null, isAllowedCorsOrigin(origin));
      },
      credentials: true,
    },
  });

  const voiceMembers = new Map<string, Map<string, VoiceParticipant>>();

  function getRoomMembers(channelId: string): VoiceParticipant[] {
    const room = voiceMembers.get(channelId);
    if (!room) return [];
    return Array.from(room.values());
  }

  function emitVoiceParticipants(channelId: string) {
    io.to(`voice:${channelId}`).emit("voice:participants", {
      channelId,
      participants: getRoomMembers(channelId),
    });
  }

  async function emitChannelActivityMessage(channelId: string, authorId: string, content: string) {
    const channelResult = await db.query<{ id: string; type: "TEXT" | "VOICE" }>(
      'SELECT id, type FROM "Channel" WHERE id = $1 LIMIT 1',
      [channelId]
    );

    if (!channelResult.rowCount || channelResult.rowCount === 0) return;
    if (channelResult.rows[0].type !== "TEXT") return;

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

    const message = mapMessage(inserted.rows[0]);
    io.to(`channel:${channelId}`).emit("message:new", message);
  }

  async function emitIncomingCallNotification(
    socket: SocketWithUser,
    roomId: string,
    fromUser: {
      id: string;
      username: string;
    }
  ) {
    const parsedRoom = parseCallRoomId(roomId);

    if (parsedRoom.kind === "CHANNEL") {
      socket.to(`channel:${parsedRoom.id}`).emit("call:incoming", {
        roomId,
        kind: "CHANNEL",
        channelId: parsedRoom.id,
        fromUserId: fromUser.id,
        fromUsername: fromUser.username,
      });
      return;
    }

    const directChatResult = await db.query<DirectChatMembershipRow>(
      `
SELECT id, "userAId", "userBId"
FROM "DirectChat"
WHERE id = $1
LIMIT 1
`,
      [parsedRoom.id]
    );

    if (!directChatResult.rowCount || directChatResult.rowCount === 0) {
      return;
    }

    const directChat = directChatResult.rows[0];
    const recipientUserId = directChat.userAId === fromUser.id ? directChat.userBId : directChat.userAId;
    if (!recipientUserId || recipientUserId === fromUser.id) {
      return;
    }

    const blocked = await isBlockedBetweenUsers(fromUser.id, recipientUserId);
    if (blocked) {
      return;
    }

    io.to(`user:${recipientUserId}`).emit("call:incoming", {
      roomId,
      kind: "DM",
      directChatId: parsedRoom.id,
      fromUserId: fromUser.id,
      fromUsername: fromUser.username,
    });
  }

  async function emitCallCancelledNotification(roomId: string, fromUserId: string) {
    const parsedRoom = parseCallRoomId(roomId);
    if (parsedRoom.kind === "CHANNEL") {
      io.to(`channel:${parsedRoom.id}`).emit("call:cancelled", {
        roomId,
        kind: "CHANNEL",
        channelId: parsedRoom.id,
        fromUserId,
      });
      return;
    }

    if (parsedRoom.kind !== "DM") {
      return;
    }

    const directChatResult = await db.query<DirectChatMembershipRow>(
      `
SELECT id, "userAId", "userBId"
FROM "DirectChat"
WHERE id = $1
LIMIT 1
`,
      [parsedRoom.id]
    );

    if (!directChatResult.rowCount || directChatResult.rowCount === 0) {
      return;
    }

    const directChat = directChatResult.rows[0];
    const recipientUserId = directChat.userAId === fromUserId ? directChat.userBId : directChat.userAId;
    if (!recipientUserId || recipientUserId === fromUserId) {
      return;
    }

    io.to(`user:${recipientUserId}`).emit("call:cancelled", {
      roomId,
      kind: "DM",
      directChatId: parsedRoom.id,
      fromUserId,
    });
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== "string") {
      return next(new Error("Unauthorized"));
    }

    try {
      const payload = app.jwt.verify<{
        sub: string;
        email: string;
        username: string;
      }>(token);

      (socket as SocketWithUser).data.user = {
        id: payload.sub,
        email: payload.email,
        username: payload.username,
      };

      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const authedSocket = socket as SocketWithUser;
    const user = authedSocket.data.user;

    socket.join(`user:${user.id}`);

    socket.on("channel:join", async (payload) => {
      const parsed = channelRoomSchema.safeParse(payload);
      if (!parsed.success) return;

      const access = await getChannelAccess(parsed.data.channelId, user.id);
      if (!access || !access.canAccess) return;

      socket.join(`channel:${parsed.data.channelId}`);
    });

    socket.on("channel:leave", (payload) => {
      const parsed = channelRoomSchema.safeParse(payload);
      if (!parsed.success) return;

      socket.leave(`channel:${parsed.data.channelId}`);
    });

    socket.on("message:send", async (payload) => {
      const parsed = sendMessageSchema.safeParse(payload);
      if (!parsed.success) return;

      const { channelId, content } = parsed.data;

      const access = await getChannelAccess(channelId, user.id);
      if (!access || !access.canAccess) return;
      if (access.channel.type !== "TEXT") return;

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
        [randomUUID(), channelId, user.id, content]
      );

      const message = mapMessage(inserted.rows[0]);

      io.to(`channel:${channelId}`).emit("message:new", message);
    });

    socket.on("voice:join", async (payload) => {
      const parsed = channelRoomSchema.safeParse(payload);
      if (!parsed.success) return;

      const { channelId } = parsed.data;
      const rejectJoin = (reason: "BLOCKED" | "NO_ACCESS") => {
        socket.emit("voice:join-rejected", {
          channelId,
          reason,
        });
      };
      const parsedRoom = parseCallRoomId(channelId);
      if (parsedRoom.kind === "CHANNEL") {
        const access = await getChannelAccess(parsedRoom.id, user.id);
        if (!access || !access.canAccess) {
          rejectJoin("NO_ACCESS");
          return;
        }
      } else {
        const directChat = await getDirectChatForUser(parsedRoom.id, user.id);
        if (!directChat) {
          rejectJoin("NO_ACCESS");
          return;
        }

        const peerUserId = directChat.userAId === user.id ? directChat.userBId : directChat.userAId;
        const blocked = await isBlockedBetweenUsers(user.id, peerUserId);
        if (blocked) {
          rejectJoin("BLOCKED");
          return;
        }
      }

      const voiceRoomKey = `voice:${channelId}`;

      if (!voiceMembers.has(channelId)) {
        voiceMembers.set(channelId, new Map());
      }

      const room = voiceMembers.get(channelId)!;
      const shouldNotifyIncomingCall = room.size === 0;
      room.set(user.id, {
        id: user.id,
        username: user.username,
      });

      socket.join(voiceRoomKey);

      socket.to(voiceRoomKey).emit("voice:user-joined", {
        channelId,
        user: {
          id: user.id,
          username: user.username,
        },
      });

      emitVoiceParticipants(channelId);

      if (shouldNotifyIncomingCall) {
        try {
          await emitIncomingCallNotification(authedSocket, channelId, {
            id: user.id,
            username: user.username,
          });
          if (parsedRoom.kind === "CHANNEL") {
            await emitChannelActivityMessage(parsedRoom.id, user.id, "начал звонок");
          }
        } catch (error) {
          app.log.error({ err: error }, "Failed to emit incoming call notification");
        }
      }
    });

    socket.on("voice:leave", (payload) => {
      const parsed = channelRoomSchema.safeParse(payload);
      if (!parsed.success) return;

      const { channelId } = parsed.data;
      const voiceRoomKey = `voice:${channelId}`;
      const parsedRoom = parseCallRoomId(channelId);

      const room = voiceMembers.get(channelId);
      let roomBecameEmpty = false;
      if (room) {
        room.delete(user.id);
        if (room.size === 0) {
          roomBecameEmpty = true;
          voiceMembers.delete(channelId);
        }
      }

      socket.leave(voiceRoomKey);

      io.to(voiceRoomKey).emit("voice:user-left", {
        channelId,
        userId: user.id,
      });

      emitVoiceParticipants(channelId);

      if (parsedRoom.kind === "DM" && roomBecameEmpty) {
        void emitCallCancelledNotification(channelId, user.id).catch(() => undefined);
      }

      if (parsedRoom.kind === "CHANNEL" && roomBecameEmpty) {
        void emitChannelActivityMessage(parsedRoom.id, user.id, "завершил звонок").catch(() => undefined);
      }
    });

    socket.on("voice:signal", (payload) => {
      const parsed = voiceSignalSchema.safeParse(payload);
      if (!parsed.success) return;

      const { channelId, toUserId, data } = parsed.data;

      const parsedRoom = parseCallRoomId(channelId);
      if (parsedRoom.kind === "DM") {
        void (async () => {
          const directChat = await getDirectChatForUser(parsedRoom.id, user.id);
          if (!directChat) return;

          const peerUserId = directChat.userAId === user.id ? directChat.userBId : directChat.userAId;
          if (peerUserId !== toUserId) return;

          const blocked = await isBlockedBetweenUsers(user.id, peerUserId);
          if (blocked) return;

          io.to(`user:${toUserId}`).emit("voice:signal", {
            channelId,
            fromUserId: user.id,
            fromUsername: user.username,
            data,
          });
        })().catch(() => undefined);
        return;
      }

      io.to(`user:${toUserId}`).emit("voice:signal", {
        channelId,
        fromUserId: user.id,
        fromUsername: user.username,
        data,
      });
    });

    socket.on("disconnect", () => {
      for (const [channelId, room] of voiceMembers.entries()) {
        if (!room.has(user.id)) continue;

        room.delete(user.id);
        io.to(`voice:${channelId}`).emit("voice:user-left", {
          channelId,
          userId: user.id,
        });

        const parsedRoom = parseCallRoomId(channelId);
        const roomBecameEmpty = room.size === 0;
        if (roomBecameEmpty) {
          voiceMembers.delete(channelId);
        }

        emitVoiceParticipants(channelId);

        if (parsedRoom.kind === "DM" && roomBecameEmpty) {
          void emitCallCancelledNotification(channelId, user.id).catch(() => undefined);
        }

        if (parsedRoom.kind === "CHANNEL" && roomBecameEmpty) {
          void emitChannelActivityMessage(parsedRoom.id, user.id, "завершил звонок").catch(() => undefined);
        }
      }
    });
  });

  return io;
}
