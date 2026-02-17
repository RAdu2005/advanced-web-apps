import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./error-handler";

interface JwtPayload {
  userId: string;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.token ?? extractBearerToken(req);
  if (!token) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { id: payload.userId };
    next();
  } catch {
    throw new AppError(401, "UNAUTHENTICATED", "Invalid token");
  }
}
