// Route guards, used as layout routes in App.jsx.
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";

function Loading() {
  return <p className="p-8 text-center text-slate-600">Loading...</p>;
}

// Only logged-in users get through; everyone else goes to /login
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Only logged-out users get through; logged-in users go to /books
export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) return <Navigate to="/books" replace />;
  return <Outlet />;
}
