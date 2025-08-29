import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, TrendingUp, Users, Target, Filter, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CustomReportsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FilterOptions {
  salesperson?: string;
  phase?: string;
  businessTemperature?: string;
  dateRange?: string;
}

const PHASE_OPTIONS = [
  { value: 'prospeccao', label: 'Prospecção' },
  { value: 'em-atendimento', label: 'Em Atendimento' },
  { value: 'visita-tecnica', label: 'Visita Técnica' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'ganho', label: 'Ganho' },
  { value: 'perdido', label: 'Perdido' }
];

const TEMPERATURE_OPTIONS = [
  { value: 'quente', label: 'Quente' },
  { value: 'morno', label: 'Morno' },
  { value: 'frio', label: 'Frio' }
];

const DATE_RANGE_OPTIONS = [
  { value: 'last-7-days', label: 'Últimos 7 dias' },
  { value: 'last-30-days', label: 'Últimos 30 dias' },
  { value: 'last-90-days', label: 'Últimos 90 dias' },
  { value: 'current-month', label: 'Mês atual' },
  { value: 'last-month', label: 'Mês passado' },
  { value: 'current-year', label: 'Ano atual' }
];

export default function CustomReportsModal({ open, onOpenChange }: CustomReportsModalProps) {
  const [filters, setFilters] = useState<FilterOptions>({});
  const [reportData, setReportData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Fetch salespeople for filter options
  const { data: salespeople } = useQuery<any[]>({
    queryKey: ["/api/users/salespeople"],
  });

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') queryParams.append(key, value);
      });

      const response = await fetch(`/api/reports/custom?${queryParams}`);
      if (!response.ok) throw new Error('Falha ao gerar relatório');
      
      const data = await response.json();
      setReportData(data);
      
      toast({
        title: "Relatório gerado com sucesso!",
        description: "Seus dados filtrados estão prontos.",
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar relatório",
        description: "Tente novamente em alguns momentos.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const clearFilters = () => {
    setFilters({});
    setReportData(null);
  };

  const exportData = () => {
    if (!reportData) return;
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Empresa,Contato,Fase,Vendedor,Temperatura,Valor\n"
      + reportData.opportunities?.map((opp: any) => 
          `"${opp.company}","${opp.contact}","${opp.phase}","${opp.salesperson || 'Não atribuído'}","${opp.businessTemperature || 'Não informado'}","${opp.budget || 0}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio-personalizado-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" data-testid="custom-reports-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Criar Relatório Personalizado
          </DialogTitle>
          <DialogDescription>
            Crie relatórios customizados com base nos dados do seu sistema. 
            Escolha os filtros desejados e gere insights específicos para sua análise.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filters Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="salesperson-filter">Vendedor</Label>
              <Select 
                value={filters.salesperson || "all"} 
                onValueChange={(value) => setFilters({...filters, salesperson: value === "all" ? undefined : value})}
              >
                <SelectTrigger id="salesperson-filter" data-testid="select-salesperson">
                  <SelectValue placeholder="Todos os vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os vendedores</SelectItem>
                  {salespeople?.map((person) => (
                    <SelectItem key={person.id} value={person.name}>
                      {person.name} ({person.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phase-filter">Fase</Label>
              <Select 
                value={filters.phase || "all"} 
                onValueChange={(value) => setFilters({...filters, phase: value === "all" ? undefined : value})}
              >
                <SelectTrigger id="phase-filter" data-testid="select-phase">
                  <SelectValue placeholder="Todas as fases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fases</SelectItem>
                  {PHASE_OPTIONS.map((phase) => (
                    <SelectItem key={phase.value} value={phase.value}>
                      {phase.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperature-filter">Temperatura do Negócio</Label>
              <Select 
                value={filters.businessTemperature || "all"} 
                onValueChange={(value) => setFilters({...filters, businessTemperature: value === "all" ? undefined : value})}
              >
                <SelectTrigger id="temperature-filter" data-testid="select-temperature">
                  <SelectValue placeholder="Todas as temperaturas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as temperaturas</SelectItem>
                  {TEMPERATURE_OPTIONS.map((temp) => (
                    <SelectItem key={temp.value} value={temp.value}>
                      {temp.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-range-filter">Período</Label>
              <Select 
                value={filters.dateRange || "all"} 
                onValueChange={(value) => setFilters({...filters, dateRange: value === "all" ? undefined : value})}
              >
                <SelectTrigger id="date-range-filter" data-testid="select-date-range">
                  <SelectValue placeholder="Todo o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o período</SelectItem>
                  {DATE_RANGE_OPTIONS.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                onClick={generateReport} 
                disabled={isGenerating}
                className="w-full"
                data-testid="button-generate-report"
              >
                {isGenerating ? "Gerando..." : "Gerar Relatório"}
              </Button>
              <Button 
                variant="outline" 
                onClick={clearFilters}
                className="w-full"
                data-testid="button-clear-filters"
              >
                Limpar Filtros
              </Button>
            </div>

            {Object.keys(filters).some(key => filters[key as keyof FilterOptions] && filters[key as keyof FilterOptions] !== "all") && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Filtros Ativos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {filters.salesperson && <Badge variant="secondary">Vendedor: {filters.salesperson}</Badge>}
                  {filters.phase && <Badge variant="secondary">Fase: {PHASE_OPTIONS.find(p => p.value === filters.phase)?.label}</Badge>}
                  {filters.businessTemperature && <Badge variant="secondary">Temperatura: {TEMPERATURE_OPTIONS.find(t => t.value === filters.businessTemperature)?.label}</Badge>}
                  {filters.dateRange && <Badge variant="secondary">Período: {DATE_RANGE_OPTIONS.find(d => d.value === filters.dateRange)?.label}</Badge>}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Results Section */}
          <div className="lg:col-span-2 space-y-4">
            {reportData ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="metric-custom-total">
                        {reportData.summary.totalOpportunities}
                      </div>
                      <p className="text-xs text-muted-foreground">Oportunidades</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Receita</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold" data-testid="metric-custom-revenue">
                        {formatCurrency(reportData.summary.totalRevenue)}
                      </div>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Taxa Conversão</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold" data-testid="metric-custom-conversion">
                        {reportData.summary.conversionRate}%
                      </div>
                      <p className="text-xs text-muted-foreground">Ganhas/Total</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Ticket Médio</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold" data-testid="metric-custom-ticket">
                        {formatCurrency(reportData.summary.averageTicket)}
                      </div>
                      <p className="text-xs text-muted-foreground">Por oportunidade</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                {reportData.charts && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {reportData.charts.phaseDistribution && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Distribuição por Fase</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={reportData.charts.phaseDistribution}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" fontSize={12} />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="count" fill="#f97316" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}

                    {reportData.charts.temperatureDistribution && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Distribuição por Temperatura</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={reportData.charts.temperatureDistribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="count"
                              >
                                {reportData.charts.temperatureDistribution.map((entry: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={['#f97316', '#06d6a0', '#ffd60a'][index % 3]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Export Button */}
                <div className="flex justify-end">
                  <Button 
                    onClick={exportData} 
                    variant="outline"
                    data-testid="button-export-data"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhum relatório gerado</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure os filtros desejados e clique em "Gerar Relatório" para visualizar seus dados customizados.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}