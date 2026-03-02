export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface DriveDocument {
  _id: string;
  id?: string;
  ownerId: string;
  title: string;
  content: string;
  sharedReadToken: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function resolveApiAssetUrl(url: string | null | undefined): string {
  if (!url) {
    return "";
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
  }

  return `${API_BASE_URL}/${url}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Centralized fetch wrapper so auth cookies/error handling stay consistent everywhere.
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    if (response.status === 204) {
      return undefined as T;
    }

    const error = (await response.json()) as ApiError;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

//Registering all API endpoints here so they aren't scattered throughout the project.
export const api = {
  register: (payload: { email: string; password: string; displayName: string }) =>
    request<User>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) =>
    request<User>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request<User>("/auth/me"),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return request<User>("/auth/avatar", { method: "POST", body: formData });
  },
  listDocuments: () => request<DriveDocument[]>("/documents"),
  listTrash: () => request<DriveDocument[]>("/documents/trash"),
  createDocument: (payload: { title: string; content: string }) =>
    request<DriveDocument>("/documents", { method: "POST", body: JSON.stringify(payload) }),
  cloneDocument: (id: string) => request<DriveDocument>(`/documents/${id}/clone`, { method: "POST" }),
  restoreDocument: (id: string) => request<DriveDocument>(`/documents/${id}/restore`, { method: "POST" }),
  emptyTrash: () => request<{ deletedCount: number }>("/documents/trash", { method: "DELETE" }),
  getDocument: (id: string) => request<DriveDocument>(`/documents/${id}`),
  updateDocument: (id: string, payload: Partial<Pick<DriveDocument, "title" | "content">>) =>
    request<DriveDocument>(`/documents/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteDocument: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),
  addEditor: (id: string, email: string) =>
    request<{ userId: string; email: string; role: string }>(`/documents/${id}/permissions/editors`, {
      method: "POST",
      body: JSON.stringify({ email })
    }),
  removeEditor: (id: string, userId: string) =>
    request<void>(`/documents/${id}/permissions/editors/${userId}`, { method: "DELETE" }),
  listEditors: (id: string) =>
    request<Array<{ userId: string; email: string }>>(`/documents/${id}/permissions/editors`),
  createShareLink: (id: string) => request<{ token: string }>(`/documents/${id}/share-link`, { method: "POST" }),
  revokeShareLink: (id: string) => request<void>(`/documents/${id}/share-link`, { method: "DELETE" }),
  readShared: (token: string) =>
    request<{ id: string; title: string; content: string; createdAt: string; updatedAt: string }>(`/share/${token}`),
  startEditSession: (id: string) => request<{ status: string; leaseExpiresAt: string }>(`/documents/${id}/edit-session/start`, { method: "POST" }),
  heartbeat: (id: string) => request<{ leaseExpiresAt: string }>(`/documents/${id}/edit-session/heartbeat`, { method: "POST" }),
  endEditSession: (id: string) => request<void>(`/documents/${id}/edit-session/end`, { method: "POST" }),
  editStatus: (id: string) =>
    request<{ locked: boolean; userId?: string; leaseExpiresAt?: string }>(`/documents/${id}/edit-session/status`)
};
