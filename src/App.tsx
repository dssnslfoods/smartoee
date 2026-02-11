import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Shopfloor from "./pages/Shopfloor";
import Supervisor from "./pages/Supervisor";
import Executive from "./pages/Executive";
import Admin from "./pages/Admin";
import ActivityLog from "./pages/ActivityLog";
import RecentActivity from "./pages/RecentActivity";
import Monitor from "./pages/Monitor";
import HelpCenter from "./pages/HelpCenter";
import PendingCounts from "./pages/PendingCounts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/shopfloor" element={<Shopfloor />} />
            <Route path="/supervisor" element={<Supervisor />} />
            <Route path="/executive" element={<Executive />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/activity-log" element={<ActivityLog />} />
            <Route path="/recent-activity" element={<RecentActivity />} />
            <Route path="/monitor" element={<Monitor />} />
            <Route path="/pending-counts" element={<PendingCounts />} />
            <Route path="/help" element={<HelpCenter />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
