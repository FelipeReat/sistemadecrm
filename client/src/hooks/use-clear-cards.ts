import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ClearCardsResponse {
  success: boolean;
  message: string;
  backupId?: number;
  deletedCount?: number;
}

interface CardsCountResponse {
  count: number;
}

interface CreateBackupResponse {
  success: boolean;
  backupId: number;
  message: string;
}

export function useClearCards() {
  const queryClient = useQueryClient();

  // Query para obter a contagem de cards
  const { data: cardsCount, isLoading: isCountLoading, error: countError } = useQuery({
    queryKey: ["/api/admin/kanban-cards-count"],
    queryFn: async (): Promise<number> => {
      const response = await fetch("/api/admin/kanban-cards-count", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data: CardsCountResponse = await response.json();
      return data.count;
    },
    staleTime: 30 * 1000, // 30 segundos
    refetchOnWindowFocus: false,
  });

  // Mutation para limpar todos os cards
  const clearCardsMutation = useMutation({
    mutationFn: async (): Promise<ClearCardsResponse> => {
      const response = await fetch("/api/admin/clear-kanban-cards", {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Erro no servidor" }));
        throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || "Cards limpos com sucesso!", {
        description: data.backupId 
          ? `Backup criado com ID: ${data.backupId}. ${data.deletedCount || 0} cards removidos.`
          : `${data.deletedCount || 0} cards removidos.`
      });
      
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kanban-cards-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (error) => {
      console.error("Erro ao limpar cards:", error);
      toast.error("Erro ao limpar cards", {
        description: error.message || "Ocorreu um erro inesperado"
      });
    },
  });

  // Mutation para criar backup manual
  const createBackupMutation = useMutation({
    mutationFn: async (): Promise<CreateBackupResponse> => {
      const response = await fetch("/api/backup/create-cards-backup", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Erro no servidor" }));
        throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success("Backup criado com sucesso!", {
        description: `Backup ID: ${data.backupId}`
      });
    },
    onError: (error) => {
      console.error("Erro ao criar backup:", error);
      toast.error("Erro ao criar backup", {
        description: error.message || "Ocorreu um erro inesperado"
      });
    },
  });

  return {
    // Estado dos dados
    cardsCount: cardsCount || 0,
    isCountLoading,
    countError,

    // Ações
    clearCards: clearCardsMutation.mutateAsync,
    createBackup: createBackupMutation.mutateAsync,

    // Estados das mutations
    isClearingCards: clearCardsMutation.isPending,
    isCreatingBackup: createBackupMutation.isPending,
    
    // Erros
    clearCardsError: clearCardsMutation.error,
    createBackupError: createBackupMutation.error,

    // Funções de reset
    resetClearCardsError: clearCardsMutation.reset,
    resetCreateBackupError: createBackupMutation.reset,
  };
}