import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const redirectTo = (location.state as { from?: { pathname?: string } } | undefined)?.from?.pathname ?? "/drive";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String(e.message) : "Login failed";
      setError(message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center flex-col p-4">
      <div className="flex items-center justify-center flex-col pb-12">
        <h1 className="pb-1 font-bold text-3xl">Radu's Docshare</h1>
        <h2 className="text-lg text-slate-500 dark:text-slate-300">Enjoy your time!</h2>
      </div>

      <form className="w-full max-w-md rounded-lg bg-white p-6 shadow space-y-4 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700" onSubmit={handleSubmit}>
        <h1 className="text-xl font-semibold">Login</h1>
        <input
          className="w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className="w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded bg-slate-900 text-white py-2" type="submit">
          Login
        </button>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Don't have an account? <Link className="text-blue-700" to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}
