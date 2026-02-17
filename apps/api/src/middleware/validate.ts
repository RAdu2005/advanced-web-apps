import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";
import { AppError } from "./error-handler";

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const message = firstIssue?.message ?? "Invalid request body";
      throw new AppError(422, "VALIDATION_ERROR", message, result.error.flatten());
    }

    req.body = result.data;
    next();
  };
}
