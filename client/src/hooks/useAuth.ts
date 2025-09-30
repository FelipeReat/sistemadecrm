import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, LoginCredentials } from "@shared/schema";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false,
    queryFn: async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        
        if (response.status === 401) {
          return null; // Return null for unauthorized instead of throwing
        }
        
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.statusText}`);
        }
        
        return response.json();
      } catch (error) {
        console.error("Auth query error:", error);
        return null;
      }
    }
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Erro no servidor" }));
        throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Set the user data directly in the cache instead of invalidating
      queryClient.setQueryData(["/api/auth/me"], data.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      window.location.href = "/login";
    },
  });

  return {
    user: user as User | undefined,
    isLoading,
    isAuthenticated: !!user && !error,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoginPending: loginMutation.isPending,
    isLogoutPending: logoutMutation.isPending,
    loginError: loginMutation.error,
  };
}