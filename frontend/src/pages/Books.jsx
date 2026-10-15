// Placeholder for the books page (replaced in Part B).
import { useAuth } from "../context/useAuth.js";

export default function Books() {
  const { user } = useAuth();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800">Welcome, {user.name}</h1>
      <p className="mt-2 text-slate-600">Your role: {user.role}</p>
    </main>
  );
}
