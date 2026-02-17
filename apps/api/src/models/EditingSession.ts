import { Schema, model, Types } from "mongoose";

export interface EditingSession {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  userId: Types.ObjectId;
  leaseExpiresAt: Date;
  lastHeartbeatAt: Date;
  createdAt: Date;
}

const editingSessionSchema = new Schema<EditingSession>(
  {
    documentId: { type: Schema.Types.ObjectId, required: true, ref: "Document", index: true, unique: true },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    leaseExpiresAt: { type: Date, required: true },
    lastHeartbeatAt: { type: Date, required: true }
  },
  { timestamps: true }
);

editingSessionSchema.index({ leaseExpiresAt: 1 }, { expireAfterSeconds: 0 });

export const EditingSessionModel = model<EditingSession>("EditingSession", editingSessionSchema);
