import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { 
  LayoutDashboard, 
  Users, 
  CircleDollarSign, 
  Activity, 
  TrendingDown, 
  LogOut, 
  ShieldCheck,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { icon: LayoutDashboard, label: "Overview", path: "/admin/dashboard" },
    { icon: Users, label: "User Management", path: "/admin/users" },
    { icon: CircleDollarSign, label: "Revenue & Subs", path: "/admin/revenue" },
    { icon: Activity, label: "Live Monitoring", path: "/admin/trades" },
    { icon: TrendingDown, label: "Churn Analytics", path: "/admin/churn" },
  ];

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/admin/login";
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary p-2 rounded-lg">
          <ShieldCheck className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-bold text-lg leading-tight">Admin OS</h2>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Command Center</p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      <div className="flex-1 px-4 py-6 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant={isActive ? "secondary" : "ghost"}
              className={`w-full justify-start gap-3 px-3 relative group transition-all ${
                isActive ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                navigate(item.path);
                setIsMobileMenuOpen(false);
              }}
            >
              <item.icon className={`w-4 h-4 ${isActive ? "text-primary" : "group-hover:text-primary transition-colors"}`} />
              <span className="text-sm font-medium">{item.label}</span>
              {isActive && <div className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />}
            </Button>
          );
        })}
      </div>

      <Separator className="bg-border/50" />

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-muted/30">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase">
            {profile?.email?.[0] || 'A'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-semibold truncate">{profile?.email}</p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{profile?.role}</p>
          </div>
        </div>
        
        <button
          className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col hidden lg:flex">
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-border bg-card/30 backdrop-blur px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Trigger */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 border-r-border">
                <NavContent />
              </SheetContent>
            </Sheet>
            
            <h1 className="text-lg md:text-xl font-bold tracking-tight truncate">{title}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] uppercase font-bold text-green-500 tracking-wider">Online</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
