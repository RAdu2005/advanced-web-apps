import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type DriveDocument } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface EditorPermission {
  userId: string;
  email: string;
}

function normalizeId(doc: DriveDocument): string {
  return doc.id ?? doc._id;
}

export function EditorPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [doc, setDoc] = useState<DriveDocument | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("Loading...");
  const [lockBlocked, setLockBlocked] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [editorEmail, setEditorEmail] = useState("");
  const [editorError, setEditorError] = useState("");
  const [editors, setEditors] = useState<EditorPermission[]>([]);
  const heartbeatRef = useRef<number | null>(null);

  const isOwner = useMemo(() => Boolean(doc && user && doc.ownerId === user.id), [doc, user]);

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

      const lock = await api.startEditSession(id);
      setLockBlocked(false);
      setStatus(lock.status === "already_owner" ? "Resumed previous editing session." : "Editing lock acquired.");

      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
      }
      heartbeatRef.current = window.setInterval(() => {
        void api.heartbeat(id).catch(() => {
          setStatus("Could not refresh editing lock. Please try to resume.");
          setLockBlocked(true);
        });
      }, 60_000);
    } catch (e) {
      const err = e as { code?: string; message?: string; details?: { activeEditorUserId?: string } };
      if (err.code === "EDIT_LOCKED") {
        setLockBlocked(true);
        setStatus(`Document is currently edited by user ${err.details?.activeEditorUserId ?? "unknown"}.`);
      } else {
        setStatus(err.message ?? "Could not load document");
      }
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
    return () => {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
      }
      if (id) {
        void api.endEditSession(id);
      }
    };
  }, [id]);

  useEffect(() => {
    void loadEditors();
  }, [id, isOwner]);

  async function saveDocument(event: FormEvent) {
    event.preventDefault();
    if (!id || lockBlocked) return;

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

  async function resumeEditing() {
    if (!id) return;
    await loadDocument();
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/drive" className="text-blue-700">Back to drive</Link>
          <p className="text-sm text-slate-600">{status}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <form className="rounded bg-white p-4 shadow lg:col-span-2 space-y-3" onSubmit={saveDocument}>
            <input
              className="w-full rounded border p-2 font-medium"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={lockBlocked}
            />
            <textarea
              className="h-[420px] w-full rounded border p-2"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={lockBlocked}
            />
            <div className="flex gap-2">
              <button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50" disabled={lockBlocked || !doc}>
                Save
              </button>
              {lockBlocked ? (
                <button className="rounded border px-4 py-2" type="button" onClick={resumeEditing}>
                  Resume editing
                </button>
              ) : null}
            </div>
          </form>

          <aside className="space-y-4">
            <section className="rounded bg-white p-4 shadow space-y-2">
              <h2 className="font-semibold">Share (read-only)</h2>
              {shareLink ? (
                <>
                  <input className="w-full rounded border p-2 text-sm" value={shareLink} readOnly />
                  <button className="w-full rounded border px-3 py-2" onClick={() => void navigator.clipboard.writeText(shareLink)}>
                    Copy link
                  </button>
                  {isOwner ? (
                    <button className="w-full rounded border border-red-300 px-3 py-2 text-red-700" onClick={() => void revokeShareLink()}>
                      Revoke link
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600">No active public link.</p>
                  {isOwner ? (
                    <button className="w-full rounded bg-blue-700 px-3 py-2 text-white" onClick={() => void generateShareLink()}>
                      Generate link
                    </button>
                  ) : null}
                </>
              )}
            </section>

            {isOwner ? (
              <section className="rounded bg-white p-4 shadow space-y-2">
                <h2 className="font-semibold">Editors</h2>
                <form className="flex gap-2" onSubmit={addEditor}>
                  <input
                    className="flex-1 rounded border p-2 text-sm"
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
                    <div key={editor.userId} className="flex items-center justify-between rounded border p-2 text-sm">
                      <span>{editor.email}</span>
                      <button className="text-red-700" onClick={() => void removeEditor(editor.userId)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  {editors.length === 0 ? <p className="text-sm text-slate-600">No additional editors.</p> : null}
                </div>
              </section>
            ) : null}
          </aside>
        </div>

        <p className="text-xs text-slate-500">Document ID: {doc ? normalizeId(doc) : "-"}</p>
      </div>
    </div>
  );
}
