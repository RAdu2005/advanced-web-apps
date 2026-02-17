import jwt from "jsonwebtoken";
import { env } from "../config/env";

export function signAccessToken(userId: string): string {
  const expiresIn = env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"];
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn });
}
