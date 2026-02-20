import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useKanbanStore, useWebSocketConnection, useWebSocketHeartbeat } from "@/hooks/useKanbanStore";
import SyncStatus from "@/components/sync-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Settings, ChartLine, Trophy, Clock, DollarSign, Plus, Filter, X, Search, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import SalesPipelineColumn from "@/components/sales-pipeline-column";
import NewOpportunityModal from "@/components/new-opportunity-modal";
import OpportunityDetailsModal from "@/components/opportunity-details-modal";
import SettingsModal from "@/components/settings-modal";

import { PHASES } from "@shared/schema";
import type { Opportunity, User } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';

export default function CrmDashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Zustand store para gerenciamento de estado
  const { 
    opportunities: storeOpportunities, 
    isLoading: storeIsLoading, 
    error: storeError,
    setOpportunities,
    setLoading,
    setError 
  } = useKanbanStore();
  
  // Hooks para WebSocket
  const syncStatus = useWebSocketConnection();
  useWebSocketHeartbeat();
  const [isNewOpportunityModalOpen, setIsNewOpportunityModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [isAdvancedFiltersModalOpen, setIsAdvancedFiltersModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [filteredPhaseOnly, setFilteredPhaseOnly] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [currentMobilePhaseIndex, setCurrentMobilePhaseIndex] = useState(0);
  const [newOpportunityPhase, setNewOpportunityPhase] = useState<string>("prospeccao");
  
  // Advanced filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
  const [selectedBusinessTemp, setSelectedBusinessTemp] = useState<string>('');
  const [dateRange, setDateRange] = useState<{from?: Date; to?: Date}>({});
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  // Fetch all opportunities (React Query como fallback)
  const { data: queryOpportunities = [], isLoading: isLoadingOpportunities, error: queryError } = useQuery<Opportunity[]>({
    queryKey: ["/api/opportunities"],
    staleTime: syncStatus.connected ? 30000 : 5000, // Reduzir staleTime mesmo quando conectado
  });
  
  // CORREÇÃO: Usar React Query como fonte primária, WebSocket como otimização
  // Se o store tem dados E está conectado, usar store; senão usar React Query
  const opportunities = (storeOpportunities.length > 0 && syncStatus.connected) 
    ? storeOpportunities 
    : queryOpportunities;
  const isLoading = storeIsLoading || isLoadingOpportunities;
  
  // CORREÇÃO: Sincronização mais agressiva entre React Query e store
  useEffect(() => {
    // Debug log para verificar dados das oportunidades
    console.log('[DEBUG] Dashboard - Query opportunities:', queryOpportunities.length);
    console.log('[DEBUG] Dashboard - Store opportunities:', storeOpportunities.length);
    if (queryOpportunities.length > 0) {
      console.log('[DEBUG] Dashboard - Sample opportunity from query:', queryOpportunities[0]);
    }
    if (storeOpportunities.length > 0) {
      console.log('[DEBUG] Dashboard - Sample opportunity from store:', storeOpportunities[0]);
    }
    
    // Sempre sincronizar quando React Query tem dados novos
    if (queryOpportunities.length > 0) {
      // Se store está vazio OU se não está conectado via WebSocket, sincronizar
      if (storeOpportunities.length === 0 || !syncStatus.connected) {
        console.log('🔄 Dashboard: Sincronizando dados do React Query para o store');
        setOpportunities(queryOpportunities);
      }
      // NOVO: Também sincronizar se há diferença no número de oportunidades
      else if (storeOpportunities.length !== queryOpportunities.length) {
        console.log('🔄 Dashboard: Sincronizando devido a diferença no número de oportunidades');
        console.log(`Store: ${storeOpportunities.length}, Query: ${queryOpportunities.length}`);
        setOpportunities(queryOpportunities);
      }
    }
  }, [queryOpportunities, storeOpportunities.length, syncStatus.connected, setOpportunities]);
  
  // Gerenciar estado de loading e erro
  useEffect(() => {
    setLoading(isLoadingOpportunities);
    setError(queryError ? 'Erro ao carregar oportunidades' : null);
  }, [isLoadingOpportunities, queryError, setLoading, setError]);

  // Fetch stats
  const { data: stats = {} } = useQuery({
    queryKey: ["/api/stats"],
  });

  // Fetch users for filter
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Advanced filtering logic
  const filteredOpportunities = opportunities.filter(opportunity => {
    // Filtro por fase individual (prioridade máxima)
    if (filteredPhaseOnly) {
      if (opportunity.phase !== filteredPhaseOnly) return false;
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const searchMatch = 
        (opportunity.contact || '').toLowerCase().includes(searchLower) ||
        (opportunity.company || '').toLowerCase().includes(searchLower) ||
        (opportunity.cpf && opportunity.cpf.toLowerCase().includes(searchLower)) ||
        (opportunity.cnpj && opportunity.cnpj.toLowerCase().includes(searchLower));
      if (!searchMatch) return false;
    }

    // User filter (Criado por)
    if (selectedUsers.length > 0) {
      const userMatch =
        (opportunity.createdByName && selectedUsers.includes(opportunity.createdByName));
      if (!userMatch) return false;
    }

    if (!filteredPhaseOnly && selectedPhases.length > 0) {
      if (!opportunity.phase || !selectedPhases.includes(opportunity.phase)) return false;
    }

    // Business temperature filter
    if (selectedBusinessTemp && selectedBusinessTemp !== 'all') {
      if (opportunity.businessTemperature !== selectedBusinessTemp) return false;
    }

    if (dateRange.from || dateRange.to) {
      if (!opportunity.createdAt) return false;
      const oppDate = new Date(opportunity.createdAt as unknown as string | number | Date);
      if (dateRange.from && oppDate < dateRange.from) return false;
      if (dateRange.to && oppDate > dateRange.to) return false;
    }

    // Value range filter
    if (minValue || maxValue) {
      const oppValue = parseFloat(opportunity.budget?.toString() || '0');
      if (minValue && oppValue < parseFloat(minValue)) return false;
      if (maxValue && oppValue > parseFloat(maxValue)) return false;
    }

    return true;
  });

  // Sort opportunities
  const sortedAndFilteredOpportunities = [...filteredOpportunities].sort((a, b) => {
    let aVal: any = a[sortBy as keyof Opportunity];
    let bVal: any = b[sortBy as keyof Opportunity];

    // Handle date sorting
    if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    }

    // Handle numeric sorting
    if (sortBy === 'budget' || sortBy === 'finalValue') {
      aVal = parseFloat(aVal?.toString() || '0');
      bVal = parseFloat(bVal?.toString() || '0');
    }

    // Handle string sorting
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const opportunitiesByPhase = sortedAndFilteredOpportunities.reduce((acc, opportunity) => {
    const phaseKey = opportunity.phase || 'sem-fase';
    if (!acc[phaseKey]) {
      acc[phaseKey] = [];
    }
    acc[phaseKey].push(opportunity);
    return acc;
  }, {} as Record<string, Opportunity[]>);

  const phaseConfig = [
    {
      key: PHASES.PROSPECCAO,
      title: "Prospecção",
      icon: "search",
      bgColor: "bg-prospeccao",
      borderColor: "border-white",
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
      borderColor: "border-blue-200 dark:border-blue-800",
      badgeColor: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
    },
    {
      key: PHASES.PROPOSTA,
      title: "Proposta",
      icon: "file-contract",
      bgColor: "bg-proposta",
      borderColor: "border-pink-200 dark:border-pink-800",
      badgeColor: "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300",
    },
    {
      key: PHASES.NEGOCIACAO,
      title: "Negociação",
      icon: "handshake",
      bgColor: "bg-negociacao",
      borderColor: "border-blue-200 dark:border-blue-800",
      badgeColor: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
    },
    {
      key: PHASES.GANHO,
      title: "Ganho",
      icon: "trophy",
      bgColor: "bg-ganho",
      borderColor: "border-green-200 dark:border-green-800",
      badgeColor: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
    },
    {
      key: PHASES.PERDIDO,
      title: "Perdido",
      icon: "x-circle",
      bgColor: "bg-perdido",
      borderColor: "border-red-200 dark:border-red-800",
      badgeColor: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
    },
  ];

  const handleViewDetails = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setIsDetailsModalOpen(true);
  };

  const handleUserSelect = (userName: string) => {
    if (!selectedUsers.includes(userName)) {
      setSelectedUsers([...selectedUsers, userName]);
    }
  };

  const handleUserRemove = (userName: string) => {
    setSelectedUsers(selectedUsers.filter(user => user !== userName));
  };

  const clearAllFilters = () => {
    setSelectedUsers([]);
    setSearchTerm('');
    setSelectedPhases([]);
    setSelectedBusinessTemp('');
    setDateRange({});
    setMinValue('');
    setMaxValue('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setFilteredPhaseOnly(null);
  };

  const handleTogglePhaseFilter = (phase: string) => {
    if (filteredPhaseOnly === phase) {
      setFilteredPhaseOnly(null);
    } else {
      setFilteredPhaseOnly(phase);
    }
  };

  const handlePhaseSelect = (phase: string) => {
    if (!selectedPhases.includes(phase)) {
      setSelectedPhases([...selectedPhases, phase]);
    }
  };

  const handlePhaseRemove = (phase: string) => {
    setSelectedPhases(selectedPhases.filter(p => p !== phase));
  };

  // Invalidate reports when opportunities change to keep them in sync
  useEffect(() => {
    if (opportunities?.length >= 0) {
      // Invalidate reports queries to ensure real-time sync
      queryClient.invalidateQueries({ queryKey: ["/api/reports/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/monthly-trend"] });
    }
  }, [opportunities, queryClient]);

  const projectedRevenue = sortedAndFilteredOpportunities
    .filter(o => o.budget && o.phase && ['proposta', 'negociacao', 'ganho'].includes(o.phase))
    .reduce((sum, o) => sum + parseFloat(o.budget!.toString()), 0);

  // Initialize NumberFormat for currency formatting
  const newIntl = Intl;

  const handleNextPhase = () => {
    if (currentMobilePhaseIndex < phaseConfig.length - 1) {
      setCurrentMobilePhaseIndex(prev => prev + 1);
    }
  };

  const handlePrevPhase = () => {
    if (currentMobilePhaseIndex > 0) {
      setCurrentMobilePhaseIndex(prev => prev - 1);
    }
  };

  const handleCreateOpportunityInPhase = (phase: string) => {
    setNewOpportunityPhase(phase);
    setIsNewOpportunityModalOpen(true);
  };

  return (
    <div className="bg-background min-h-screen font-inter">
      {/* Header Compacto */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-2 gap-2">
            <div className="flex items-center w-full md:w-auto">
              <h1 className="text-lg font-bold text-foreground" data-testid="title-crm">
                CRM - Funil de Vendas ({sortedAndFilteredOpportunities.length})
              </h1>
            </div>
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto no-scrollbar justify-start md:justify-end">
              <div className="hidden md:block">
                <SyncStatus />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setNewOpportunityPhase('prospeccao');
                  setIsNewOpportunityModalOpen(true);
                }}
                data-testid="button-new-opportunity"
                className="whitespace-nowrap shrink-0"
              >
                <Plus className="mr-1 h-3 w-3" />
                Nova
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAdvancedFiltersModalOpen(true)}
                data-testid="button-advanced-filters"
                className="whitespace-nowrap shrink-0"
              >
                <Filter className="mr-1 h-3 w-3" />
                Filtros
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearAllFilters}
                data-testid="button-clear-filters"
                className="whitespace-nowrap shrink-0"
              >
                <X className="mr-1 h-3 w-3" />
                Limpar
              </Button>
            </div>
          </div>

          {/* Active Filters - Compacto na mesma seção do header */}
          {(selectedPhases.length > 0 || searchTerm || selectedUsers.length > 0 || selectedBusinessTemp || minValue || maxValue) && (
            <div className="flex flex-wrap gap-1 pb-2">
              {selectedPhases.map((phase) => {
                const phaseInfo = phaseConfig.find(p => p.key === phase);
                return (
                  <Badge key={phase} variant="secondary" className="text-xs px-2 py-0">
                    {phaseInfo?.title}
                    <button
                      onClick={() => handlePhaseRemove(phase)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-2 w-2" />
                    </button>
                  </Badge>
                );
              })}
              {searchTerm && (
                <Badge variant="secondary" className="text-xs px-2 py-0">
                  Busca: {searchTerm}
                  <button
                    onClick={() => setSearchTerm('')}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </Badge>
              )}
              {selectedUsers.map((user) => (
                <Badge key={user} variant="secondary" className="text-xs px-2 py-0">
                  {user}
                  <button
                    onClick={() => handleUserRemove(user)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </Badge>
              ))}
              {selectedBusinessTemp && selectedBusinessTemp !== 'all' && (
                <Badge variant="secondary" className="text-xs px-2 py-0">
                  {selectedBusinessTemp}
                  <button
                    onClick={() => setSelectedBusinessTemp('')}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </Badge>
              )}
              {(minValue || maxValue) && (
                <Badge variant="secondary" className="text-xs px-2 py-0">
                  R$ {minValue || '0'} - {maxValue || '∞'}
                  <button
                    onClick={() => {
                      setMinValue('');
                      setMaxValue('');
                    }}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-2 py-2">
        {/* Statistics Section - Compacta */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <Card className="p-2">
            <div className="flex items-center">
              <div className="p-1 bg-blue-100 rounded-md">
                <ChartLine className="h-4 w-4 text-blue-600" />
              </div>
              <div className="ml-2">
                <p className="text-xs font-medium text-muted-foreground">Total</p>
                <p className="text-sm font-bold">{sortedAndFilteredOpportunities.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-2">
            <div className="flex items-center">
              <div className="p-1 bg-green-100 rounded-md">
                <Trophy className="h-4 w-4 text-green-600" />
              </div>
              <div className="ml-2">
                <p className="text-xs font-medium text-muted-foreground">Ganhas</p>
                <p className="text-sm font-bold">
                  {sortedAndFilteredOpportunities.filter(o => o.phase === 'ganho').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-2">
            <div className="flex items-center">
              <div className="p-1 bg-orange-100 rounded-md">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
              <div className="ml-2">
                <p className="text-xs font-medium text-muted-foreground">Ativas</p>
                <p className="text-sm font-bold">
                  {sortedAndFilteredOpportunities.filter(o => !['ganho', 'perdido'].includes(o.phase || '')).length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-2">
            <div className="flex items-center">
              <div className="p-1 bg-purple-100 rounded-md">
                <DollarSign className="h-4 w-4 text-purple-600" />
              </div>
              <div className="ml-2">
                <p className="text-xs font-medium text-muted-foreground">Projetado</p>
                <p className="text-sm font-bold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(projectedRevenue)}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-2">
            <div className="flex items-center">
              <div className="p-1 bg-green-100 rounded-md">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div className="ml-2">
                <p className="text-xs font-medium text-muted-foreground">Faturado</p>
                <p className="text-sm font-bold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(
                    sortedAndFilteredOpportunities
                      .filter(o => o.phase === 'ganho')
                      .reduce((sum, o) => {
                        // Priorizar finalValue, fallback para budget, fallback para 0
                        const value = o.finalValue ? parseFloat(o.finalValue.toString()) : (o.budget ? parseFloat(o.budget.toString()) : 0);
                        return sum + (isNaN(value) ? 0 : value);
                      }, 0)
                  )}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sales Funnel Pipeline - Altura Otimizada */}
        <div className="h-[calc(100vh-280px)]">
          {/* Mobile View */}
          <div className="flex flex-col h-full md:hidden" data-testid="sales-pipeline-mobile">
            {/* Navegação de Fases Mobile */}
            <div className="flex items-center justify-between mb-2 bg-card p-2 rounded-md shadow-sm border border-border">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handlePrevPhase} 
                disabled={currentMobilePhaseIndex === 0}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex flex-col items-center">
                <span className="font-bold text-sm">{phaseConfig[currentMobilePhaseIndex].title}</span>
                <span className="text-xs text-muted-foreground">
                  {opportunitiesByPhase[phaseConfig[currentMobilePhaseIndex].key]?.length || 0} oportunidades
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleNextPhase} 
                disabled={currentMobilePhaseIndex === phaseConfig.length - 1}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Coluna Única Mobile */}
            <div className="flex-1 overflow-hidden">
              <SalesPipelineColumn
                key={phaseConfig[currentMobilePhaseIndex].key}
                phase={phaseConfig[currentMobilePhaseIndex]}
                opportunities={opportunitiesByPhase[phaseConfig[currentMobilePhaseIndex].key] || []}
                isLoading={isLoadingOpportunities}
                onViewDetails={handleViewDetails}
                isPhaseFiltered={false}
                onTogglePhaseFilter={() => {}}
                users={users}
                onCreateOpportunityInPhase={handleCreateOpportunityInPhase}
              />
            </div>
          </div>

          {/* Desktop View */}
          <div className="hidden md:block h-full overflow-x-auto overflow-y-hidden" data-testid="sales-pipeline">
            <div className="flex space-x-2 pb-4 w-full h-full">
              {phaseConfig.map((phase) => (
                <SalesPipelineColumn
                  key={phase.key}
                  phase={phase}
                  opportunities={opportunitiesByPhase[phase.key] || []}
                  isLoading={isLoadingOpportunities}
                  onViewDetails={handleViewDetails}
                  isPhaseFiltered={filteredPhaseOnly === phase.key}
                  onTogglePhaseFilter={handleTogglePhaseFilter}
                  users={users}
                  onCreateOpportunityInPhase={handleCreateOpportunityInPhase}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      <NewOpportunityModal
        open={isNewOpportunityModalOpen}
        onOpenChange={setIsNewOpportunityModalOpen}
        initialPhase={newOpportunityPhase}
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

      {/* Modal de Filtros Avançados */}
      <Dialog open={isAdvancedFiltersModalOpen} onOpenChange={setIsAdvancedFiltersModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filtros Avançados</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Busca Global */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Busca Global</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente, empresa, CPF/CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-input-modal"
                />
              </div>
            </div>

            {/* Filtros por Criador do Card */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Criado por</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {users.map((user) => {
                  const displayName = user.name || user.email || 'Usuário';
                  return (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedUsers.includes(displayName)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleUserSelect(displayName);
                          } else {
                            handleUserRemove(displayName);
                          }
                        }}
                      />
                      <Label htmlFor={`user-${user.id}`} className="text-sm font-normal">
                        {displayName}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Filtros por Fase */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Fases</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {phaseConfig.map((phase) => (
                  <div key={phase.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`phase-${phase.key}`}
                      checked={selectedPhases.includes(phase.key)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handlePhaseSelect(phase.key);
                        } else {
                          handlePhaseRemove(phase.key);
                        }
                      }}
                    />
                    <Label htmlFor={`phase-${phase.key}`} className="text-sm font-normal">
                      {phase.title}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Temperatura do Negócio */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Temperatura do Negócio</Label>
              <Select value={selectedBusinessTemp} onValueChange={setSelectedBusinessTemp}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma temperatura" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="quente">Quente</SelectItem>
                  <SelectItem value="morno">Morno</SelectItem>
                  <SelectItem value="frio">Frio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Faixa de Valor */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Faixa de Valor</Label>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Valor mínimo (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={minValue}
                    onChange={(e) => setMinValue(e.target.value)}
                    type="number"
                    data-testid="min-value-input-modal"
                  />
                </div>
                <span className="text-muted-foreground mt-6">até</span>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Valor máximo (R$)</Label>
                  <Input
                    placeholder="Sem limite"
                    value={maxValue}
                    onChange={(e) => setMaxValue(e.target.value)}
                    type="number"
                    data-testid="max-value-input-modal"
                  />
                </div>
              </div>
            </div>

            {/* Período */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Período de Criação</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {dateRange.from ? (
                      dateRange.to ? (
                        `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`
                      ) : (
                        format(dateRange.from, 'dd/MM/yyyy')
                      )
                    ) : (
                      'Selecione um período'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="range"
                    selected={dateRange as any}
                    onSelect={setDateRange as any}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Ordenação */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Ordenação</Label>
              <Select 
                value={`${sortBy}-${sortOrder}`} 
                onValueChange={(value) => {
                  const [field, order] = value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">Mais Recentes</SelectItem>
                  <SelectItem value="createdAt-asc">Mais Antigos</SelectItem>
                  <SelectItem value="budget-desc">Maior Valor</SelectItem>
                  <SelectItem value="budget-asc">Menor Valor</SelectItem>
                  <SelectItem value="company-asc">Empresa A-Z</SelectItem>
                  <SelectItem value="company-desc">Empresa Z-A</SelectItem>
                  <SelectItem value="phase-asc">Fase</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={clearAllFilters}
            >
              <X className="mr-2 h-4 w-4" />
              Limpar Filtros
            </Button>
            <Button
              onClick={() => setIsAdvancedFiltersModalOpen(false)}
            >
              Aplicar Filtros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
    </div>
  );
}
