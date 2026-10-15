// Top bar: different links for logged-in and logged-out users.
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";

const linkClass = "rounded-md px-2 py-2 text-slate-700 hover:text-indigo-600";

export default function Navbar() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
        <Link to="/" className="text-lg font-bold text-slate-800">
          Library
        </Link>

        {/* Show nothing while the saved session is being checked, to avoid a flash of the wrong links */}
        {!loading && (
          <div className="flex flex-wrap items-center gap-1 text-sm sm:gap-3">
            {user ? (
              <>
                <Link to="/books" className={linkClass}>
                  Books
                </Link>
                <span className="max-w-[9rem] truncate text-slate-500" title={user.name}>
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-100"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={linkClass}>
                  Login
                </Link>
                <Link to="/register" className={linkClass}>
                  Register
                </Link>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
