import { useAuth } from "@/hooks/useAuth";
import { AuthForm } from "@/components/AuthForm";
import Dashboard from "@/pages/Dashboard";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <AuthForm />;
  return <Dashboard />;
};

export default Index;
