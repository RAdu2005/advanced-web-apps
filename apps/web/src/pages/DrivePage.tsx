import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import defaultUserIcon from "../../../../user_icon.png";
import { api, resolveApiAssetUrl, type DriveDocument } from "../api/client";
import { useAuth } from "../context/AuthContext";

function docId(doc: DriveDocument): string {
  // API can return either `id` or `_id` depending on endpoint shape.
  return doc.id ?? doc._id;
}

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function DrivePage() {
  const { logout, uploadAvatar, user } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<DriveDocument[]>([]);
  const [trashedDocuments, setTrashedDocuments] = useState<DriveDocument[]>([]);
  const [newTitle, setNewTitle] = useState("Untitled document");
  const [sortBy, setSortBy] = useState("updated_desc");
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [trashLoading, setTrashLoading] = useState(true);
  const avatarSrc = useMemo(() => {
    if (!user?.avatarUrl) {
      return defaultUserIcon;
    }
    return resolveApiAssetUrl(user.avatarUrl);
  }, [user?.avatarUrl]);

  const sortedDocuments = useMemo(() => {
    // Sort on a copied array so we never mutate React state directly.
    const docs = [...documents];

    docs.sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return a.title.localeCompare(b.title);
        case "name_desc":
          return b.title.localeCompare(a.title);
        case "created_asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "created_desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "updated_asc":
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case "updated_desc":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return docs;
  }, [documents, sortBy]);

  const sortedTrashedDocuments = useMemo(() => {
    const docs = [...trashedDocuments];
    // Newest deletions first so recent mistakes are easiest to restore.
    docs.sort((a, b) => {
      const left = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
      const right = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
      return right - left;
    });
    return docs;
  }, [trashedDocuments]);

  async function loadDriveData() {
    setLoading(true);
    setTrashLoading(true);
    try {
      // Load active docs + recycle bin together to keep the dashboard snappy.
      const [docs, trash] = await Promise.all([api.listDocuments(), api.listTrash()]);
      setDocuments(docs);
      setTrashedDocuments(trash);
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String(e.message) : "Failed to load";
      setError(message);
    } finally {
      setLoading(false);
      setTrashLoading(false);
    }
  }

  useEffect(() => {
    void loadDriveData();
  }, []);

  async function createDocument(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      await api.createDocument({ title: newTitle, content: "" });
      setNewTitle("Untitled document");
      await loadDriveData();
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String(e.message) : "Create failed";
      setError(message);
    }
  }

  async function renameDocument(id: string, title: string) {
    const nextTitle = window.prompt("New title", title);
    // Skip no-op renames to avoid unnecessary API calls.
    if (!nextTitle || nextTitle === title) return;
    await api.updateDocument(id, { title: nextTitle });
    await loadDriveData();
  }

  async function removeDocument(id: string) {
    // Delete here is soft-delete; item moves to recycle bin.
    await api.deleteDocument(id);
    await loadDriveData();
  }

  async function cloneDocument(id: string) {
    setError("");

    try {
      await api.cloneDocument(id);
      await loadDriveData();
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String(e.message) : "Clone failed";
      setError(message);
    }
  }

  async function restoreDocument(id: string) {
    setError("");
    try {
      await api.restoreDocument(id);
      await loadDriveData();
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String(e.message) : "Restore failed";
      setError(message);
    }
  }

  async function emptyRecycleBin() {
    setError("");
    try {
      await api.emptyTrash();
      await loadDriveData();
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String(e.message) : "Could not empty recycle bin";
      setError(message);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  function openAvatarPicker() {
    avatarInputRef.current?.click();
  }

  async function handleAvatarPicked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");

    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
      setError("Avatar must be PNG, JPG, or WEBP.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setError("Avatar must be 2MB or smaller.");
      event.target.value = "";
      return;
    }

    setAvatarUploading(true);
    try {
      await uploadAvatar(file);
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String(e.message) : "Could not upload avatar";
      setError(message);
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-lg bg-white p-4 shadow flex flex-col gap-3 md:flex-row md:justify-between md:items-center dark:bg-slate-800 dark:ring-1 dark:ring-slate-700">
          <div>
            <h1 className="text-2xl font-semibold">Cloud Drive</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Signed in as {user?.displayName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarPicked}
            />
            <button
              className="flex items-center gap-2 rounded border border-slate-300 px-2 py-1.5 text-left dark:border-slate-600 dark:text-slate-100"
              onClick={openAvatarPicker}
              type="button"
              disabled={avatarUploading}
              title="Upload profile icon"
            >
              <img src={avatarSrc} alt={`${user?.displayName ?? "User"} avatar`} className="h-8 w-8 rounded-full object-cover" />
              <span className="text-sm">
                {avatarUploading ? "Uploading..." : user?.displayName ?? "User"}
              </span>
            </button>
            <button className="rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:text-slate-100" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <form className="rounded-lg bg-white p-4 shadow flex flex-col gap-3 md:flex-row dark:bg-slate-800 dark:ring-1 dark:ring-slate-700" onSubmit={createDocument}>
          <input
            className="flex-1 rounded border p-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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

        <section className="rounded-lg bg-white p-4 shadow dark:bg-slate-800 dark:ring-1 dark:ring-slate-700">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold">My accessible documents</h2>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 dark:text-slate-300" htmlFor="sort-documents">Sort by</label>
              <select
                id="sort-documents"
                className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="updated_desc">Last edited (newest)</option>
                <option value="updated_asc">Last edited (oldest)</option>
                <option value="created_desc">Created (newest)</option>
                <option value="created_asc">Created (oldest)</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
              </select>
            </div>
          </div>
          {loading ? <p>Loading...</p> : null}
          {!loading && documents.length === 0 ? <p className="text-slate-600 dark:text-slate-300">No documents yet.</p> : null}
          <div className="space-y-3">
            {sortedDocuments.map((doc) => (
              <div key={docId(doc)} className="rounded border p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between dark:border-slate-600 dark:bg-slate-900">
                <div>
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Updated {new Date(doc.updatedAt).toLocaleString()}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Created {new Date(doc.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white" to={`/documents/${docId(doc)}`}>
                    Open
                  </Link>
                  <button className="rounded border px-3 py-1.5 text-sm dark:border-slate-600 dark:text-slate-100" onClick={() => void renameDocument(docId(doc), doc.title)}>
                    Rename
                  </button>
                  <button className="rounded border px-3 py-1.5 text-sm dark:border-slate-600 dark:text-slate-100" onClick={() => void cloneDocument(docId(doc))}>
                    Clone
                  </button>
                  {doc.ownerId === user?.id ? (
                    <button className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-400/60 dark:text-red-300" onClick={() => void removeDocument(docId(doc))}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg bg-white p-4 shadow dark:bg-slate-800 dark:ring-1 dark:ring-slate-700">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <button
              className="text-left text-lg font-semibold"
              onClick={() => setRecycleBinOpen((value) => !value)}
            >
              {recycleBinOpen ? "Hide recycle bin" : "Show recycle bin"} ({trashedDocuments.length})
            </button>
            {trashedDocuments.length > 0 ? (
              <button
                className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 dark:border-red-400/60 dark:text-red-300"
                onClick={() => void emptyRecycleBin()}
              >
                Empty recycle bin
              </button>
            ) : null}
          </div>

          {recycleBinOpen ? (
            <div className="mt-4 space-y-3">
              {trashLoading ? <p>Loading recycle bin...</p> : null}
              {!trashLoading && sortedTrashedDocuments.length === 0 ? (
                <p className="text-slate-600 dark:text-slate-300">Recycle bin is empty.</p>
              ) : null}

              {sortedTrashedDocuments.map((doc) => (
                <div
                  key={docId(doc)}
                  className="rounded border border-slate-200 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between dark:border-slate-600 dark:bg-slate-900"
                >
                  <div>
                    <p className="font-medium">{doc.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Deleted {doc.deletedAt ? new Date(doc.deletedAt).toLocaleString() : "-"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Created {new Date(doc.createdAt).toLocaleString()}</p>
                  </div>
                  <button
                    className="rounded border px-3 py-1.5 text-sm dark:border-slate-600 dark:text-slate-100"
                    onClick={() => void restoreDocument(docId(doc))}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
