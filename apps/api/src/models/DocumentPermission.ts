import { Schema, model, Types } from "mongoose";

export type PermissionRole = "editor";

export interface DocumentPermission {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  userId: Types.ObjectId;
  role: PermissionRole;
}

const permissionSchema = new Schema<DocumentPermission>(
  {
    documentId: { type: Schema.Types.ObjectId, required: true, ref: "Document", index: true },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    role: { type: String, required: true, enum: ["editor"] }
  },
  { timestamps: true }
);

permissionSchema.index({ documentId: 1, userId: 1, role: 1 }, { unique: true });

export const DocumentPermissionModel = model<DocumentPermission>("DocumentPermission", permissionSchema);
