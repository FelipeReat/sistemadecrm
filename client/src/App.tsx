import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import CrmDashboard from "@/pages/crm-dashboard";
import Login from "@/pages/login";
import UserManagement from "@/pages/user-management";
import { Button } from "@/components/ui/button";
import { LogOut, Users, Home } from "lucide-react";
import { useEffect } from "react";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Component />;
}

function NavBar() {
  const { user, logout, isLogoutPending } = useAuth();
  const [location, navigate] = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">Sistema CRM</h1>
            <div className="hidden md:flex space-x-2">
              <Button
                variant={location === "/" ? "default" : "ghost"}
                onClick={() => navigate("/")}
                data-testid="nav-home"
              >
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              {user?.role === "admin" && (
                <Button
                  variant={location === "/users" ? "default" : "ghost"}
                  onClick={() => navigate("/users")}
                  data-testid="nav-users"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Usuários
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground" data-testid="text-user-name">
              Olá, {user?.name}
            </span>
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={isLogoutPending}
              data-testid="button-logout"
            >
              {isLogoutPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Redirect to dashboard if authenticated and on login page
  if (isAuthenticated && location === "/login") {
    window.location.href = "/";
    return null;
  }

  // Redirect to login if not authenticated and not on login page
  if (!isAuthenticated && location !== "/login") {
    window.location.href = "/login";
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {isAuthenticated && <NavBar />}
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/users">
          <ProtectedRoute component={UserManagement} />
        </Route>
        <Route path="/">
          <ProtectedRoute component={CrmDashboard} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
