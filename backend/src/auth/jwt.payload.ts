export interface JwtPayload {
  sub: string;           // userId
  email: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
}
