import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import CrmDashboard from "@/pages/crm-dashboard";
import ReportsDashboard from "@/pages/reports-dashboard";
import SettingsPage from "@/pages/settings-page";
import Login from "@/pages/login";
import UserManagement from "@/pages/user-management";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogOut, Users, Home, BarChart3, Settings, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Component />;
}

function NavBar() {
  const { logout } = useAuth();
  const [location, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { path: "/", label: "Dashboard", icon: Home },
    { path: "/reports", label: "Relatórios", icon: BarChart3 },
    { path: "/users", label: "Usuários", icon: Users },
    { path: "/settings", label: "Configurações", icon: Settings },
  ];

  return (
    <nav className="bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center w-full md:w-auto justify-between md:justify-start">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-foreground">CRM Dashboard</h1>
            </div>
            
            {/* Mobile Menu Trigger */}
            <div className="md:hidden flex items-center">
              <ThemeToggle />
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-2">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[250px] sm:w-[300px]">
                  <SheetTitle className="sr-only">Menu de Navegação</SheetTitle>
                  <div className="flex flex-col space-y-4 mt-6">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.path;
                      return (
                        <button
                          key={item.path}
                          onClick={() => {
                            navigate(item.path);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                          }`}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {item.label}
                        </button>
                      );
                    })}
                    <div className="pt-4 border-t border-border">
                      <Button onClick={handleLogout} variant="ghost" size="sm" className="w-full justify-start">
                        <LogOut className="h-4 w-4 mr-2" />
                        Sair
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            <div className="flex space-x-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              <Button onClick={handleLogout} variant="ghost" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
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
    <div className="min-h-screen bg-background text-foreground">
      {isAuthenticated && <NavBar />}
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/users">
          <ProtectedRoute component={UserManagement} />
        </Route>
        <Route path="/reports">
          <ProtectedRoute component={ReportsDashboard} />
        </Route>
        <Route path="/settings">
          <ProtectedRoute component={SettingsPage} />
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