import { Router } from "express";
import type { CookieOptions } from "express";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/User";
import { validateBody } from "../middleware/validate";
import { loginSchema, registerSchema } from "../validation/auth";
import { AppError } from "../middleware/error-handler";
import { signAccessToken } from "../services/token";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

const isProduction = process.env.NODE_ENV === "production";
const authCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  path: "/"
};

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

  res.status(201).json({ id: user._id, email: user.email, displayName: user.displayName });
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

  res.json({ id: user._id, email: user.email, displayName: user.displayName });
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

  res.json({ id: user._id, email: user.email, displayName: user.displayName });
});
