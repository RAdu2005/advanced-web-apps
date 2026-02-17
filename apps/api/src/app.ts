import "express-async-errors";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { documentsRouter } from "./routes/documents";
import { shareRouter } from "./routes/share";
import { errorHandler } from "./middleware/error-handler";

export const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRouter);
app.use("/documents", documentsRouter);
app.use("/share", shareRouter);

app.use(errorHandler);
