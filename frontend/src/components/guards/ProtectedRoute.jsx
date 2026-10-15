// Only logged-in users get through; everyone else goes to /login.
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/useAuth.js";
import PageLoading from "./PageLoading.jsx";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
