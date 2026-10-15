// Home page: links depend on whether the user is logged in.
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-md px-5 py-2 text-base font-medium";

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-slate-800 sm:text-4xl">Library Management System</h1>
      <p className="mt-3 text-slate-600">
        Manage your personal books, track what you are reading, and ask the AI assistant about your library.
      </p>

      {/* Show no links while the saved session is being checked */}
      {!loading && (
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {user ? (
            <Link to="/books" className={`${buttonClass} bg-indigo-600 text-white hover:bg-indigo-700`}>
              Go to my books
            </Link>
          ) : (
            <>
              <Link to="/login" className={`${buttonClass} bg-indigo-600 text-white hover:bg-indigo-700`}>
                Log in
              </Link>
              <Link
                to="/register"
                className={`${buttonClass} border border-slate-300 text-slate-700 hover:bg-slate-100`}
              >
                Register
              </Link>
            </>
          )}
        </div>
      )}
    </main>
  );
}
