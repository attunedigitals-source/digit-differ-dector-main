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

  if (!user) {
    return null;
  }

  if (!isAdmin && !profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="bg-destructive/10 p-4 rounded-full">
            <ShieldCheck className="w-12 h-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Access Denied</h2>
            <p className="text-muted-foreground">
              Your account does not have the required administrative privileges to access this area. 
              If you believe this is an error, please contact the system administrator.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/")}>Return Home</Button>
            <Button variant="destructive" onClick={() => useAuth().signOut().then(() => navigate("/admin/login"))}>Log Out</Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

import { ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";

