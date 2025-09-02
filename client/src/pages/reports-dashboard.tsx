import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from "recharts";
import { Calendar, TrendingUp, DollarSign, Clock, Users, Target, AlertTriangle, RefreshCw, Activity, Plus, Filter } from "lucide-react";
import CustomReportsModal from "@/components/custom-reports-modal";

interface ReportData {
  // Métricas gerais
  avgSalesCycle: number; // em dias
  totalRevenue: number;
  
  // Oportunidades por etapa
  opportunitiesByPhase: Array<{
    phase: string;
    count: number;
    phaseName: string;
  }>;
  
  // Temperaturas dos negócios
  businessTemperatures: Array<{
    temperature: string;
    count: number;
    percentage: number;
  }>;
  
  // Motivos de perda
  lossReasons: Array<{
    reason: string;
    count: number;
  }>;
  
  // Oportunidades por vendedor
  opportunitiesBySalesperson: Array<{
    salesperson: string;
    count: number;
    percentage: number;
  }>;
  
  // Métricas de tempo
  monthlyStats: {
    totalOpportunities: number;
    wonOpportunities: number;
    lostOpportunities: number;
    activeOpportunities: number;
  };
}

export default function ReportsDashboard() {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [customReportsOpen, setCustomReportsOpen] = useState(false);

  // Fetch report data with dependency on opportunities
  const { data: reportData, isLoading, refetch: refetchReports } = useQuery<ReportData>({
    queryKey: ["/api/reports/dashboard"],
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true,
  });

  const { data: monthlyTrend, refetch: refetchTrend } = useQuery({
    queryKey: ["/api/reports/monthly-trend"],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Also fetch opportunities to stay in sync
  const { data: opportunities } = useQuery({
    queryKey: ["/api/opportunities"],
  });

  // Auto-refresh when opportunities change
  useEffect(() => {
    if (opportunities) {
      setLastUpdated(new Date());
      // Invalidate report queries when opportunities change
      queryClient.invalidateQueries({ queryKey: ["/api/reports/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/monthly-trend"] });
    }
  }, [opportunities, queryClient]);

  const handleManualRefresh = () => {
    setLastUpdated(new Date());
    refetchReports();
    refetchTrend();
    queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Relatórios e Análises</h1>
            <p className="text-muted-foreground mt-2">Carregando dados...</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formatSalesCycle = (days: number) => {
    const hours = Math.floor(days * 24);
    const minutes = Math.floor((days * 24 * 60) % 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Cores para os gráficos
  const phaseColors = {
    'prospeccao': '#f97316',
    'em-atendimento': '#a855f7',
    'visita-tecnica': '#3b82f6',
    'proposta': '#ec4899',
    'negociacao': '#06b6d4',
    'ganho': '#10b981',
    'perdido': '#ef4444'
  };

  const temperatureColors = ['#f97316', '#06d6a0', '#ffd60a'];

  return (
    <div className="min-h-screen bg-background" data-testid="reports-dashboard">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground" data-testid="title-reports">
                Relatórios e Análises
              </h1>
              <p className="text-muted-foreground mt-2">
                Dados em tempo real do seu funil de vendas - sincronizado com o dashboard
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-muted-foreground">
                <Activity className="h-4 w-4 mr-1" />
                Última atualização: {lastUpdated.toLocaleTimeString('pt-BR')}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isLoading}
                data-testid="button-refresh-reports"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Atualizando...' : 'Atualizar'}
              </Button>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                data-testid="button-auto-refresh"
              >
                <Activity className="h-4 w-4 mr-2" />
                Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
              </Button>
              <Button
                onClick={() => setCustomReportsOpen(true)}
                data-testid="button-custom-reports"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Relatório
              </Button>
            </div>
          </div>
        </div>

        {/* KPIs Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ciclo de vendas médio este mês
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-avg-cycle">
                {reportData?.avgSalesCycle ? formatSalesCycle(reportData.avgSalesCycle) : '0:00'}
              </div>
              <p className="text-xs text-green-600 mt-1">
                Lead time (horas) / média
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total arrecadado
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-total-revenue">
                {reportData?.totalRevenue ? formatCurrency(reportData.totalRevenue) : 'R$ 0,00'}
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Valor final das oportunidades Soma
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Taxa de conversão
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-conversion-rate">
                {reportData?.monthlyStats ? 
                  `${((reportData.monthlyStats.wonOpportunities / Math.max(reportData.monthlyStats.totalOpportunities, 1)) * 100).toFixed(1)}%` 
                  : '0%'
                }
              </div>
              <p className="text-xs text-green-600 mt-1">
                Oportunidades ganhas / Total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Oportunidades ativas
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-active-opportunities">
                {reportData?.monthlyStats?.activeOpportunities || 0}
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Em andamento no funil
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
            <TabsTrigger value="analysis" data-testid="tab-analysis">Análise Detalhada</TabsTrigger>
            <TabsTrigger value="sdr-opportunities" data-testid="tab-sdr-opportunities">Oportunidades SDR</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Oportunidades por etapa */}
              <Card>
                <CardHeader>
                  <CardTitle>Oportunidades por etapa</CardTitle>
                  <CardDescription>
                    Distribuição das oportunidades nas fases do funil
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData?.opportunitiesByPhase || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="phaseName" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar 
                        dataKey="count" 
                        fill="#f97316"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* % das temperaturas */}
              <Card>
                <CardHeader>
                  <CardTitle>% das temperaturas</CardTitle>
                  <CardDescription>
                    Classificação da temperatura dos negócios
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={reportData?.businessTemperatures || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="count"
                      >
                        {reportData?.businessTemperatures?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={temperatureColors[index % temperatureColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name, props) => [
                        `${value} (${props.payload.percentage}%)`,
                        props.payload.temperature
                      ]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Motivo da perda */}
              <Card>
                <CardHeader>
                  <CardTitle>Motivo da perda</CardTitle>
                  <CardDescription>
                    Principais razões para oportunidades perdidas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reportData?.lossReasons?.map((reason, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium">{reason.reason || 'Não informado'}</span>
                        </div>
                        <Badge variant="secondary">{reason.count} cards</Badge>
                      </div>
                    )) || (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma oportunidade perdida registrada
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Oportunidades por vendedor */}
              <Card>
                <CardHeader>
                  <CardTitle>Oportunidades por vendedor</CardTitle>
                  <CardDescription>
                    Performance individual dos vendedores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={reportData?.opportunitiesBySalesperson || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="count"
                      >
                        {reportData?.opportunitiesBySalesperson?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`hsl(${index * 45 + 20}, 70%, 60%)`} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name, props) => [
                        `${value} (${props.payload.percentage}%)`,
                        props.payload.salesperson || 'Não atribuído'
                      ]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Resumo detalhado */}
              <Card>
                <CardHeader>
                  <CardTitle>Análise Detalhada do Funil</CardTitle>
                  <CardDescription>
                    Insights e métricas importantes do seu pipeline de vendas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-lg">Funil de Conversão</h4>
                      <div className="space-y-2">
                        {reportData?.opportunitiesByPhase?.map((phase, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-sm">{phase.phaseName}</span>
                            <Badge variant="outline">{phase.count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-lg">Performance</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Taxa de Fechamento</span>
                          <Badge variant="outline">
                            {reportData?.monthlyStats ? 
                              `${((reportData.monthlyStats.wonOpportunities / Math.max(reportData.monthlyStats.totalOpportunities, 1)) * 100).toFixed(1)}%` 
                              : '0%'
                            }
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Ticket Médio</span>
                          <Badge variant="outline">
                            {reportData?.totalRevenue && reportData?.monthlyStats?.wonOpportunities ? 
                              formatCurrency(reportData.totalRevenue / reportData.monthlyStats.wonOpportunities) 
                              : 'R$ 0,00'
                            }
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-lg">Equipe</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Vendedores Ativos</span>
                          <Badge variant="outline">{reportData?.opportunitiesBySalesperson?.length || 0}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Top Performer</span>
                          <Badge variant="outline">
                            {reportData?.opportunitiesBySalesperson && reportData.opportunitiesBySalesperson.length > 0 
                              ? reportData.opportunitiesBySalesperson[0].salesperson 
                              : 'N/A'
                            }
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sdr-opportunities" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Oportunidades SDR</CardTitle>
                <CardDescription>
                  {reportData?.monthlyStats?.totalOpportunities || 0} resultados - Selecione filtros do lado esquerdo e adicione fórmulas, altere colunas ou exporte dados usando os botões do lado direito.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SDROpportunitiesTableWithFilter />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <CustomReportsModal 
          open={customReportsOpen} 
          onOpenChange={setCustomReportsOpen} 
        />
      </div>
    </div>
  );
}

function SDROpportunitiesTableWithFilter() {
  const { data: opportunities } = useQuery<any[]>({
    queryKey: ["/api/opportunities"],
  });

  const [creatorFilter, setCreatorFilter] = useState<string>("");
  const [filteredOpportunities, setFilteredOpportunities] = useState<any[]>([]);

  // Atualizar oportunidades filtradas quando dados ou filtro mudarem
  useEffect(() => {
    if (!opportunities) {
      setFilteredOpportunities([]);
      return;
    }

    let filtered = [...opportunities];

    if (creatorFilter) {
      filtered = filtered.filter(opp => 
        (opp.createdBy || 'Não atribuído').toLowerCase().includes(creatorFilter.toLowerCase())
      );
    }

    setFilteredOpportunities(filtered);
  }, [opportunities, creatorFilter]);

  // Obter lista única de criadores para o filtro
  const uniqueCreators = useMemo(() => {
    if (!opportunities) return [];
    
    const creators = opportunities.map(opp => opp.createdBy || 'Não atribuído');
    return [...new Set(creators)].sort();
  }, [opportunities]);

  const getPhaseDisplayName = (phase: string) => {
    const phaseNames: Record<string, string> = {
      'prospeccao': 'Prospecção',
      'em-atendimento': 'Em Atendimento',
      'visita-tecnica': 'Visita Técnica',
      'proposta': 'Proposta',
      'negociacao': 'Negociação',
      'ganho': 'Ganho',
      'perdido': 'Perdido'
    };
    return phaseNames[phase] || phase;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day} de ${getMonthName(month)} de ${year}`;
  };

  const getMonthName = (month: string) => {
    const months = [
      '', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    return months[parseInt(month)];
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros:</span>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex flex-col space-y-1">
            <label htmlFor="creator-filter" className="text-xs font-medium text-muted-foreground">
              Criador
            </label>
            <select
              id="creator-filter"
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
              className="px-3 py-1 text-sm border border-border rounded-md bg-background"
            >
              <option value="">Todos os criadores</option>
              {uniqueCreators.map((creator) => (
                <option key={creator} value={creator}>
                  {creator}
                </option>
              ))}
            </select>
          </div>
          
          {creatorFilter && (
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreatorFilter("")}
                className="text-xs"
              >
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex items-center text-xs text-muted-foreground ml-auto">
          {filteredOpportunities.length} de {opportunities?.length || 0} oportunidades
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-border">
          <thead>
            <tr className="bg-muted">
              <th className="border border-border px-4 py-2 text-left font-medium">Título</th>
              <th className="border border-border px-4 py-2 text-left font-medium">Fase atual</th>
              <th className="border border-border px-4 py-2 text-left font-medium">Criador</th>
              <th className="border border-border px-4 py-2 text-left font-medium">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {!filteredOpportunities || filteredOpportunities.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-border px-4 py-8 text-center text-muted-foreground">
                  {creatorFilter ? 'Nenhuma oportunidade encontrada com os filtros aplicados' : 'Nenhuma oportunidade encontrada'}
                </td>
              </tr>
            ) : (
              filteredOpportunities.map((opportunity: any) => (
                <tr key={opportunity.id} className="hover:bg-muted/50">
                  <td className="border border-border px-4 py-2">
                    {opportunity.company || opportunity.contact}
                  </td>
                  <td className="border border-border px-4 py-2">
                    {getPhaseDisplayName(opportunity.phase)}
                  </td>
                  <td className="border border-border px-4 py-2">
                    {opportunity.createdBy || 'Não atribuído'}
                  </td>
                  <td className="border border-border px-4 py-2">
                    {opportunity.createdAt ? formatDate(opportunity.createdAt) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}