import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import OpportunityCard from "./opportunity-card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Opportunity } from "@shared/schema";

interface PhaseConfig {
  key: string;
  title: string;
  icon: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
  description?: string;
  successMessage?: string;
  lossMessage?: string;
}

interface SalesPipelineColumnProps {
  phase: PhaseConfig;
  opportunities: Opportunity[];
  isLoading: boolean;
  onViewDetails?: (opportunity: Opportunity) => void;
}

export default function SalesPipelineColumn({ phase, opportunities, isLoading, onViewDetails }: SalesPipelineColumnProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const moveOpportunityMutation = useMutation({
    mutationFn: ({ opportunityId, newPhase }: { opportunityId: string; newPhase: string }) =>
      apiRequest("PATCH", `/api/opportunities/${opportunityId}/move/${newPhase}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Sucesso",
        description: "Oportunidade movida com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao mover oportunidade.",
        variant: "destructive",
      });
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const opportunityId = e.dataTransfer.getData("text/plain");
    if (opportunityId) {
      moveOpportunityMutation.mutate({ opportunityId, newPhase: phase.key });
    }
  };

  const renderIcon = () => {
    const iconClass = "text-gray-600 mr-2";
    switch (phase.icon) {
      case "lightbulb": return <span className={`fas fa-lightbulb ${iconClass}`} />;
      case "search": return <span className={`fas fa-search ${iconClass}`} />;
      case "headset": return <span className={`fas fa-headset ${iconClass}`} />;
      case "clipboard-check": return <span className={`fas fa-clipboard-check ${iconClass}`} />;
      case "file-contract": return <span className={`fas fa-file-contract ${iconClass}`} />;
      case "handshake": return <span className={`fas fa-handshake ${iconClass}`} />;
      case "trophy": return <span className={`fas fa-trophy ${iconClass}`} />;
      case "x-circle": return <span className={`fas fa-times-circle ${iconClass}`} />;
      default: return null;
    }
  };

  return (
    <div 
      className="flex-shrink-0 w-80"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-testid={`column-${phase.key}`}
    >
      <div className={`${phase.bgColor} rounded-lg ${phase.borderColor} border shadow-sm`}>
        {/* Header */}
        <div className={`p-4 border-b ${phase.borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {renderIcon()}
              <h3 className="text-lg font-semibold text-gray-900">{phase.title}</h3>
            </div>
            <Badge className={phase.badgeColor} data-testid={`count-${phase.key}`}>
              {opportunities.length}
            </Badge>
          </div>
          {phase.description && (
            <p className="text-sm text-gray-600 mt-1">{phase.description}</p>
          )}
        </div>

        {/* Opportunity Cards */}
        <div className="p-4 space-y-3" data-testid={`opportunities-${phase.key}`}>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : opportunities.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500">Nenhuma oportunidade nesta fase</p>
            </div>
          ) : (
            opportunities.map((opportunity) => (
              <OpportunityCard 
                key={opportunity.id} 
                opportunity={opportunity} 
                onViewDetails={onViewDetails}
              />
            ))
          )}
        </div>

        {/* Success/Loss Messages */}
        {phase.successMessage && (
          <div className={`p-4 border-t ${phase.borderColor}`}>
            <p className="text-sm text-gray-600 text-center">{phase.successMessage}</p>
          </div>
        )}
        
        {phase.lossMessage && (
          <div className={`p-4 border-t ${phase.borderColor}`}>
            <p className="text-sm text-gray-600 text-center">{phase.lossMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
