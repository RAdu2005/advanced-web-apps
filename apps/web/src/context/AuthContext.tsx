import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, type User } from "../api/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On first load ask backend if session cookie is still valid
    api.me()
      .then((me) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const loggedIn = await api.login({ email, password });
        setUser(loggedIn);
      },
      register: async (email, password, displayName) => {
        const registered = await api.register({ email, password, displayName });
        setUser(registered);
      },
      logout: async () => {
        await api.logout();
        setUser(null);
      },
      uploadAvatar: async (file) => {
        const updated = await api.uploadAvatar(file);
        setUser(updated);
      }
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

//Custom hook for handling auth state
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
