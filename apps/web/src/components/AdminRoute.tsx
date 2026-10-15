import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/** Gates admin-only routes (staff, audit). Assumes it sits inside ProtectedRoute. */
export function AdminRoute() {
  const { user } = useAuth();
  if (user && user.role !== "admin") {
    return <Navigate to="/accounts" replace />;
  }
  return <Outlet />;
}
