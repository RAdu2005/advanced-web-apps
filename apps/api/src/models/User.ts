import { Schema, model, Types } from "mongoose";

export interface User {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<User>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

export const UserModel = model<User>("User", userSchema);
