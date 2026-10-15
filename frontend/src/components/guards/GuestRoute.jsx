// Only logged-out visitors get through; logged-in users go to /books.
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/useAuth.js";
import PageLoading from "./PageLoading.jsx";

export default function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoading />;
  if (user) return <Navigate to="/books" replace />;
  return <Outlet />;
}
