import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Settings, ChartLine, Trophy, Clock, DollarSign, Plus } from "lucide-react";
import SalesPipelineColumn from "@/components/sales-pipeline-column";
import NewOpportunityModal from "@/components/new-opportunity-modal";
import SettingsModal from "@/components/settings-modal";
import { PHASES } from "@shared/schema";
import type { Opportunity } from "@shared/schema";
import OpportunityDetailsModal from "@/components/opportunity-details-modal";

export default function CrmDashboard() {
  const queryClient = useQueryClient();
  const [isNewOpportunityModalOpen, setIsNewOpportunityModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);

  // Fetch all opportunities
  const { data: opportunities = [], isLoading: isLoadingOpportunities } = useQuery<Opportunity[]>({
    queryKey: ["/api/opportunities"],
  });

  // Fetch stats
  const { data: stats = {} } = useQuery({
    queryKey: ["/api/stats"],
  });

  // Group opportunities by phase
  const opportunitiesByPhase = opportunities.reduce((acc, opportunity) => {
    if (!acc[opportunity.phase]) {
      acc[opportunity.phase] = [];
    }
    acc[opportunity.phase].push(opportunity);
    return acc;
  }, {} as Record<string, Opportunity[]>);

  const phaseConfig = [
    {
      key: PHASES.PROSPECCAO,
      title: "Prospecção",
      icon: "search",
      bgColor: "bg-prospeccao",
      borderColor: "border-orange-200",
      badgeColor: "bg-orange-100 text-orange-800",
    },
    {
      key: PHASES.EM_ATENDIMENTO,
      title: "Em Atendimento",
      icon: "headset",
      bgColor: "bg-atendimento",
      borderColor: "border-purple-200",
      badgeColor: "bg-purple-100 text-purple-800",
    },
    {
      key: PHASES.VISITA_TECNICA,
      title: "Visita Técnica",
      icon: "clipboard-check",
      bgColor: "bg-visita",
      borderColor: "border-blue-200",
      badgeColor: "bg-blue-100 text-blue-800",
    },
    {
      key: PHASES.PROPOSTA,
      title: "Proposta",
      icon: "file-contract",
      bgColor: "bg-proposta",
      borderColor: "border-pink-200",
      badgeColor: "bg-pink-100 text-pink-800",
    },
    {
      key: PHASES.NEGOCIACAO,
      title: "Negociação",
      icon: "handshake",
      bgColor: "bg-negociacao",
      borderColor: "border-blue-200",
      badgeColor: "bg-blue-100 text-blue-800",
    },
    {
      key: PHASES.GANHO,
      title: "Ganho",
      icon: "trophy",
      bgColor: "bg-ganho",
      borderColor: "border-green-200",
      badgeColor: "bg-green-100 text-green-800",
    },
    {
      key: PHASES.PERDIDO,
      title: "Perdido",
      icon: "x-circle",
      bgColor: "bg-perdido",
      borderColor: "border-red-200",
      badgeColor: "bg-red-100 text-red-800",
    },
  ];

  const handleViewDetails = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setIsDetailsModalOpen(true);
  };

  // Invalidate reports when opportunities change to keep them in sync
  useEffect(() => {
    if (opportunities?.length >= 0) {
      // Invalidate reports queries to ensure real-time sync
      queryClient.invalidateQueries({ queryKey: ["/api/reports/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/monthly-trend"] });
    }
  }, [opportunities, queryClient]);

  return (
    <div className="bg-background min-h-screen font-inter">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-foreground" data-testid="title-crm">
                CRM - Funil de Vendas
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setIsNewOpportunityModalOpen(true)}
                data-testid="button-new-opportunity"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Oportunidade
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsSettingsModalOpen(true)}
                data-testid="button-settings"
              >
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Overview */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg shadow-sm p-4 border border-border">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                  <ChartLine className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total de Oportunidades</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-total-opportunities">
                  {(stats as any)?.totalOpportunities || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-4 border border-border">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                  <Trophy className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Oportunidades Ganhas</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-won-opportunities">
                  {(stats as any)?.wonOpportunities || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-4 border border-border">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                  <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-active-opportunities">
                  {(stats as any)?.activeOpportunities || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-4 border border-border">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Receita Projetada</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-projected-revenue">
                  {(stats as any)?.projectedRevenue || "R$ 0,00"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Funnel Pipeline */}
        <div className="overflow-x-auto" data-testid="sales-pipeline">
          <div className="flex space-x-4 pb-4 min-w-max">
            {phaseConfig.map((phase) => (
              <SalesPipelineColumn
                key={phase.key}
                phase={phase}
                opportunities={opportunitiesByPhase[phase.key] || []}
                isLoading={isLoadingOpportunities}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        </div>
      </main>

      <NewOpportunityModal
        open={isNewOpportunityModalOpen}
        onOpenChange={setIsNewOpportunityModalOpen}
      />

      <OpportunityDetailsModal
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
        opportunity={selectedOpportunity}
      />

      <SettingsModal
        open={isSettingsModalOpen}
        onOpenChange={setIsSettingsModalOpen}
      />
    </div>
  );
}