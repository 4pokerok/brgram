import { io, type Socket } from "socket.io-client";
import { API_URL } from "./env";

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
  }

  socket = io(API_URL, {
    transports: ["websocket"],
    auth: {
      token,
    },
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
