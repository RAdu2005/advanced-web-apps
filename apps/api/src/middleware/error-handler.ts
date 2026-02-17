import { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message, details: err.details });
    return;
  }

  if (err instanceof Error && err.name === "ValidationError") {
    res.status(422).json({ code: "VALIDATION_ERROR", message: err.message });
    return;
  }

  if (err instanceof Error) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ code: "INTERNAL_SERVER_ERROR", message: err.message });
    return;
  }

  res.status(500).json({ code: "INTERNAL_SERVER_ERROR", message: "Unknown error" });
}
