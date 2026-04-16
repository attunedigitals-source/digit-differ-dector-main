import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AdminGuardProps {
  children: ReactNode;
}

export const AdminGuard = ({ children }: AdminGuardProps) => {
  const { user, profile, loading, profileLoading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect if both session and profile loading are done
    if (!loading && !profileLoading) {
      if (!user) {
        navigate("/admin/login");
      } else if (!isAdmin && profile) {
        toast.error("Unauthorized. Admin access only.");
        navigate("/");
      }
    }
  }, [user, isAdmin, loading, profileLoading, profile, navigate]);

  if (loading || (user && !profile && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          <p className="text-sm text-muted-foreground animate-pulse">Verifying credentials...</p>
        </div>
      </div>
    );
  }

  if (!user || (!isAdmin && !profileLoading)) {
    return null;
  }

  return <>{children}</>;
};
