import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./db/connect";
import { createServer } from "http";
import { initializeCollaboration } from "./realtime/collaboration";

async function startServer(): Promise<void> {
  await connectDatabase(env.MONGO_URI);
  const httpServer = createServer(app);
  initializeCollaboration(httpServer);

  httpServer.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
