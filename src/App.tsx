import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import BrainDetail from "./pages/BrainDetail";
import Compare from "./pages/Compare";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import GeneralChat from "./pages/GeneralChat";
import AIOS from "./pages/AIOS";
import VirtualOffice from "./pages/VirtualOffice";
import UserProfileAI from "./pages/UserProfileAI";
import Settings from "./pages/Settings";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsProvider } from "./hooks/useSettings";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SquadSyncProvider } from "./contexts/SquadSyncContext";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppLayout = () => (
  <SquadSyncProvider>
    <AuthProvider>
      <BrowserRouter>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/brain/:id" element={<ProtectedRoute><BrainDetail /></ProtectedRoute>} />
            <Route path="/compare" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><GeneralChat /></ProtectedRoute>} />
            <Route path="/profile/ia" element={<ProtectedRoute><UserProfileAI /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/aios" element={<ProtectedRoute><AIOS /></ProtectedRoute>} />
            <Route path="/virtual-office" element={<ProtectedRoute><VirtualOffice /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </BrowserRouter>
    </AuthProvider>
  </SquadSyncProvider>
);

const App = () => (
  <ErrorBoundary>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SettingsProvider>
        <QueryClientProvider client={queryClient}>
          <AppLayout />
        </QueryClientProvider>
      </SettingsProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
