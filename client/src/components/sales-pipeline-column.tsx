import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import OpportunityCard from "./opportunity-card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Opportunity } from "@shared/schema";

// Função para validar se uma oportunidade pode ser movida
const canMoveOpportunity = (opportunity: Opportunity, targetPhase: string): { canMove: boolean; message?: string } => {
  const currentPhase = opportunity.phase;
  
  // Definir a sequência correta das fases
  const phaseSequence = [
    'prospeccao',
    'em-atendimento', 
    'visita-tecnica',
    'proposta',
    'negociacao',
    'ganho'
  ];
  
  // Perdido pode ser acessado de qualquer fase
  if (targetPhase === 'perdido') {
    return { canMove: true };
  }
  
  const currentIndex = phaseSequence.indexOf(currentPhase);
  const targetIndex = phaseSequence.indexOf(targetPhase);
  
  // Não pode mover para trás (exceto para perdido)
  if (targetIndex < currentIndex) {
    return { 
      canMove: false, 
      message: "Não é possível retroceder fases. Apenas é possível avançar sequencialmente." 
    };
  }
  
  // Só pode avançar uma fase por vez
  if (targetIndex > currentIndex + 1) {
    return { 
      canMove: false, 
      message: "Você deve avançar uma fase por vez. Complete a fase atual antes de prosseguir." 
    };
  }
  
  // Validar se os campos obrigatórios da fase atual estão preenchidos
  const isCurrentPhaseComplete = validatePhaseCompletion(opportunity);
  if (!isCurrentPhaseComplete.isComplete) {
    return {
      canMove: false,
      message: `Complete os campos obrigatórios da fase atual: ${isCurrentPhaseComplete.missingFields?.join(', ')}`
    };
  }
  
  return { canMove: true };
};

// Função para validar se uma fase está completa
const validatePhaseCompletion = (opportunity: Opportunity): { isComplete: boolean; missingFields?: string[] } => {
  const missingFields: string[] = [];
  
  switch (opportunity.phase) {
    case 'prospeccao':
      if (!opportunity.opportunityNumber) missingFields.push('Número da oportunidade');
      if (!opportunity.salesperson) missingFields.push('Vendedor');
      if (!opportunity.businessTemperature) missingFields.push('Temperatura do negócio');
      break;
      
    case 'em-atendimento':
      if (!opportunity.salesperson) missingFields.push('Vendedor');
      if (!opportunity.businessTemperature) missingFields.push('Temperatura do negócio');
      break;
      
    case 'visita-tecnica':
      if (!opportunity.visitSchedule) missingFields.push('Data de agendamento da visita');
      if (!opportunity.visitDate) missingFields.push('Data de realização da visita');
      break;
      
    case 'proposta':
      if (!opportunity.budgetNumber) missingFields.push('Número da proposta');
      if (!opportunity.budget) missingFields.push('Valor da proposta');
      if (!opportunity.validityDate) missingFields.push('Data de validade');
      break;
      
    case 'negociacao':
      if (!opportunity.finalValue) missingFields.push('Valor final');
      if (!opportunity.negotiationInfo) missingFields.push('Informações da negociação');
      break;
  }
  
  return {
    isComplete: missingFields.length === 0,
    missingFields: missingFields.length > 0 ? missingFields : undefined
  };
};

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
    const opportunityData = e.dataTransfer.getData("text/plain");
    
    if (opportunityData) {
      try {
        const { opportunityId, opportunity } = JSON.parse(opportunityData);
        
        // Validar se a oportunidade pode ser movida
        const validation = canMoveOpportunity(opportunity, phase.key);
        
        if (!validation.canMove) {
          toast({
            title: "Movimento não permitido",
            description: validation.message,
            variant: "destructive",
          });
          return;
        }
        
        moveOpportunityMutation.mutate({ opportunityId, newPhase: phase.key });
      } catch (error) {
        // Fallback para formato antigo (apenas ID)
        const opportunityId = opportunityData;
        const opportunity = opportunities.find(opp => opp.id === opportunityId);
        
        if (opportunity) {
          const validation = canMoveOpportunity(opportunity, phase.key);
          
          if (!validation.canMove) {
            toast({
              title: "Movimento não permitido",
              description: validation.message,
              variant: "destructive",
            });
            return;
          }
        }
        
        moveOpportunityMutation.mutate({ opportunityId, newPhase: phase.key });
      }
    }
  };

  const renderIcon = () => {
    const iconClass = "text-white dark:text-white mr-2";
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
              <h3 className="text-lg font-semibold text-white dark:text-white">{phase.title}</h3>
            </div>
            <Badge className={phase.badgeColor} data-testid={`count-${phase.key}`}>
              {opportunities.length}
            </Badge>
          </div>
          {phase.description && (
            <p className="text-sm text-white dark:text-white mt-1 opacity-90">{phase.description}</p>
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
            <p className="text-sm text-white dark:text-white text-center opacity-90">{phase.successMessage}</p>
          </div>
        )}
        
        {phase.lossMessage && (
          <div className={`p-4 border-t ${phase.borderColor}`}>
            <p className="text-sm text-white dark:text-white text-center opacity-90">{phase.lossMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
