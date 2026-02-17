import { randomBytes } from "crypto";

export function generateShareToken(): string {
  return randomBytes(24).toString("hex");
}
