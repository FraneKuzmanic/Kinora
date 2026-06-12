import { Navigate, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import type { AppRole } from "@/types/auth";

type AuthGuardProps = {
  allowedRoles?: AppRole[];
};

function AuthGuardLoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border border-[rgba(223,197,106,0.2)]" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-[var(--color-accent)] border-t-[var(--color-accent)]" />
        <div className="absolute inset-3 rounded-full border border-[rgba(223,197,106,0.25)]" />
        <div className="absolute inset-[18px] rounded-full bg-[rgba(223,197,106,0.18)] shadow-[0_0_24px_rgba(223,197,106,0.35)]" />
      </div>
    </div>
  );
}

export function AuthGuard({ allowedRoles }: AuthGuardProps) {
  const location = useLocation();
  const outletContext = useOutletContext();
  const { isAuthenticated, isLoading, isSigningOut, isTwoFactorRequired, role } = useAuth();

  if (isSigningOut) {
    return null;
  }

  if (isLoading) {
    return <AuthGuardLoadingState />;
  }

  if (isTwoFactorRequired) {
    return <Navigate to="/2fa" replace state={{ from: location }} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet context={outletContext} />;
}
