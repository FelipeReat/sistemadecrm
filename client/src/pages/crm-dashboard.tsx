import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Settings, ChartLine, Trophy, Clock, DollarSign, Plus, Filter, X, Search, ArrowUpDown, Upload } from "lucide-react";
import SalesPipelineColumn from "@/components/sales-pipeline-column";
import NewOpportunityModal from "@/components/new-opportunity-modal";
import NewProposalOpportunityModal from "@/components/new-proposal-opportunity-modal";
import OpportunityDetailsModal from "@/components/opportunity-details-modal";
import SettingsModal from "@/components/settings-modal";
import { ImportModal } from "@/components/import-modal";
import { PHASES } from "@shared/schema";
import type { Opportunity, User } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
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
  const [isNewOpportunityModalOpen, setIsNewOpportunityModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [isNewProposalOpportunityModalOpen, setIsNewProposalOpportunityModalOpen] = useState(false);
  const [isAdvancedFiltersModalOpen, setIsAdvancedFiltersModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  // Advanced filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
  const [selectedBusinessTemp, setSelectedBusinessTemp] = useState<string>('');
  const [dateRange, setDateRange] = useState<{from?: Date; to?: Date}>({});
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  // Fetch all opportunities
  const { data: opportunities = [], isLoading: isLoadingOpportunities } = useQuery<Opportunity[]>({
    queryKey: ["/api/opportunities"],
  });

  // Fetch stats
  const { data: stats = {} } = useQuery({
    queryKey: ["/api/stats"],
  });

  // Fetch users for filter
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users/salespeople"],
  });

  // Advanced filtering logic
  const filteredOpportunities = opportunities.filter(opportunity => {
    // Search term filter (contact, company, cpf, cnpj)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const searchMatch = 
        opportunity.contact.toLowerCase().includes(searchLower) ||
        opportunity.company.toLowerCase().includes(searchLower) ||
        (opportunity.cpf && opportunity.cpf.toLowerCase().includes(searchLower)) ||
        (opportunity.cnpj && opportunity.cnpj.toLowerCase().includes(searchLower));
      if (!searchMatch) return false;
    }

    // User filter
    if (selectedUsers.length > 0) {
      const userMatch = selectedUsers.includes(opportunity.createdBy) ||
                       (opportunity.salesperson && selectedUsers.includes(opportunity.salesperson));
      if (!userMatch) return false;
    }

    // Phase filter
    if (selectedPhases.length > 0) {
      if (!selectedPhases.includes(opportunity.phase)) return false;
    }

    // Business temperature filter
    if (selectedBusinessTemp && selectedBusinessTemp !== 'all') {
      if (opportunity.businessTemperature !== selectedBusinessTemp) return false;
    }

    // Date range filter
    if (dateRange.from || dateRange.to) {
      const oppDate = new Date(opportunity.createdAt);
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

  // Group filtered opportunities by phase
  const opportunitiesByPhase = sortedAndFilteredOpportunities.reduce((acc, opportunity) => {
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

  const handleCreateOpportunityInPhase = (phase: string) => {
    if (phase === 'proposta') {
      setIsNewProposalOpportunityModalOpen(true);
    }
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

  // Calculate projected revenue from filtered opportunities
  const projectedRevenue = sortedAndFilteredOpportunities
    .filter(o => o.budget && ['proposta', 'negociacao', 'ganho'].includes(o.phase))
    .reduce((sum, o) => sum + parseFloat(o.budget!.toString()), 0);

  // Initialize NumberFormat for currency formatting
  const newIntl = Intl;

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
              {user && ['admin', 'gerente'].includes(user.role) && (
                <Button
                  variant="outline"
                  onClick={() => setIsImportModalOpen(true)}
                  data-testid="button-import-data"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Importar Dados
                </Button>
              )}
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

      {/* Filter Section */}
      <div className="bg-muted/50 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="space-y-4">
            {/* Filter Controls and Results Summary */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Left side: Filter Button and Clear Filters */}
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setIsAdvancedFiltersModalOpen(true)}
                  className="flex items-center space-x-2"
                  data-testid="advanced-filters-button"
                >
                  <Filter className="h-4 w-4" />
                  <span>Filtros Avançados</span>
                  {(selectedUsers.length > 0 || selectedPhases.length > 0 || searchTerm || selectedBusinessTemp || minValue || maxValue || dateRange.from || dateRange.to) && (
                    <Badge variant="destructive" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {(selectedUsers.length + selectedPhases.length + (searchTerm ? 1 : 0) + (selectedBusinessTemp && selectedBusinessTemp !== 'all' ? 1 : 0) + ((minValue || maxValue) ? 1 : 0) + ((dateRange.from || dateRange.to) ? 1 : 0))}
                    </Badge>
                  )}
                </Button>

                {/* Clear All Filters Button */}
                {(selectedUsers.length > 0 || selectedPhases.length > 0 || searchTerm || selectedBusinessTemp || minValue || maxValue || dateRange.from || dateRange.to) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    data-testid="clear-all-filters"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Limpar Filtros
                  </Button>
                )}
              </div>

              {/* Right side: Results Summary */}
              <div className="text-sm text-muted-foreground flex-shrink-0">
                Mostrando {sortedAndFilteredOpportunities.length} de {opportunities.length} oportunidades
                {projectedRevenue > 0 && (
                  <span className="ml-4">
                    • Receita projetada: <span className="font-medium text-foreground">
                      R$ {projectedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Active Filters Display */}
            {(selectedUsers.length > 0 || selectedPhases.length > 0 || searchTerm || selectedBusinessTemp || minValue || maxValue || dateRange.from || dateRange.to) && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Filtros ativos:</span>
                
                {searchTerm && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Busca: "{searchTerm}"
                    <button onClick={() => setSearchTerm('')} className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}

                {selectedUsers.map((userName) => (
                  <Badge key={userName} variant="secondary" className="flex items-center gap-1">
                    Vendedor: {userName}
                    <button onClick={() => handleUserRemove(userName)} className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}

                {selectedPhases.map((phase) => (
                  <Badge key={phase} variant="secondary" className="flex items-center gap-1">
                    {phaseConfig.find(p => p.key === phase)?.title || phase}
                    <button onClick={() => handlePhaseRemove(phase)} className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}

                {selectedBusinessTemp && selectedBusinessTemp !== 'all' && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {selectedBusinessTemp}
                    <button onClick={() => setSelectedBusinessTemp('')} className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}

                {(minValue || maxValue) && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    R$ {minValue || '0'} - {maxValue || '∞'}
                    <button onClick={() => { setMinValue(''); setMaxValue(''); }} className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Overview */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-5 gap-4">
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

          {/* Receita Projetada */}
          <div className="bg-card rounded-lg shadow-sm p-4 border border-border">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Receita Projetada</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-projected-revenue">
                  {newIntl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(projectedRevenue)}
                </p>
              </div>
            </div>
          </div>

          {/* Valor Total (Oportunidades Ganhas) */}
          <div className="bg-card rounded-lg shadow-sm p-4 border border-border">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-total-won-value">
                  {newIntl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format((stats as any)?.totalWonValue || 0)}
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
                onCreateOpportunityInPhase={() => handleCreateOpportunityInPhase(phase.key)}
              />
            ))}
          </div>
        </div>
      </main>

      <NewOpportunityModal
        open={isNewOpportunityModalOpen}
        onOpenChange={setIsNewOpportunityModalOpen}
      />

      <NewProposalOpportunityModal
        open={isNewProposalOpportunityModalOpen}
        onOpenChange={setIsNewProposalOpportunityModalOpen}
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

            {/* Filtros por Vendedor */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Vendedores</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`user-${user.id}`}
                      checked={selectedUsers.includes(user.name)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleUserSelect(user.name);
                        } else {
                          handleUserRemove(user.name);
                        }
                      }}
                    />
                    <Label htmlFor={`user-${user.id}`} className="text-sm font-normal">
                      {user.name}
                    </Label>
                  </div>
                ))}
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
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
          queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
        }}
      />
    </div>
  );
}