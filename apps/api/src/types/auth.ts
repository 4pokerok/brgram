export type JwtPayload = {
  sub: string;
  email: string;
  username: string;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
};
