import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

export function SharedPage() {
  const { token } = useParams();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    api.readShared(token)
      .then((doc) => {
        setTitle(doc.title);
        setContent(doc.content);
      })
      .catch((e) => {
        const message = typeof e === "object" && e && "message" in e ? String(e.message) : "Not found";
        setError(message);
      });
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-3xl rounded bg-white p-4 shadow space-y-3">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">{title}</h1>
          <Link to="/login" className="text-blue-700">Login</Link>
        </div>
        <div className="ql-snow">
          <div className="ql-editor min-h-[420px]" dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </div>
    </div>
  );
}
