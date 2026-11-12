import { Navigate, Outlet } from "react-router";
import { useAuth } from "./auth-context";

export function RequireAuth() {
  const { session } = useAuth();
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

/** Login and registration pages; signed-in users go straight to their tasks. */
export function GuestOnly() {
  const { session } = useAuth();
  return session ? <Navigate to="/" replace /> : <Outlet />;
}
