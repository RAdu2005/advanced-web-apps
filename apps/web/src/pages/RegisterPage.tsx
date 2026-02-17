import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      await register(email, password, displayName);
      navigate("/drive", { replace: true });
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String(e.message) : "Registration failed";
      setError(message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form className="w-full max-w-md rounded-lg bg-white p-6 shadow space-y-4" onSubmit={handleSubmit}>
        <h1 className="text-xl font-semibold">Register</h1>
        <input
          className="w-full rounded border p-2"
          type="text"
          placeholder="Display name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
        <input
          className="w-full rounded border p-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className="w-full rounded border p-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded bg-slate-900 text-white py-2" type="submit">
          Create account
        </button>
        <p className="text-sm text-slate-600">
          Already registered? <Link className="text-blue-700" to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
