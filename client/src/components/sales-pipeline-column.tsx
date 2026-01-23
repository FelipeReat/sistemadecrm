import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import OpportunityCard from "./opportunity-card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useReportsSync } from "@/hooks/useReportsSync";
import { useAuth } from "@/hooks/useAuth";
import { useKanbanStore } from "@/hooks/useKanbanStore";
import type { Opportunity, User } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import {
  useDroppable,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import LossReasonModal, { LossReasonData } from "./loss-reason-modal";
import { Filter, FilterX } from "lucide-react";

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

  // Perdido pode ser acessado de qualquer fase - os campos serão preenchidos após a movimentação
  if (targetPhase === 'perdido') {
    return { canMove: true };
  }

  const currentIndex = phaseSequence.indexOf(currentPhase || '');
  const targetIndex = phaseSequence.indexOf(targetPhase);

  // Permitir mover de "visita-tecnica" de volta para "em-atendimento"
  if (currentPhase === 'visita-tecnica' && targetPhase === 'em-atendimento') {
    return { canMove: true };
  }

  // Não pode mover para trás (exceto para perdido e o caso especial acima)
  if (targetIndex < currentIndex) {
    return {
      canMove: false,
      message: "Não é possível retroceder fases. Apenas é possível avançar sequencialmente."
    };
  }

  // Permitir pular a fase "visita-tecnica" quando estiver em "em-atendimento"
  if (currentPhase === 'em-atendimento' && targetPhase === 'proposta') {
    // Validar se os campos obrigatórios da fase atual estão preenchidos
    const isCurrentPhaseComplete = validatePhaseCompletion(opportunity);
    if (!isCurrentPhaseComplete.isComplete) {
      return {
        canMove: false,
        message: `Complete os campos obrigatórios da fase atual: ${isCurrentPhaseComplete.missingFields?.join(', ')}`
      };
    }
    return { canMove: true };
  }

  // Só pode avançar uma fase por vez (exceto para o caso especial acima)
  if (targetIndex > currentIndex + 1) {
    return {
      canMove: false,
      message: "Você deve avançar uma fase por vez. Complete a fase atual antes de prosseguir."
    };
  }

  // Validar se os campos obrigatórios da fase atual estão preenchidos (exceto se for para perdido)
  if (targetPhase !== 'perdido') {
    const isCurrentPhaseComplete = validatePhaseCompletion(opportunity);
    if (!isCurrentPhaseComplete.isComplete) {
      return {
        canMove: false,
        message: `Complete os campos obrigatórios da fase atual: ${isCurrentPhaseComplete.missingFields?.join(', ')}`
      };
    }
  }

  return { canMove: true };
};

