import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

//Self-explainatory redirect for routes requiring an account
export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
