import { Router } from "express";
import { DocumentModel } from "../models/Document";
import { AppError } from "../middleware/error-handler";

export const shareRouter = Router();

shareRouter.get("/:token", async (req, res) => {
  const doc = await DocumentModel.findOne({ sharedReadToken: req.params.token }).lean();
  if (!doc) {
    throw new AppError(404, "SHARED_DOCUMENT_NOT_FOUND", "Shared document not found");
  }

  res.json({
    id: doc._id,
    title: doc.title,
    content: doc.content,
    ownerId: doc.ownerId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  });
});
