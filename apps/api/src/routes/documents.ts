import { Router } from "express";
import { Types } from "mongoose";
import { DocumentModel } from "../models/Document";
import { DocumentPermissionModel } from "../models/DocumentPermission";
import { EditingSessionModel } from "../models/EditingSession";
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

const MAX_TITLE_LENGTH = 120;

function normalizeBaseTitle(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "Untitled document";
  }

  const match = trimmed.match(/^(.*?)(?: - Copy(?: \((\d+)\))?)?$/);
  const base = (match?.[1] ?? trimmed).trim();
  return base || "Untitled document";
}

function buildClonedTitle(baseTitle: string, copyIndex: number): string {
  const suffix = copyIndex === 1 ? " - Copy" : ` - Copy (${copyIndex})`;
  const maxBaseLength = Math.max(1, MAX_TITLE_LENGTH - suffix.length);
  const clippedBase = baseTitle.slice(0, maxBaseLength).trimEnd() || "Document";
  return `${clippedBase}${suffix}`;
}

async function getActiveTitleSet(ownerId: Types.ObjectId, excludeDocumentId?: Types.ObjectId): Promise<Set<string>> {
  const query: { ownerId: Types.ObjectId; deletedAt: null; _id?: { $ne: Types.ObjectId } } = {
    ownerId,
    deletedAt: null
  };

  if (excludeDocumentId) {
    query._id = { $ne: excludeDocumentId };
  }

  const ownDocs = await DocumentModel.find(query).select({ title: 1 }).lean();
  return new Set(ownDocs.map((doc) => doc.title));
}

function getUniqueCreatedTitle(requestedTitle: string, existingTitles: Set<string>): string {
  const normalizedRequested = requestedTitle.trim() || "Untitled document";
  if (!existingTitles.has(normalizedRequested)) {
    return normalizedRequested;
  }

  const baseTitle = normalizeBaseTitle(normalizedRequested);
  let index = 1;
  let candidate = buildClonedTitle(baseTitle, index);
  while (existingTitles.has(candidate)) {
    index += 1;
    candidate = buildClonedTitle(baseTitle, index);
  }

  return candidate;
}

function toDriveDocument(doc: {
  _id: Types.ObjectId;
  title: string;
  content: string;
  ownerId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  sharedReadToken?: string;
  deletedAt: Date | null;
}) {
  return {
    id: doc._id,
    title: doc.title,
    content: doc.content,
    ownerId: doc.ownerId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    sharedReadToken: doc.sharedReadToken ?? null,
    deletedAt: doc.deletedAt
  };
}

documentsRouter.get("/", async (req, res) => {
  const userId = new Types.ObjectId(req.user!.id);

  const ownedDocs = await DocumentModel.find({ ownerId: userId, deletedAt: null }).lean();
  const permissions = await DocumentPermissionModel.find({ userId, role: "editor" }).lean();
  const permissionDocIds = permissions.map((p) => p.documentId);
  const editableDocs = permissionDocIds.length
    ? await DocumentModel.find({ _id: { $in: permissionDocIds }, deletedAt: null }).lean()
    : [];

  const docs = [...ownedDocs, ...editableDocs].map(toDriveDocument);

  res.json(docs);
});

documentsRouter.post("/", validateBody(createDocumentSchema), async (req, res) => {
  const { title, content } = req.body;
  const ownerId = new Types.ObjectId(req.user!.id);
  const existingTitles = await getActiveTitleSet(ownerId);
  const uniqueTitle = getUniqueCreatedTitle(title, existingTitles);

  const doc = await DocumentModel.create({
    ownerId,
    title: uniqueTitle,
    content
  });

  res.status(201).json(doc);
});

documentsRouter.post("/:id/clone", async (req, res) => {
  await assertCanAccessDocument(req.params.id, req.user!.id);

  const source = await DocumentModel.findById(req.params.id).lean();
  if (!source) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  }

  const ownerId = new Types.ObjectId(req.user!.id);
  const existingTitles = await getActiveTitleSet(ownerId);
  const baseTitle = normalizeBaseTitle(source.title);

  let index = 1;
  let clonedTitle = buildClonedTitle(baseTitle, index);
  while (existingTitles.has(clonedTitle)) {
    index += 1;
    clonedTitle = buildClonedTitle(baseTitle, index);
  }

  const cloned = await DocumentModel.create({
    ownerId,
    title: clonedTitle,
    content: source.content
  });

  res.status(201).json(cloned);
});

documentsRouter.get("/trash", async (req, res) => {
  const ownerId = new Types.ObjectId(req.user!.id);
  const trashed = await DocumentModel.find({ ownerId, deletedAt: { $ne: null } }).sort({ deletedAt: -1 }).lean();
  res.json(trashed.map(toDriveDocument));
});

documentsRouter.delete("/trash", async (req, res) => {
  const ownerId = new Types.ObjectId(req.user!.id);
  const trashed = await DocumentModel.find({ ownerId, deletedAt: { $ne: null } }).select({ _id: 1 }).lean();
  const ids = trashed.map((doc) => doc._id);

  if (ids.length > 0) {
    await DocumentPermissionModel.deleteMany({ documentId: { $in: ids } });
    await EditingSessionModel.deleteMany({ documentId: { $in: ids } });
    await DocumentModel.deleteMany({ _id: { $in: ids } });
  }

  res.json({ deletedCount: ids.length });
});

documentsRouter.post("/:id/restore", async (req, res) => {
  const ownerId = new Types.ObjectId(req.user!.id);
  const documentId = new Types.ObjectId(req.params.id);
  const trashed = await DocumentModel.findOne({ _id: documentId, ownerId, deletedAt: { $ne: null } }).lean();

  if (!trashed) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  }

  const existingTitles = await getActiveTitleSet(ownerId);
  const restoredTitle = getUniqueCreatedTitle(trashed.title, existingTitles);
  const restored = await DocumentModel.findOneAndUpdate(
    { _id: documentId, ownerId, deletedAt: { $ne: null } },
    { deletedAt: null, title: restoredTitle },
    { new: true }
  ).lean();

  if (!restored) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  }

  res.json(toDriveDocument(restored));
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

  const existing = await DocumentModel.findById(req.params.id);
  if (!existing || existing.deletedAt) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  }

  if (typeof req.body.title === "string") {
    const normalizedTitle = req.body.title.trim();
    const activeTitles = await getActiveTitleSet(existing.ownerId, existing._id);
    if (activeTitles.has(normalizedTitle)) {
      throw new AppError(409, "DOCUMENT_NAME_EXISTS", "A document with this name already exists");
    }

    req.body.title = normalizedTitle;
  }

  const doc = await DocumentModel.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
  if (!doc) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  }

  res.json(doc);
});

documentsRouter.delete("/:id", async (req, res) => {
  await assertOwner(req.params.id, req.user!.id);
  await DocumentModel.findByIdAndUpdate(req.params.id, { deletedAt: new Date() });
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
