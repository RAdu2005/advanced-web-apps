import { app } from "../src/app";
import { connectDatabase } from "../src/db/connect";
import { env } from "../src/config/env";

let initialized = false;

export default async function handler(req: unknown, res: unknown): Promise<void> {
  if (!initialized) {
    await connectDatabase(env.MONGO_URI);
    initialized = true;
  }

  app(req as never, res as never);
}
