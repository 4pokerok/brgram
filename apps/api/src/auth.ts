import type { FastifyRequest } from "fastify";
import type { JwtPayload, AuthUser } from "./types/auth.js";

export function getAuthUser(request: FastifyRequest): AuthUser {
  const payload = request.user as JwtPayload | undefined;

  if (!payload || !payload.sub || !payload.email || !payload.username) {
    throw new Error("Invalid auth payload");
  }

  return {
    id: payload.sub,
    email: payload.email,
    username: payload.username,
  };
}
