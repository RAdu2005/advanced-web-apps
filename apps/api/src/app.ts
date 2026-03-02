import "express-async-errors";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { avatarUploadDir, defaultUserIconPath } from "./config/paths";
import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { documentsRouter } from "./routes/documents";
import { shareRouter } from "./routes/share";
import { errorHandler } from "./middleware/error-handler";

export const app = express();
const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin is not allowed"));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/uploads/avatars", express.static(avatarUploadDir));
app.get("/assets/user-icon", (_req, res) => {
  res.sendFile(defaultUserIconPath);
});

app.use("/auth", authRouter);
app.use("/documents", documentsRouter);
app.use("/share", shareRouter);

app.use(errorHandler);
