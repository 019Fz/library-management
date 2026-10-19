// Only admins get through; other users go to /books. This is for the UI only: the backend is the real check.
import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import { useAuth } from "../../context/useAuth.js";
import PageLoading from "./PageLoading.jsx";

export default function AdminRoute() {
  const { user, loading } = useAuth();
  // AppLayout gives its pages a context (the top-bar slot). This guard sits in between, so it passes it on.
  const context = useOutletContext();
  if (loading) return <PageLoading />;
  if (user?.role !== "admin") return <Navigate to="/books" replace />;
  return <Outlet context={context} />;
}
