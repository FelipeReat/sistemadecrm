import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useLocation } from "wouter";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoginPending, loginError } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    try {
      await login({ email, password });
      toast({
        title: "Sucesso",
        description: "Login realizado com sucesso!",
      });
      // Don't navigate manually, let the auth state change handle it
    } catch (error: any) {
      toast({
        title: "Erro de Login",
        description: error.message || "Erro ao fazer login",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-6 pb-8">
          {/* Logo circular */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>
          
          {/* Títulos */}
          <div className="text-center space-y-2">
            <CardTitle className="text-xl font-bold text-foreground">
              Sistema CRM
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Módulo de gestão de oportunidades
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Usuário
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Digite seu usuário"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoginPending}
                data-testid="input-email"
                required
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoginPending}
                  data-testid="input-password"
                  required
                  className="h-11"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoginPending}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {loginError && (
              <div className="text-sm text-red-600 dark:text-red-400 text-center">
                {loginError.message}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-medium"
              disabled={isLoginPending}
              data-testid="button-login"
            >
              {isLoginPending ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Entrando...</span>
                </div>
              ) : (
                "Entrar no Sistema"
              )}
            </Button>
          </form>
          
          {/* Texto do rodapé sobre cookies/política */}
          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground">
              Aceito os Termos de Uso e Política de Privacidade<br />
              do Sistema Interno da Empresa
            </p>
          </div>
          
          {/* Informações de login padrão - pode ser removido em produção */}
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Usuário: <strong>admin@crm.com</strong> | Senha: <strong>admin123</strong>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}