import { Router } from "express";
import type { CookieOptions } from "express";
import bcrypt from "bcryptjs";
import { mkdirSync } from "fs";
import { unlink } from "fs/promises";
import path from "path";
import multer from "multer";
import { avatarUploadDir } from "../config/paths";
import { UserModel } from "../models/User";
import { validateBody } from "../middleware/validate";
import { loginSchema, registerSchema } from "../validation/auth";
import { AppError } from "../middleware/error-handler";
import { signAccessToken } from "../services/token";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp"
};

const isProduction = process.env.NODE_ENV === "production";
const authCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  path: "/"
};

mkdirSync(avatarUploadDir, { recursive: true });

function avatarUrlFromPath(avatarPath: string | null | undefined): string | null {
  if (!avatarPath) {
    return null;
  }

  return `/uploads/avatars/${encodeURIComponent(avatarPath)}`;
}

function toAuthUser(user: { _id: { toString: () => string } | string; email: string; displayName: string; avatarPath?: string | null }) {
  const id = typeof user._id === "string" ? user._id : user._id.toString();

  return {
    id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: avatarUrlFromPath(user.avatarPath)
  };
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, avatarUploadDir);
    },
    filename: (req, file, callback) => {
      const extension = AVATAR_EXTENSION_BY_MIME[file.mimetype];
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const userId = req.user?.id ?? "anonymous";
      callback(null, `${userId}-${Date.now()}-${randomSuffix}${extension ?? path.extname(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: MAX_AVATAR_SIZE_BYTES
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
      callback(new AppError(400, "INVALID_FILE_TYPE", "Avatar must be PNG, JPG, or WEBP"));
      return;
    }
    callback(null, true);
  }
});

authRouter.post("/register", validateBody(registerSchema), async (req, res) => {
  const { email, password, displayName } = req.body;

  const existingUser = await UserModel.findOne({ email: email.toLowerCase() }).lean();
  if (existingUser) {
    throw new AppError(409, "EMAIL_IN_USE", "Email already in use");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({ email: email.toLowerCase(), passwordHash, displayName });

  const token = signAccessToken(user._id.toString());
  res.cookie("token", token, authCookieOptions);

  res.status(201).json(toAuthUser(user));
});

authRouter.post("/login", validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await UserModel.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const token = signAccessToken(user._id.toString());
  res.cookie("token", token, authCookieOptions);

  res.json(toAuthUser(user));
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token", authCookieOptions);
  res.status(204).send();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await UserModel.findById(req.user!.id).lean();
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  res.json(toAuthUser(user));
});

authRouter.post("/avatar", requireAuth, (req, res, next) => {
  avatarUpload.single("avatar")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      next(new AppError(413, "FILE_TOO_LARGE", "Avatar must be 2MB or smaller"));
      return;
    }

    next(err);
  });
}, async (req, res) => {
  if (!req.file) {
    throw new AppError(400, "FILE_REQUIRED", "Please upload an avatar image");
  }

  const user = await UserModel.findById(req.user!.id);
  if (!user) {
    await unlink(req.file.path).catch(() => undefined);
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  const previousAvatarPath = user.avatarPath;
  user.avatarPath = req.file.filename;
  await user.save();

  if (previousAvatarPath) {
    const previousPath = path.join(avatarUploadDir, path.basename(previousAvatarPath));
    await unlink(previousPath).catch(() => undefined);
  }

  res.json(toAuthUser(user));
});
