import { db } from "./db.js";

export async function bootstrapSchema() {
  await db.query(`
DO $$
BEGIN
  CREATE TYPE "ChannelType" AS ENUM ('TEXT', 'VOICE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
`);

  await db.query(`
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "username" TEXT NOT NULL UNIQUE,
  "avatarUrl" TEXT,
  "bio" TEXT,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

  await db.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT');
  await db.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bio" TEXT');

  await db.query(`
CREATE TABLE IF NOT EXISTS "Channel" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "avatarUrl" TEXT,
  "ownerId" TEXT,
  "isPrivate" BOOLEAN NOT NULL DEFAULT FALSE,
  "type" "ChannelType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Channel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
`);

  await db.query('ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT');
  await db.query('ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "ownerId" TEXT');
  await db.query('ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT FALSE');
  await db.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Channel_ownerId_fkey'
  ) THEN
    ALTER TABLE "Channel"
    ADD CONSTRAINT "Channel_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
`);

  await db.query(`
CREATE TABLE IF NOT EXISTS "ChannelMember" (
  "id" TEXT PRIMARY KEY,
  "channelId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
`);

  await db.query(`
CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT PRIMARY KEY,
  "channelId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "attachmentUrl" TEXT,
  "attachmentName" TEXT,
  "attachmentSize" BIGINT,
  "attachmentMimeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
`);

  await db.query('ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT');
  await db.query('ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentName" TEXT');
  await db.query('ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentSize" BIGINT');
  await db.query('ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentMimeType" TEXT');

  await db.query(`
CREATE TABLE IF NOT EXISTS "Passkey" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL UNIQUE,
  "publicKey" TEXT NOT NULL,
  "counter" INTEGER NOT NULL DEFAULT 0,
  "transports" TEXT[] NOT NULL DEFAULT '{}',
  "deviceType" TEXT NOT NULL DEFAULT 'singleDevice',
  "backedUp" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
`);

  await db.query(`
CREATE TABLE IF NOT EXISTS "Friendship" (
  "id" TEXT PRIMARY KEY,
  "requesterId" TEXT NOT NULL,
  "addresseeId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Friendship_no_self_request" CHECK ("requesterId" <> "addresseeId")
);
`);

  await db.query(`
CREATE TABLE IF NOT EXISTS "UserBlock" (
  "id" TEXT PRIMARY KEY,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserBlock_no_self_block" CHECK ("blockerId" <> "blockedId")
);
`);

  await db.query(`
CREATE TABLE IF NOT EXISTS "DirectChat" (
  "id" TEXT PRIMARY KEY,
  "userAId" TEXT NOT NULL,
  "userBId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectChat_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DirectChat_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DirectChat_order_check" CHECK ("userAId" < "userBId"),
  CONSTRAINT "DirectChat_no_self_chat" CHECK ("userAId" <> "userBId")
);
`);

  await db.query(`
CREATE TABLE IF NOT EXISTS "DirectMessage" (
  "id" TEXT PRIMARY KEY,
  "chatId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "attachmentUrl" TEXT,
  "attachmentName" TEXT,
  "attachmentSize" BIGINT,
  "attachmentMimeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "DirectChat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DirectMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
`);

  await db.query('ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT');
  await db.query('ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "attachmentName" TEXT');
  await db.query('ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "attachmentSize" BIGINT');
  await db.query('ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "attachmentMimeType" TEXT');

  await db.query('CREATE INDEX IF NOT EXISTS "Channel_type_idx" ON "Channel"("type")');
  await db.query('CREATE INDEX IF NOT EXISTS "Channel_ownerId_idx" ON "Channel"("ownerId")');
  await db.query('CREATE INDEX IF NOT EXISTS "Channel_isPrivate_idx" ON "Channel"("isPrivate")');
  await db.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS "ChannelMember_channel_user_key" ON "ChannelMember"("channelId", "userId")'
  );
  await db.query('CREATE INDEX IF NOT EXISTS "ChannelMember_channel_idx" ON "ChannelMember"("channelId")');
  await db.query('CREATE INDEX IF NOT EXISTS "ChannelMember_user_idx" ON "ChannelMember"("userId")');
  await db.query(
    'CREATE INDEX IF NOT EXISTS "Message_channelId_createdAt_idx" ON "Message"("channelId", "createdAt")'
  );
  await db.query(
    'CREATE INDEX IF NOT EXISTS "Message_authorId_createdAt_idx" ON "Message"("authorId", "createdAt")'
  );
  await db.query('CREATE INDEX IF NOT EXISTS "Passkey_userId_idx" ON "Passkey"("userId")');
  await db.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_requester_addressee_key" ON "Friendship"("requesterId", "addresseeId")'
  );
  await db.query(
    'CREATE INDEX IF NOT EXISTS "Friendship_requester_status_idx" ON "Friendship"("requesterId", "status")'
  );
  await db.query(
    'CREATE INDEX IF NOT EXISTS "Friendship_addressee_status_idx" ON "Friendship"("addresseeId", "status")'
  );
  await db.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS "UserBlock_blocker_blocked_key" ON "UserBlock"("blockerId", "blockedId")'
  );
  await db.query('CREATE INDEX IF NOT EXISTS "UserBlock_blocker_idx" ON "UserBlock"("blockerId")');
  await db.query('CREATE INDEX IF NOT EXISTS "UserBlock_blocked_idx" ON "UserBlock"("blockedId")');
  await db.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS "DirectChat_users_key" ON "DirectChat"("userAId", "userBId")'
  );
  await db.query('CREATE INDEX IF NOT EXISTS "DirectChat_userA_idx" ON "DirectChat"("userAId")');
  await db.query('CREATE INDEX IF NOT EXISTS "DirectChat_userB_idx" ON "DirectChat"("userBId")');
  await db.query(
    'CREATE INDEX IF NOT EXISTS "DirectMessage_chat_createdAt_idx" ON "DirectMessage"("chatId", "createdAt")'
  );
  await db.query(
    'CREATE INDEX IF NOT EXISTS "DirectMessage_author_createdAt_idx" ON "DirectMessage"("authorId", "createdAt")'
  );
}
