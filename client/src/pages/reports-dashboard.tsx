
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Clock, 
  BarChart3, 
  TrendingUp, 
  Thermometer,
  Target,
  DollarSign,
  Users,
  Calendar,
  Award
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Opportunity, User } from "@shared/schema";
import { PHASES } from "@shared/schema";

export default function ReportsDashboard() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPhase, setSelectedPhase] = useState("all");
  const [selectedTemperature, setSelectedTemperature] = useState("all");

  // Fetch opportunities
  const { data: opportunities = [], isLoading: opportunitiesLoading, refetch } = useQuery<Opportunity[]>({
    queryKey: ["/api/opportunities"],
    refetchInterval: 30000,
  });

  // Fetch users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users/salespeople"],
  });

  // Filter opportunities
  const filteredOpportunities = useMemo(() => {
    let filtered = opportunities;

    if (selectedPhase !== "all") {
      filtered = filtered.filter(opp => opp.phase === selectedPhase);
    }

    if (selectedTemperature !== "all") {
      filtered = filtered.filter(opp => opp.businessTemperature === selectedTemperature);
    }

    if (searchTerm) {
      filtered = filtered.filter(opp => 
        opp.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opp.company.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [opportunities, selectedPhase, selectedTemperature, searchTerm]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = filteredOpportunities.length;
    const won = filteredOpportunities.filter(o => o.phase === 'ganho').length;
    const lost = filteredOpportunities.filter(o => o.phase === 'perdido').length;
    const active = filteredOpportunities.filter(o => !['ganho', 'perdido'].includes(o.phase)).length;

    const totalValue = filteredOpportunities.reduce((sum, o) => {
      const value = parseFloat(o.budget?.toString() || '0');
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

    const wonValue = filteredOpportunities
      .filter(o => o.phase === 'ganho')
      .reduce((sum, o) => {
        const value = parseFloat(o.finalValue?.toString() || o.budget?.toString() || '0');
        return sum + (isNaN(value) ? 0 : value);
      }, 0);

    const conversionRate = total > 0 ? (won / total) * 100 : 0;
    const avgTicket = won > 0 ? wonValue / won : 0;

    return {
      total,
      won,
      lost,
      active,
      totalValue,
      wonValue,
      conversionRate,
      avgTicket
    };
  }, [filteredOpportunities]);

  // Phase distribution
  const phaseDistribution = useMemo(() => {
    const phaseCounts = filteredOpportunities.reduce((acc, opp) => {
      acc[opp.phase] = (acc[opp.phase] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const phaseConfig = [
      { key: PHASES.PROSPECCAO, title: "Prospecção", color: "bg-orange-500" },
      { key: PHASES.EM_ATENDIMENTO, title: "Em Atendimento", color: "bg-purple-500" },
      { key: PHASES.VISITA_TECNICA, title: "Visita Técnica", color: "bg-blue-500" },
      { key: PHASES.PROPOSTA, title: "Proposta", color: "bg-pink-500" },
      { key: PHASES.NEGOCIACAO, title: "Negociação", color: "bg-indigo-500" },
      { key: PHASES.GANHO, title: "Ganho", color: "bg-green-500" },
      { key: PHASES.PERDIDO, title: "Perdido", color: "bg-red-500" },
    ];

    return phaseConfig.map(phase => ({
      ...phase,
      count: phaseCounts[phase.key] || 0,
      percentage: filteredOpportunities.length > 0 ? ((phaseCounts[phase.key] || 0) / filteredOpportunities.length) * 100 : 0
    })).filter(phase => phase.count > 0);
  }, [filteredOpportunities]);

  // Temperature distribution
  const temperatureDistribution = useMemo(() => {
    const tempCounts = filteredOpportunities.reduce((acc, opp) => {
      const temp = opp.businessTemperature || 'morno';
      acc[temp] = (acc[temp] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { name: "Quente", value: tempCounts.quente || 0, color: "bg-red-500" },
      { name: "Morno", value: tempCounts.morno || 0, color: "bg-yellow-500" },
      { name: "Frio", value: tempCounts.frio || 0, color: "bg-blue-500" }
    ].filter(temp => temp.value > 0);
  }, [filteredOpportunities]);

  // Average time per phase (simplified calculation)
  const averageTimePerPhase = useMemo(() => {
    const phaseConfig = [
      { key: PHASES.PROSPECCAO, title: "Prospecção" },
      { key: PHASES.EM_ATENDIMENTO, title: "Em Atendimento" },
      { key: PHASES.VISITA_TECNICA, title: "Visita Técnica" },
      { key: PHASES.PROPOSTA, title: "Proposta" },
      { key: PHASES.NEGOCIACAO, title: "Negociação" },
    ];

    return phaseConfig.map(phase => {
      const phaseOpportunities = filteredOpportunities.filter(o => o.phase === phase.key);
      
      if (phaseOpportunities.length === 0) return { ...phase, avgDays: 0, count: 0 };

      const avgDays = phaseOpportunities.reduce((sum, opp) => {
        const createdAt = new Date(opp.createdAt);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return sum + daysDiff;
      }, 0) / phaseOpportunities.length;

      return {
        ...phase,
        avgDays: Math.round(avgDays),
        count: phaseOpportunities.length
      };
    }).filter(phase => phase.count > 0);
  }, [filteredOpportunities]);

  // Performance by salesperson
  const performanceBySalesperson = useMemo(() => {
    const salespeople = users.reduce((acc, user) => {
      acc[user.name] = { name: user.name, total: 0, won: 0, value: 0 };
      return acc;
    }, {} as Record<string, { name: string; total: number; won: number; value: number }>);

    filteredOpportunities.forEach(opp => {
      const salesperson = opp.salesperson || 'Não atribuído';
      if (!salespeople[salesperson]) {
        salespeople[salesperson] = { name: salesperson, total: 0, won: 0, value: 0 };
      }

      salespeople[salesperson].total++;
      if (opp.phase === 'ganho') {
        salespeople[salesperson].won++;
        const value = parseFloat(opp.finalValue?.toString() || opp.budget?.toString() || '0');
        salespeople[salesperson].value += isNaN(value) ? 0 : value;
      }
    });

    return Object.values(salespeople)
      .filter(s => s.total > 0)
      .map(s => ({
        ...s,
        conversionRate: s.total > 0 ? (s.won / s.total) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredOpportunities, users]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (opportunitiesLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Relatórios do CRM</h1>
            <p className="text-muted-foreground mt-2">Carregando dados...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="reports-dashboard">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Relatórios do CRM</h1>
              <p className="text-muted-foreground mt-2">
                Análise completa do funil de vendas e performance
              </p>
            </div>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as fases</SelectItem>
              <SelectItem value="prospeccao">Prospecção</SelectItem>
              <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
              <SelectItem value="visita_tecnica">Visita Técnica</SelectItem>
              <SelectItem value="proposta">Proposta</SelectItem>
              <SelectItem value="negociacao">Negociação</SelectItem>
              <SelectItem value="ganho">Ganho</SelectItem>
              <SelectItem value="perdido">Perdido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedTemperature} onValueChange={setSelectedTemperature}>
            <SelectTrigger className="w-48">
              <Thermometer className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as temperaturas</SelectItem>
              <SelectItem value="quente">Quente</SelectItem>
              <SelectItem value="morno">Morno</SelectItem>
              <SelectItem value="frio">Frio</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Oportunidades</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.active} ativas • {metrics.won} ganhas • {metrics.lost} perdidas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {metrics.won} conversões de {metrics.total} oportunidades
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.wonValue)}</div>
              <p className="text-xs text-muted-foreground">
                De {formatCurrency(metrics.totalValue)} em pipeline
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.avgTicket)}</div>
              <p className="text-xs text-muted-foreground">
                Valor médio por venda
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Distribution by Phase */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Distribuição por Fase</span>
              </CardTitle>
              <CardDescription>Quantidade de oportunidades em cada fase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {phaseDistribution.map((phase) => (
                <div key={phase.key} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${phase.color}`}></div>
                    <span className="text-sm font-medium">{phase.title}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">{phase.percentage.toFixed(1)}%</span>
                    <Badge variant="secondary">{phase.count}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Temperature Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Thermometer className="h-5 w-5" />
                <span>Temperatura de Negócio</span>
              </CardTitle>
              <CardDescription>Distribuição das oportunidades por temperatura</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {temperatureDistribution.map((temp) => (
                <div key={temp.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${temp.color}`}></div>
                    <span className="text-sm font-medium">{temp.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      {filteredOpportunities.length > 0 ? ((temp.value / filteredOpportunities.length) * 100).toFixed(1) : 0}%
                    </span>
                    <Badge variant="secondary">{temp.value}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Average Time Per Phase */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Tempo Médio por Fase</span>
              </CardTitle>
              <CardDescription>Tempo médio que as oportunidades ficam em cada fase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {averageTimePerPhase.map((phase) => (
                <div key={phase.key} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{phase.title}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">{phase.avgDays} dias</span>
                    <Badge variant="outline">{phase.count} oportunidades</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Performance by Salesperson */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Performance por Vendedor</span>
              </CardTitle>
              <CardDescription>Ranking de vendedores por valor gerado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {performanceBySalesperson.slice(0, 5).map((salesperson) => (
                <div key={salesperson.name} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{salesperson.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {salesperson.won}/{salesperson.total} • {salesperson.conversionRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{formatCurrency(salesperson.value)}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Mostrando {filteredOpportunities.length} de {opportunities.length} oportunidades
        </div>
      </div>
    </div>
  );
}
