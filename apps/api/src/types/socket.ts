import type { Server, Socket } from "socket.io";

export type SocketIOServer = Server;
export type SocketWithUser = Socket & {
  data: {
    user: {
      id: string;
      email: string;
      username: string;
    };
  };
};
