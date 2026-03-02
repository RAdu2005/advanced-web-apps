import { env } from "../config/env";

export interface EditingPolicy {
  start(documentId: string, userId: string): Promise<{ status: "acquired" | "already_owner"; leaseExpiresAt: Date }>;
  heartbeat(documentId: string, userId: string): Promise<{ leaseExpiresAt: Date }>;
  end(documentId: string, userId: string): Promise<void>;
  status(documentId: string): Promise<{ locked: boolean; userId?: string; leaseExpiresAt?: Date }>;
}

function nextLeaseDate(): Date {
  return new Date(Date.now() + env.EDIT_SESSION_TTL_SECONDS * 1000);
}

export class MultiWriterPolicy implements EditingPolicy {
  async start(_documentId: string, _userId: string): Promise<{ status: "acquired"; leaseExpiresAt: Date }> {
    return { status: "acquired", leaseExpiresAt: nextLeaseDate() };
  }

  async heartbeat(_documentId: string, _userId: string): Promise<{ leaseExpiresAt: Date }> {
    return { leaseExpiresAt: nextLeaseDate() };
  }

  async end(_documentId: string, _userId: string): Promise<void> {
    return;
  }

  async status(_documentId: string): Promise<{ locked: boolean }> {
    return { locked: false };
  }
}

export const editingPolicy: EditingPolicy = new MultiWriterPolicy();
