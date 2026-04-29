import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { config, isAllowedCorsOrigin } from "./config.js";
import { db } from "./lib/db.js";
import { bootstrapSchema } from "./lib/bootstrapSchema.js";
import { ensureUploadsDir, getUploadsDir, MAX_CHAT_FILE_SIZE_BYTES } from "./lib/fileUploads.js";
import { authRoutes } from "./routes/auth.js";
import { channelRoutes } from "./routes/channels.js";
import { friendRoutes } from "./routes/friends.js";
import { dmRoutes } from "./routes/dms.js";
import { profileRoutes } from "./routes/profile.js";
import { uploadRoutes } from "./routes/uploads.js";
import { createSocketServer } from "./socket.js";
import { ensureDefaultChannels } from "./seed.js";

const app = Fastify({
  logger: true,
  bodyLimit: 30 * 1024 * 1024,
});

await app.register(cors, {
  origin: (origin, callback) => {
    callback(null, isAllowedCorsOrigin(origin));
  },
  credentials: true,
});

await app.register(jwt, {
  secret: config.JWT_SECRET,
});

await ensureUploadsDir();

await app.register(multipart, {
  limits: {
    fileSize: MAX_CHAT_FILE_SIZE_BYTES,
    files: 1,
  },
});

await app.register(fastifyStatic, {
  root: getUploadsDir(),
  prefix: "/uploads/",
});

app.decorate("authenticate", async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

app.get("/health", async () => ({ status: "ok" }));

await authRoutes(app);
await uploadRoutes(app);
await channelRoutes(app);
await friendRoutes(app);
await dmRoutes(app);
await profileRoutes(app);

const io = createSocketServer(app);
app.decorate("io", io);

await bootstrapSchema();
await ensureDefaultChannels();

const closeSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
for (const signal of closeSignals) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    await db.end();
    process.exit(0);
  });
}

try {
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`API listening on http://localhost:${config.PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