// Função para validar se uma fase está completa
const validatePhaseCompletion = (opportunity: Opportunity): { isComplete: boolean; missingFields?: string[] } => {
  const missingFields: string[] = [];

  switch (opportunity.phase) {
    case 'prospeccao':
      // if (!opportunity.salesperson) missingFields.push('Vendedor');
      break;

    case 'em-atendimento':
      // if (!opportunity.salesperson) missingFields.push('Vendedor');
      // Temperatura do negócio só é obrigatória se já foi preenchida anteriormente
      // ou se estamos editando especificamente esta fase
      break;

    case 'visita-tecnica':
      if (!opportunity.visitSchedule) missingFields.push('Data de agendamento da visita');
      if (!opportunity.visitDate) missingFields.push('Data de realização da visita');
      break;

    case 'proposta':
      if (!opportunity.budgetNumber) missingFields.push('Número da proposta');
      break;

    case 'negociacao':
      // Campos de negociação agora são opcionais
      break;

    case 'ganho':
    case 'perdido':
      // Fases finais sempre consideradas completas para movimentação
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
  isPhaseFiltered?: boolean;
  onTogglePhaseFilter?: (phase: string) => void;
  users?: User[];
}

export default function SalesPipelineColumn({ phase, opportunities, isLoading, onViewDetails, isPhaseFiltered = false, onTogglePhaseFilter, users = [] }: SalesPipelineColumnProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { invalidateAllData } = useReportsSync();
  const { user } = useAuth();
  const { updateOpportunity, sendMessage } = useKanbanStore();
  const [opportunityToDelete, setOpportunityToDelete] = useState<Opportunity | null>(null);
  const [lossReasonModalOpen, setLossReasonModalOpen] = useState(false);
  const [pendingLossData, setPendingLossData] = useState<{opportunityId: string; opportunity: Opportunity} | null>(null);

  // Função para verificar se o usuário pode mover cards importados
  const canMoveImportedCard = (opportunity: Opportunity): boolean => {
    // Allow all users to move imported cards
    return true;
  };

  const moveOpportunityMutation = useMutation({
    mutationFn: ({ opportunityId, newPhase }: { opportunityId: string; newPhase: string }) =>
      apiRequest("PATCH", `/api/opportunities/${opportunityId}/move/${newPhase}`),
    onSuccess: (updatedOpportunity, { opportunityId, newPhase }) => {
      // Atualizar no store local com os dados retornados da API
      if (updatedOpportunity && updatedOpportunity.id) {
        updateOpportunity(updatedOpportunity.id, updatedOpportunity);
      } else {
        // Fallback: atualizar apenas a fase se não houver dados completos
        const opportunity = opportunities.find(opp => opp.id === opportunityId);
        if (opportunity) {
          updateOpportunity(opportunityId, { ...opportunity, phase: newPhase });
        }
      }
      
      // Enviar notificação via WebSocket
      sendMessage({
        type: 'opportunity:moved',
        data: { opportunityId, newPhase, userId: user?.id }
      });
      
      invalidateAllData(); // Sincroniza dashboard e relatórios
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

  const moveToLossMutation = useMutation({
    mutationFn: ({ opportunityId, lossData }: { opportunityId: string; lossData: LossReasonData }) =>
      apiRequest("PATCH", `/api/opportunities/${opportunityId}/move-to-loss`, lossData),
    onSuccess: (updatedOpportunity, { opportunityId }) => {
      // Atualizar no store local com os dados retornados da API
      if (updatedOpportunity && updatedOpportunity.id) {
        updateOpportunity(updatedOpportunity.id, updatedOpportunity);
      }
      
      // Enviar notificação via WebSocket
      sendMessage({
        type: 'opportunity:moved',
        data: { opportunityId, newPhase: 'perdido', userId: user?.id }
      });
      
      invalidateAllData();
      toast({
        title: "Sucesso",
        description: "Oportunidade movida para perdido com sucesso!",
      });
      setLossReasonModalOpen(false);
      setPendingLossData(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao mover oportunidade para perdido.",
        variant: "destructive",
      });
    },
  });

  const deleteOpportunityMutation = useMutation({
    mutationFn: (opportunityId: string) => {
      //console.log(`🗑️  Coluna: Iniciando exclusão da oportunidade ${opportunityId}`);
      return apiRequest("DELETE", `/api/opportunities/${opportunityId}`);
    },
    onSuccess: () => {
      //console.log(`✅ Coluna: Exclusão bem-sucedida`);
      invalidateAllData(); // Sincroniza dashboard e relatórios
      toast({
        title: "Sucesso",
        description: "Oportunidade excluída com sucesso!",
      });
      setOpportunityToDelete(null);
    },
    onError: (error: any) => {
      console.error(`❌ Coluna: Erro na exclusão:`, error);
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao excluir oportunidade.";
      console.error(`❌ Coluna: Mensagem de erro:`, errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      setOpportunityToDelete(null);
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

        // Verificar permissão para mover cards importados
        if (!canMoveImportedCard(opportunity)) {
          toast({
            title: "Movimento não permitido",
            description: "Você não tem permissão para mover este card importado. Apenas administradores, gerentes ou o vendedor responsável podem movê-lo.",
            variant: "destructive",
          });
          return;
        }

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

        // Se está movendo para perdido, abrir modal para capturar motivo
        if (phase.key === 'perdido') {
          setPendingLossData({ opportunityId, opportunity });
          setLossReasonModalOpen(true);
          return;
        }

        moveOpportunityMutation.mutate({ opportunityId, newPhase: phase.key });
      } catch (error) {
        // Fallback para formato antigo (apenas ID)
        const opportunityId = opportunityData;
        const opportunity = opportunities.find(opp => opp.id === opportunityId);

        if (opportunity) {
          // Verificar permissão para mover cards importados
          if (!canMoveImportedCard(opportunity)) {
            toast({
              title: "Movimento não permitido",
              description: "Você não tem permissão para mover este card importado. Apenas administradores, gerentes ou o vendedor responsável podem movê-lo.",
              variant: "destructive",
            });
            return;
          }

          const validation = canMoveOpportunity(opportunity, phase.key);

          if (!validation.canMove) {
            toast({
              title: "Movimento não permitido",
              description: validation.message,
              variant: "destructive",
            });
            return;
          }

          // Se está movendo para perdido, abrir modal para capturar motivo
          if (phase.key === 'perdido') {
            setPendingLossData({ opportunityId, opportunity });
            setLossReasonModalOpen(true);
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

  const { setNodeRef } = useDroppable({
    id: phase.key,
  });

  return (
    <div
      ref={setNodeRef}
      className="flex-1 min-w-0 h-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-testid={`column-${phase.key}`}
    >
      <div className={`${phase.bgColor} rounded-lg ${phase.borderColor} border shadow-sm h-full flex flex-col`}>
        {/* Header - mais compacto */}
        <div className={`p-3 border-b ${phase.borderColor} flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {renderIcon()}
              <h3 className="text-base font-semibold text-black dark:text-black">{phase.title}</h3>
            </div>
            <div className="flex items-center space-x-1.5">
              <Badge className={phase.badgeColor} data-testid={`count-${phase.key}`}>
                {opportunities.length}
              </Badge>
              
              {/* Botão de filtro por fase */}
              {onTogglePhaseFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onTogglePhaseFilter(phase.key)}
                  className={`h-6 w-6 p-0 transition-all duration-200 ${
                    isPhaseFiltered 
                      ? 'bg-white bg-opacity-30 text-white hover:bg-opacity-40' 
                      : 'bg-white bg-opacity-10 text-white hover:bg-opacity-20'
                  }`}
                  title={isPhaseFiltered ? `Remover filtro da fase ${phase.title}` : `Filtrar apenas fase ${phase.title}`}
                  data-testid={`filter-phase-${phase.key}`}
                >
                  {isPhaseFiltered ? (
                    <FilterX className="h-3 w-3" />
                  ) : (
                    <Filter className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          </div>
          {phase.description && (
            <p className="text-xs text-white dark:text-white mt-1 opacity-90">{phase.description}</p>
          )}
        </div>

        {/* Opportunity Cards - espaçamento reduzido */}
        <div className="p-3 space-y-2 flex-1 overflow-y-auto" data-testid={`opportunities-${phase.key}`}>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 py-2 px-3 animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-3/4 mb-1"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/2 mb-1"></div>
                  <div className="h-2 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : opportunities.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-gray-500 dark:text-gray-300">Nenhuma oportunidade nesta fase</p>
            </div>
          ) : (
            <>
              {/*console.log(`🔄 Coluna ${phase.key}: Renderizando ${opportunities.length} oportunidades`)*/}
              {opportunities.map((opportunity) => {
                //console.log(`📋 Coluna ${phase.key}: Renderizando oportunidade ${opportunity.id} - ${opportunity.contact} (${opportunity.company})`);
                return (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    onViewDetails={onViewDetails}
                    users={users}
                  />
                );
              })}
            </>
          )}
        </div>

        {/* Success/Loss Messages - mais compacto */}
        {phase.successMessage && (
          <div className={`p-2 border-t ${phase.borderColor} flex-shrink-0`}>
            <p className="text-xs text-white dark:text-white text-center opacity-90">{phase.successMessage}</p>
          </div>
        )}

        {phase.lossMessage && (
          <div className={`p-2 border-t ${phase.borderColor} flex-shrink-0`}>
            <p className="text-xs text-white dark:text-white text-center opacity-90">{phase.lossMessage}</p>
          </div>
        )}
      </div>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!opportunityToDelete} onOpenChange={(isOpen) => !isOpen && setOpportunityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Oportunidade</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a oportunidade "{opportunityToDelete?.contact}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOpportunityToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteOpportunityMutation.mutate(opportunityToDelete!.id)} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Motivo da Perda */}
      <LossReasonModal
        open={lossReasonModalOpen}
        onOpenChange={(open) => {
          setLossReasonModalOpen(open);
          if (!open) {
            setPendingLossData(null);
          }
        }}
        opportunity={pendingLossData?.opportunity || null}
        onConfirm={(lossData) => {
          if (pendingLossData) {
            moveToLossMutation.mutate({
              opportunityId: pendingLossData.opportunityId,
              lossData
            });
          }
        }}
        isLoading={moveToLossMutation.isPending}
      />
    </div>
  );
}