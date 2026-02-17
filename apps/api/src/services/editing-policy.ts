import { Types } from "mongoose";
import { env } from "../config/env";
import { AppError } from "../middleware/error-handler";
import { EditingSessionModel } from "../models/EditingSession";

export interface EditingPolicy {
  start(documentId: string, userId: string): Promise<{ status: "acquired" | "already_owner"; leaseExpiresAt: Date }>;
  heartbeat(documentId: string, userId: string): Promise<{ leaseExpiresAt: Date }>;
  end(documentId: string, userId: string): Promise<void>;
  status(documentId: string): Promise<{ locked: boolean; userId?: string; leaseExpiresAt?: Date }>;
}

function nextLeaseDate(): Date {
  return new Date(Date.now() + env.EDIT_SESSION_TTL_SECONDS * 1000);
}

export class SingleWriterPolicy implements EditingPolicy {
  async start(documentId: string, userId: string): Promise<{ status: "acquired" | "already_owner"; leaseExpiresAt: Date }> {
    const now = new Date();
    const documentObjectId = new Types.ObjectId(documentId);
    const existing = await EditingSessionModel.findOne({ documentId: documentObjectId });

    if (existing && existing.leaseExpiresAt > now) {
      if (existing.userId.toString() === userId) {
        existing.leaseExpiresAt = nextLeaseDate();
        existing.lastHeartbeatAt = now;
        await existing.save();
        return { status: "already_owner", leaseExpiresAt: existing.leaseExpiresAt };
      }

      throw new AppError(409, "EDIT_LOCKED", "Document is currently being edited", {
        activeEditorUserId: existing.userId.toString(),
        leaseExpiresAt: existing.leaseExpiresAt
      });
    }

    if (existing) {
      await existing.deleteOne();
    }

    const leaseExpiresAt = nextLeaseDate();
    try {
      await EditingSessionModel.create({
        documentId: documentObjectId,
        userId: new Types.ObjectId(userId),
        leaseExpiresAt,
        lastHeartbeatAt: now
      });
    } catch (error) {
      const maybeMongoError = error as { code?: number };
      if (maybeMongoError.code !== 11000) {
        throw error;
      }

      const concurrent = await EditingSessionModel.findOne({ documentId: documentObjectId });
      if (!concurrent) {
        throw error;
      }

      if (concurrent.leaseExpiresAt <= new Date()) {
        await concurrent.deleteOne();
        const retryLease = nextLeaseDate();
        await EditingSessionModel.create({
          documentId: documentObjectId,
          userId: new Types.ObjectId(userId),
          leaseExpiresAt: retryLease,
          lastHeartbeatAt: now
        });
        return { status: "acquired", leaseExpiresAt: retryLease };
      }

      if (concurrent.userId.toString() === userId) {
        concurrent.leaseExpiresAt = nextLeaseDate();
        concurrent.lastHeartbeatAt = now;
        await concurrent.save();
        return { status: "already_owner", leaseExpiresAt: concurrent.leaseExpiresAt };
      }

      throw new AppError(409, "EDIT_LOCKED", "Document is currently being edited", {
        activeEditorUserId: concurrent.userId.toString(),
        leaseExpiresAt: concurrent.leaseExpiresAt
      });
    }

    return { status: "acquired", leaseExpiresAt };
  }

  async heartbeat(documentId: string, userId: string): Promise<{ leaseExpiresAt: Date }> {
    const session = await EditingSessionModel.findOne({
      documentId: new Types.ObjectId(documentId),
      userId: new Types.ObjectId(userId)
    });

    if (!session) {
      throw new AppError(409, "EDIT_SESSION_MISSING", "No active editing session");
    }

    session.lastHeartbeatAt = new Date();
    session.leaseExpiresAt = nextLeaseDate();
    await session.save();

    return { leaseExpiresAt: session.leaseExpiresAt };
  }

  async end(documentId: string, userId: string): Promise<void> {
    await EditingSessionModel.findOneAndDelete({
      documentId: new Types.ObjectId(documentId),
      userId: new Types.ObjectId(userId)
    });
  }

  async status(documentId: string): Promise<{ locked: boolean; userId?: string; leaseExpiresAt?: Date }> {
    const session = await EditingSessionModel.findOne({ documentId: new Types.ObjectId(documentId) }).lean();
    const now = new Date();

    if (!session || session.leaseExpiresAt <= now) {
      return { locked: false };
    }

    return {
      locked: true,
      userId: session.userId.toString(),
      leaseExpiresAt: session.leaseExpiresAt
    };
  }
}

export const editingPolicy: EditingPolicy = new SingleWriterPolicy();
