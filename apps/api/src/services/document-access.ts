import { Types } from "mongoose";
import { AppError } from "../middleware/error-handler";
import { DocumentModel } from "../models/Document";
import { DocumentPermissionModel } from "../models/DocumentPermission";

export async function canAccessDocument(documentId: string, userId: string): Promise<boolean> {
  const doc = await DocumentModel.findById(documentId).lean();
  if (!doc) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  }

  if (doc.ownerId.toString() === userId) {
    return true;
  }

  const permission = await DocumentPermissionModel.findOne({
    documentId: doc._id,
    userId: new Types.ObjectId(userId),
    role: "editor"
  }).lean();

  return Boolean(permission);
}

export async function assertCanAccessDocument(documentId: string, userId: string): Promise<void> {
  const canAccess = await canAccessDocument(documentId, userId);
  if (!canAccess) {
    throw new AppError(403, "FORBIDDEN", "No access to this document");
  }
}

export async function assertOwner(documentId: string, userId: string): Promise<void> {
  const doc = await DocumentModel.findById(documentId).lean();
  if (!doc) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  }

  if (doc.ownerId.toString() !== userId) {
    throw new AppError(403, "FORBIDDEN", "Only the owner can perform this action");
  }
}
