import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook para sincronizar dados entre dashboard e relatórios
 * Centraliza a invalidação de queries para manter os dados consistentes
 */
export function useReportsSync() {
  const queryClient = useQueryClient();

  const invalidateAllData = () => {
    // Invalidate core data
    queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/users/salespeople"] });
    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    
    // Invalidate reports data
    queryClient.invalidateQueries({ queryKey: ["/api/reports/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/reports/monthly-trend"] });
  };

  const invalidateReports = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/reports/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/reports/monthly-trend"] });
  };

  const invalidateOpportunities = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    // Also invalidate reports since they depend on opportunities
    invalidateReports();
  };

  return {
    invalidateAllData,
    invalidateReports,
    invalidateOpportunities,
  };
}