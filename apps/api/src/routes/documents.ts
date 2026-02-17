import { Router } from "express";
import { Types } from "mongoose";
import { DocumentModel } from "../models/Document";
import { DocumentPermissionModel } from "../models/DocumentPermission";
import { UserModel } from "../models/User";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { addEditorSchema, createDocumentSchema, updateDocumentSchema } from "../validation/document";
import { AppError } from "../middleware/error-handler";
import { assertCanAccessDocument, assertOwner } from "../services/document-access";
import { generateShareToken } from "../services/share-token";
import { editingPolicy } from "../services/editing-policy";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.get("/", async (req, res) => {
  const userId = new Types.ObjectId(req.user!.id);

  const ownedDocs = await DocumentModel.find({ ownerId: userId }).lean();
  const permissions = await DocumentPermissionModel.find({ userId, role: "editor" }).lean();
  const permissionDocIds = permissions.map((p) => p.documentId);
  const editableDocs = permissionDocIds.length
    ? await DocumentModel.find({ _id: { $in: permissionDocIds } }).lean()
    : [];

  const docs = [...ownedDocs, ...editableDocs].map((doc) => ({
    id: doc._id,
    title: doc.title,
    content: doc.content,
    ownerId: doc.ownerId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    sharedReadToken: doc.sharedReadToken ?? null
  }));

  res.json(docs);
});

documentsRouter.post("/", validateBody(createDocumentSchema), async (req, res) => {
  const { title, content } = req.body;
  const doc = await DocumentModel.create({
    ownerId: new Types.ObjectId(req.user!.id),
    title,
    content
  });

  res.status(201).json(doc);
});

documentsRouter.get("/:id", async (req, res) => {
  await assertCanAccessDocument(req.params.id, req.user!.id);

  const doc = await DocumentModel.findById(req.params.id).lean();
  if (!doc) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  }

  res.json(doc);
});

documentsRouter.patch("/:id", validateBody(updateDocumentSchema), async (req, res) => {
  await assertCanAccessDocument(req.params.id, req.user!.id);

  const lockStatus = await editingPolicy.status(req.params.id);
  if (lockStatus.locked && lockStatus.userId !== req.user!.id) {
    throw new AppError(409, "EDIT_LOCKED", "Document is currently being edited", lockStatus);
  }

  const doc = await DocumentModel.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
  if (!doc) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  }

  res.json(doc);
});

documentsRouter.delete("/:id", async (req, res) => {
  await assertOwner(req.params.id, req.user!.id);
  await DocumentModel.findByIdAndDelete(req.params.id);
  await DocumentPermissionModel.deleteMany({ documentId: new Types.ObjectId(req.params.id) });
  res.status(204).send();
});

documentsRouter.post("/:id/permissions/editors", validateBody(addEditorSchema), async (req, res) => {
  await assertOwner(req.params.id, req.user!.id);
  const { email } = req.body;

  const user = await UserModel.findOne({ email: email.toLowerCase() }).lean();
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  if (user._id.toString() === req.user!.id) {
    throw new AppError(400, "INVALID_EDITOR", "Owner already has full permissions");
  }

  await DocumentPermissionModel.findOneAndUpdate(
    {
      documentId: new Types.ObjectId(req.params.id),
      userId: user._id,
      role: "editor"
    },
    {},
    { upsert: true, new: true }
  );

  res.status(201).json({ userId: user._id, email: user.email, role: "editor" });
});

documentsRouter.delete("/:id/permissions/editors/:userId", async (req, res) => {
  await assertOwner(req.params.id, req.user!.id);
  await DocumentPermissionModel.findOneAndDelete({
    documentId: new Types.ObjectId(req.params.id),
    userId: new Types.ObjectId(req.params.userId),
    role: "editor"
  });

  res.status(204).send();
});

documentsRouter.get("/:id/permissions/editors", async (req, res) => {
  await assertOwner(req.params.id, req.user!.id);

  const permissions = await DocumentPermissionModel.find({
    documentId: new Types.ObjectId(req.params.id),
    role: "editor"
  }).lean();

  const userIds = permissions.map((permission) => permission.userId);
  const users = userIds.length
    ? await UserModel.find({ _id: { $in: userIds } }).select({ email: 1 }).lean()
    : [];

  const data = permissions.map((permission) => {
    const user = users.find((item) => item._id.toString() === permission.userId.toString());
    return {
      userId: permission.userId,
      email: user?.email ?? "unknown"
    };
  });

  res.json(data);
});

documentsRouter.post("/:id/share-link", async (req, res) => {
  await assertOwner(req.params.id, req.user!.id);

  const token = generateShareToken();
  const updated = await DocumentModel.findByIdAndUpdate(
    req.params.id,
    { sharedReadToken: token },
    { new: true }
  ).lean();

  if (!updated) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  }

  res.json({ token });
});

documentsRouter.delete("/:id/share-link", async (req, res) => {
  await assertOwner(req.params.id, req.user!.id);

  await DocumentModel.findByIdAndUpdate(req.params.id, { $unset: { sharedReadToken: 1 } });
  res.status(204).send();
});

documentsRouter.post("/:id/edit-session/start", async (req, res) => {
  await assertCanAccessDocument(req.params.id, req.user!.id);
  const result = await editingPolicy.start(req.params.id, req.user!.id);
  res.json(result);
});

documentsRouter.post("/:id/edit-session/heartbeat", async (req, res) => {
  await assertCanAccessDocument(req.params.id, req.user!.id);
  const result = await editingPolicy.heartbeat(req.params.id, req.user!.id);
  res.json(result);
});

documentsRouter.post("/:id/edit-session/end", async (req, res) => {
  await assertCanAccessDocument(req.params.id, req.user!.id);
  await editingPolicy.end(req.params.id, req.user!.id);
  res.status(204).send();
});

documentsRouter.get("/:id/edit-session/status", async (req, res) => {
  await assertCanAccessDocument(req.params.id, req.user!.id);
  const result = await editingPolicy.status(req.params.id);
  res.json(result);
});
