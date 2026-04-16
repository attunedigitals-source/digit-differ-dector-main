import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import AdminLogin from "./pages/admin/Login.tsx";
import AdminDashboard from "./pages/admin/Dashboard.tsx";
import UserManagement from "./pages/admin/Users.tsx";
import RevenueAnalytics from "./pages/admin/Revenue.tsx";
import TradeMonitor from "./pages/admin/TradeMonitor.tsx";
import ChurnAnalytics from "./pages/admin/Churn.tsx";
import { AdminGuard } from "./components/AdminGuard.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          
          {/* Protected Admin Routes */}
          <Route path="/admin/dashboard" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
          <Route path="/admin/users" element={<AdminGuard><UserManagement /></AdminGuard>} />
          <Route path="/admin/revenue" element={<AdminGuard><RevenueAnalytics /></AdminGuard>} />
          <Route path="/admin/trades" element={<AdminGuard><TradeMonitor /></AdminGuard>} />
          <Route path="/admin/churn" element={<AdminGuard><ChurnAnalytics /></AdminGuard>} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
