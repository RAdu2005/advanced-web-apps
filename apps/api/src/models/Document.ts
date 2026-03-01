import { Schema, model, Types } from "mongoose";

export interface Document {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  content: string;
  sharedReadToken?: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<Document>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: "" },
    sharedReadToken: { type: String, unique: true, sparse: true },
    deletedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

export const DocumentModel = model<Document>("Document", documentSchema);
