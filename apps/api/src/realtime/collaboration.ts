import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { Server, Socket } from "socket.io";
import { env } from "../config/env";
import { DocumentModel } from "../models/Document";
import { canAccessDocument } from "../services/document-access";

interface JwtPayload {
  userId: string;
}

interface RoomState {
  content: string;
  lastPersistedContent: string;
  flushTimer: NodeJS.Timeout | null;
  activeUsers: Map<string, string>;
}

interface JoinPayload {
  documentId?: string;
}

interface JoinAck {
  ok: boolean;
  code?: string;
  message?: string;
  content?: string;
  title?: string;
}

interface ContentPayload {
  content?: string;
}

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    documentId?: string;
  };
}

const ROOM_PREFIX = "document:";
const PERSIST_DEBOUNCE_MS = 600;
// Ephemeral per-room state so we can sync fast without hitting Mongo on every keypress.
const roomStates = new Map<string, RoomState>();

function roomName(documentId: string): string {
  return `${ROOM_PREFIX}${documentId}`;
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, entry) => {
      const equalIndex = entry.indexOf("=");
      if (equalIndex === -1) return acc;

      const key = entry.slice(0, equalIndex).trim();
      const value = entry.slice(equalIndex + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function extractHandshakeToken(socket: Socket): string | null {
  // Try auth payload first, then Authorization header, then fallback to cookie.
  const authToken =
    typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : null;

  if (authToken) return authToken;

  const headerToken = socket.handshake.headers.authorization;
  if (typeof headerToken === "string") {
    const [type, token] = headerToken.split(" ");
    if (type === "Bearer" && token) {
      return token;
    }
  }

  const cookies = parseCookieHeader(socket.handshake.headers.cookie);
  return cookies.token ?? null;
}

function getState(documentId: string, initialContent: string): RoomState {
  const existing = roomStates.get(documentId);
  if (existing) {
    return existing;
  }

  const next: RoomState = {
    content: initialContent,
    lastPersistedContent: initialContent,
    flushTimer: null,
    activeUsers: new Map()
  };
  roomStates.set(documentId, next);
  return next;
}

async function persistDocument(documentId: string, state: RoomState): Promise<void> {
  if (state.content === state.lastPersistedContent) {
    return;
  }

  await DocumentModel.findByIdAndUpdate(documentId, { content: state.content });
  state.lastPersistedContent = state.content;
}

function schedulePersist(documentId: string, state: RoomState): void {
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
  }

  // Debounce writes so rapid typing doesn't spam the database.
  state.flushTimer = setTimeout(() => {
    void persistDocument(documentId, state).catch(() => {
      // Ignore persistence errors in timer loop; editors can continue and retry on next change.
    });
    state.flushTimer = null;
  }, PERSIST_DEBOUNCE_MS);
}

function uniqueUserCount(state: RoomState): number {
  // One user can have multiple tabs/sockets open; count unique user IDs instead.
  return new Set(state.activeUsers.values()).size;
}

async function leaveDocument(io: Server, socket: AuthenticatedSocket): Promise<void> {
  const documentId = typeof socket.data.documentId === "string" ? socket.data.documentId : null;
  if (!documentId) {
    return;
  }

  const state = roomStates.get(documentId);
  if (!state) {
    socket.data.documentId = undefined;
    return;
  }

  state.activeUsers.delete(socket.id);

  if (state.activeUsers.size === 0) {
    // Last person out flushes pending edits and frees memory for this room.
    if (state.flushTimer) {
      clearTimeout(state.flushTimer);
      state.flushTimer = null;
    }
    await persistDocument(documentId, state);
    roomStates.delete(documentId);
  } else {
    io.to(roomName(documentId)).emit("presence_update", { count: uniqueUserCount(state) });
  }

  socket.data.documentId = undefined;
}

export function initializeCollaboration(httpServer: HttpServer): void {
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    }
  });

  io.use((socket, next) => {
    // Socket auth uses the same JWT secret as HTTP routes.
    const token = extractHandshakeToken(socket);
    if (!token) {
      next(new Error("UNAUTHENTICATED"));
      return;
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket) => {
    const authenticatedSocket = socket as AuthenticatedSocket;

    authenticatedSocket.on("join_document", async (payload: JoinPayload, callback?: (response: JoinAck) => void) => {
      const userId = typeof authenticatedSocket.data.userId === "string" ? authenticatedSocket.data.userId : null;
      const documentId = typeof payload?.documentId === "string" ? payload.documentId : "";

      if (!userId || !Types.ObjectId.isValid(documentId)) {
        callback?.({ ok: false, code: "BAD_REQUEST", message: "Invalid document id" });
        return;
      }

      try {
        const hasAccess = await canAccessDocument(documentId, userId);
        if (!hasAccess) {
          callback?.({ ok: false, code: "FORBIDDEN", message: "No access to this document" });
          return;
        }

        const doc = await DocumentModel.findById(documentId).lean();
        if (!doc || doc.deletedAt) {
          callback?.({ ok: false, code: "DOCUMENT_NOT_FOUND", message: "Document not found" });
          return;
        }

        await leaveDocument(io, authenticatedSocket);

        const state = getState(documentId, doc.content);
        state.activeUsers.set(authenticatedSocket.id, userId);

        authenticatedSocket.join(roomName(documentId));
        authenticatedSocket.data.documentId = documentId;

        callback?.({
          ok: true,
          content: state.content,
          title: doc.title
        });

        io.to(roomName(documentId)).emit("presence_update", { count: uniqueUserCount(state) });
      } catch (error) {
        const maybeError = error as { code?: string; message?: string };
        callback?.({
          ok: false,
          code: maybeError.code ?? "INTERNAL_SERVER_ERROR",
          message: maybeError.message ?? "Could not join document"
        });
      }
    });

    authenticatedSocket.on("content_update", async (payload: ContentPayload) => {
      const userId = typeof authenticatedSocket.data.userId === "string" ? authenticatedSocket.data.userId : null;
      const documentId = typeof authenticatedSocket.data.documentId === "string" ? authenticatedSocket.data.documentId : null;
      if (!userId || !documentId) {
        return;
      }

      const nextContent = typeof payload?.content === "string" ? payload.content : null;
      if (nextContent === null) {
        return;
      }

      const state = roomStates.get(documentId);
      if (!state) {
        return;
      }

      state.content = nextContent;
      schedulePersist(documentId, state);

      authenticatedSocket.to(roomName(documentId)).emit("content_update", {
        content: nextContent,
        updatedBy: userId
      });
    });

    authenticatedSocket.on("disconnect", () => {
      void leaveDocument(io, authenticatedSocket);
    });
  });
}
