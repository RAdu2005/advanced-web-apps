import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./db/connect";

async function startServer(): Promise<void> {
  await connectDatabase(env.MONGO_URI);
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
