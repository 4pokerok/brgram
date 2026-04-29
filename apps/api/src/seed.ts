import { randomUUID } from "node:crypto";
import { db } from "./lib/db.js";

export async function ensureDefaultChannels() {
  const defaults = [
    {
      name: "general",
      description: "Main text channel",
      type: "TEXT",
    },
    {
      name: "lobby",
      description: "Main voice lobby",
      type: "VOICE",
    },
  ] as const;

  for (const channel of defaults) {
    const exists = await db.query<{ id: string }>('SELECT id FROM "Channel" WHERE name = $1 LIMIT 1', [
      channel.name,
    ]);

    if (!exists.rowCount || exists.rowCount === 0) {
      await db.query(
        'INSERT INTO "Channel" (id, name, description, type) VALUES ($1, $2, $3, $4)',
        [randomUUID(), channel.name, channel.description, channel.type]
      );
    }
  }
}
