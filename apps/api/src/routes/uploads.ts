import type { FastifyInstance } from "fastify";
import { isUploadTooLargeError, MAX_CHAT_FILE_SIZE_BYTES, saveUploadedFile } from "../lib/fileUploads.js";

const MAX_UPLOAD_SIZE_MB = Math.floor(MAX_CHAT_FILE_SIZE_BYTES / (1024 * 1024));

export async function uploadRoutes(app: FastifyInstance) {
  app.post("/uploads", { preHandler: app.authenticate }, async (request, reply) => {
    try {
      const file = await request.file({
        limits: {
          files: 1,
          fileSize: MAX_CHAT_FILE_SIZE_BYTES,
        },
      });

      if (!file) {
        return reply.code(400).send({ error: "File is required" });
      }

      const saved = await saveUploadedFile(file);
      return reply.code(201).send(saved);
    } catch (error) {
      if (isUploadTooLargeError(error)) {
        return reply.code(413).send({ error: `File is too large. Max size is ${MAX_UPLOAD_SIZE_MB} MB.` });
      }

      if (error instanceof Error && error.message === "File is empty") {
        return reply.code(400).send({ error: "File is empty" });
      }

      request.log.error({ err: error }, "Failed to upload file");
      return reply.code(500).send({ error: "Failed to upload file" });
    }
  });
}
