import "fastify";
import type { SocketIOServer } from "./socket.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
    io: SocketIOServer;
  }
}
