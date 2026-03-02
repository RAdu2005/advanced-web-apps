import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactQuill from "react-quill";
import { io, Socket } from "socket.io-client";
import { api, API_BASE_URL, type DriveDocument } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { downloadDocumentAsPdf } from "../utils/pdf";

interface EditorPermission {
  userId: string;
  email: string;
}

interface JoinAck {
  ok: boolean;
  message?: string;
  content?: string;
  title?: string;
}

interface ContentUpdatePayload {
  content: string;
  updatedBy?: string;
}

interface PresencePayload {
  count: number;
}

function normalizeId(doc: DriveDocument): string {
  return doc.id ?? doc._id;
}

const quillModules = {
  toolbar: [
    [{ header: [1, 2, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "code-block"],
    ["link"],
    ["clean"]
  ]
};

const quillFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "list",
  "bullet",
  "blockquote",
  "code-block",
  "link"
];

export function EditorPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [doc, setDoc] = useState<DriveDocument | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("Loading...");
  const [collaboratorCount, setCollaboratorCount] = useState(1);
  const [shareLink, setShareLink] = useState("");
  const [editorEmail, setEditorEmail] = useState("");
  const [editorError, setEditorError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [editors, setEditors] = useState<EditorPermission[]>([]);
  const quillRef = useRef<ReactQuill | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const sendTimerRef = useRef<number | null>(null);
  const initializedRealtimeRef = useRef(false);

  const isOwner = useMemo(() => Boolean(doc && user && doc.ownerId === user.id), [doc, user]);
  const collaboratorLabel = collaboratorCount === 1 ? "1 collaborator online" : `${collaboratorCount} collaborators online`;

  async function loadDocument() {
    if (!id) return;

    try {
      const loaded = await api.getDocument(id);
      setDoc(loaded);
      setTitle(loaded.title);
      setContent(loaded.content);

      if (loaded.sharedReadToken) {
        setShareLink(`${window.location.origin}/shared/${loaded.sharedReadToken}`);
      } else {
        setShareLink("");
      }

      setStatus("Connecting realtime collaboration...");
    } catch (e) {
      const err = e as { message?: string };
      setStatus(err.message ?? "Could not load document");
    }
  }

  async function loadEditors() {
    if (!id || !isOwner) return;
    try {
      const data = (await api.listEditors(id)) as EditorPermission[];
      setEditors(data);
    } catch {
      // Ignore optional panel failures in basic UI.
    }
  }

  useEffect(() => {
    void loadDocument();
  }, [id]);

  useEffect(() => {
    void loadEditors();
  }, [id, isOwner]);

  useEffect(() => {
    if (!id) return;

    initializedRealtimeRef.current = false;
    const socket = io(API_BASE_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_document", { documentId: id }, (ack: JoinAck) => {
        if (!ack?.ok) {
          setStatus(ack?.message ?? "Could not join collaboration room");
          return;
        }

        if (!initializedRealtimeRef.current) {
          setContent(typeof ack.content === "string" ? ack.content : "");
          if (typeof ack.title === "string") {
            setTitle(ack.title);
          }
          initializedRealtimeRef.current = true;
        }

        setStatus("Realtime connected.");
      });
    });

    socket.on("content_update", (payload: ContentUpdatePayload) => {
      if (typeof payload?.content !== "string") return;
      setContent(payload.content);
      setStatus("Changes synced.");
    });

    socket.on("presence_update", (payload: PresencePayload) => {
      if (typeof payload?.count !== "number") return;
      setCollaboratorCount(Math.max(1, payload.count));
    });

    socket.on("disconnect", () => {
      setStatus("Realtime disconnected. Reconnecting...");
    });

    socket.on("connect_error", () => {
      setStatus("Realtime connection failed.");
    });

    return () => {
      if (sendTimerRef.current) {
        window.clearTimeout(sendTimerRef.current);
        sendTimerRef.current = null;
      }

      socket.disconnect();
      socketRef.current = null;
      setCollaboratorCount(1);
    };
  }, [id]);

  function handleContentChange(nextContent: string, _delta: unknown, source: string) {
    setContent(nextContent);

    if (source !== "user") {
      return;
    }

    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    if (sendTimerRef.current) {
      window.clearTimeout(sendTimerRef.current);
    }

    sendTimerRef.current = window.setTimeout(() => {
      if (!socket.connected) {
        return;
      }

      socket.emit("content_update", { content: nextContent });
      setStatus("Syncing changes...");
    }, 120);
  }

  async function saveDocument(event: FormEvent) {
    event.preventDefault();
    if (!id) return;

    const updated = await api.updateDocument(id, { title, content });
    setDoc(updated);
    setStatus("Saved");
  }

  async function generateShareLink() {
    if (!id) return;
    const response = await api.createShareLink(id);
    setShareLink(`${window.location.origin}/shared/${response.token}`);
  }

  async function revokeShareLink() {
    if (!id) return;
    await api.revokeShareLink(id);
    setShareLink("");
  }

  async function addEditor(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setEditorError("");
    try {
      await api.addEditor(id, editorEmail);
      setEditorEmail("");
      await loadEditors();
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error ? String(error.message) : "Could not add editor";
      setEditorError(message);
    }
  }

  async function removeEditor(editorUserId: string) {
    if (!id) return;
    await api.removeEditor(id, editorUserId);
    await loadEditors();
  }

  async function downloadPdf() {
    const delta = quillRef.current?.getEditor().getContents();
    if (!delta) {
      setStatus("Could not export document to PDF.");
      return;
    }

    setPdfLoading(true);
    try {
      await downloadDocumentAsPdf({ title, delta });
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/drive" className="text-blue-700">Back to drive</Link>
          <div className="text-right">
            <p className="text-sm text-slate-600 dark:text-slate-300">{status}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{collaboratorLabel}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <form className="rounded bg-white p-4 shadow lg:col-span-2 space-y-3 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700" onSubmit={saveDocument}>
            <input
              className="w-full rounded border p-2 font-medium dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={content}
              onChange={handleContentChange}
              modules={quillModules}
              formats={quillFormats}
              className="h-[420px] [&_.ql-container]:h-[370px]"
            />
            <div className="flex gap-2">
              <button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50" disabled={!doc}>
                Save
              </button>
              <button
                className="rounded border px-4 py-2 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                type="button"
                onClick={() => void downloadPdf()}
                disabled={!doc || pdfLoading}
              >
                {pdfLoading ? "Generating PDF..." : "Download PDF"}
              </button>
            </div>
          </form>

          <aside className="space-y-4">
            <section className="rounded bg-white p-4 shadow space-y-2 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700">
              <h2 className="font-semibold">Share (read-only)</h2>
              {shareLink ? (
                <>
                  <input className="w-full rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" value={shareLink} readOnly />
                  <button className="w-full rounded border px-3 py-2 dark:border-slate-600 dark:text-slate-100" onClick={() => void navigator.clipboard.writeText(shareLink)}>
                    Copy link
                  </button>
                  {isOwner ? (
                    <button className="w-full rounded border border-red-300 px-3 py-2 text-red-700 dark:border-red-400/60 dark:text-red-300" onClick={() => void revokeShareLink()}>
                      Revoke link
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-300">No active public link.</p>
                  {isOwner ? (
                    <button className="w-full rounded bg-blue-700 px-3 py-2 text-white" onClick={() => void generateShareLink()}>
                      Generate link
                    </button>
                  ) : null}
                </>
              )}
            </section>

            {isOwner ? (
              <section className="rounded bg-white p-4 shadow space-y-2 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700">
                <h2 className="font-semibold">Editors</h2>
                <form className="flex gap-2" onSubmit={addEditor}>
                  <input
                    className="flex-1 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    type="email"
                    value={editorEmail}
                    onChange={(event) => {
                      setEditorEmail(event.target.value);
                      setEditorError("");
                    }}
                    placeholder="user@email.com"
                    required
                  />
                  <button className="rounded bg-slate-900 px-3 py-2 text-white text-sm">Add</button>
                </form>
                {editorError ? <p className="text-sm text-red-600">{editorError}</p> : null}
                <div className="space-y-2">
                  {editors.map((editor) => (
                    <div key={editor.userId} className="flex items-center justify-between rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-900">
                      <span>{editor.email}</span>
                      <button className="text-red-700 dark:text-red-300" onClick={() => void removeEditor(editor.userId)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  {editors.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">No additional editors.</p> : null}
                </div>
              </section>
            ) : null}
          </aside>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">Document ID: {doc ? normalizeId(doc) : "-"}</p>
      </div>
    </div>
  );
}
