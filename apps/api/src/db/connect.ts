import mongoose from "mongoose";

export async function connectDatabase(mongoUri: string): Promise<void> {
  await mongoose.connect(mongoUri);
}
