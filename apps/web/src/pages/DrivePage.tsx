import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type DriveDocument } from "../api/client";
import { useAuth } from "../context/AuthContext";

function docId(doc: DriveDocument): string {
  return doc.id ?? doc._id;
}

export function DrivePage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DriveDocument[]>([]);
  const [newTitle, setNewTitle] = useState("Untitled document");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadDocuments() {
    setLoading(true);
    try {
      const docs = await api.listDocuments();
      setDocuments(docs);
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String(e.message) : "Failed to load";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  async function createDocument(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      await api.createDocument({ title: newTitle, content: "" });
      setNewTitle("Untitled document");
      await loadDocuments();
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String(e.message) : "Create failed";
      setError(message);
    }
  }

  async function renameDocument(id: string, title: string) {
    const nextTitle = window.prompt("New title", title);
    if (!nextTitle || nextTitle === title) return;
    await api.updateDocument(id, { title: nextTitle });
    await loadDocuments();
  }

  async function removeDocument(id: string) {
    await api.deleteDocument(id);
    await loadDocuments();
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-lg bg-white p-4 shadow flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
          <div>
            <h1 className="text-2xl font-semibold">Cloud Drive</h1>
            <p className="text-sm text-slate-600">Signed in as {user?.displayName}</p>
          </div>
          <button className="rounded border border-slate-300 px-3 py-2" onClick={handleLogout}>
            Logout
          </button>
        </header>

        <form className="rounded-lg bg-white p-4 shadow flex flex-col gap-3 md:flex-row" onSubmit={createDocument}>
          <input
            className="flex-1 rounded border p-2"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Document title"
            required
          />
          <button className="rounded bg-slate-900 px-4 py-2 text-white" type="submit">
            Create document
          </button>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <section className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-4 text-lg font-semibold">My accessible documents</h2>
          {loading ? <p>Loading...</p> : null}
          {!loading && documents.length === 0 ? <p className="text-slate-600">No documents yet.</p> : null}
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={docId(doc)} className="rounded border p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-xs text-slate-500">Updated {new Date(doc.updatedAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white" to={`/documents/${docId(doc)}`}>
                    Open
                  </Link>
                  <button className="rounded border px-3 py-1.5 text-sm" onClick={() => void renameDocument(docId(doc), doc.title)}>
                    Rename
                  </button>
                  {doc.ownerId === user?.id ? (
                    <button className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700" onClick={() => void removeDocument(docId(doc))}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
