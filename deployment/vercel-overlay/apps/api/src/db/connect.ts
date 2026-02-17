import mongoose from "mongoose";

let cachedConnection: typeof mongoose | null = null;

export async function connectDatabase(mongoUri: string): Promise<void> {
  if (cachedConnection || mongoose.connection.readyState === 1) {
    cachedConnection = mongoose;
    return;
  }

  cachedConnection = await mongoose.connect(mongoUri);
}
