import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Play, 
  Pause, 
  RefreshCw, 
  Clock, 
  BarChart3, 
  TrendingUp, 
  Users, 
  Target,
  Eye,
  Share2,
  Download
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { SavedReport } from "@shared/schema";

export default function ReportsDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [createReportOpen, setCreateReportOpen] = useState(false);

  // Fetch saved reports
  const { data: savedReports = [], isLoading: reportsLoading, refetch: refetchReports } = useQuery<SavedReport[]>({
    queryKey: ["/api/reports/saved"],
    refetchInterval: 60000,
  });

  // Fetch quick stats
  const { data: quickStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/reports/quick-stats"],
    refetchInterval: 30000,
  });

  // Filter reports
  const filteredReports = useMemo(() => {
    let filtered = savedReports;

    if (selectedCategory !== "all") {
      filtered = filtered.filter(report => report.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(report => 
        report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (report.description && report.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    return filtered;
  }, [savedReports, searchTerm, selectedCategory]);

  // Handle actions
  const handleRunReport = async (reportId: string) => {
    try {
      await apiRequest("POST", `/api/reports/saved/${reportId}/run`);
      await refetchReports();
      toast({
        title: "Relatório atualizado",
        description: "Os dados foram atualizados com sucesso."
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível executar o relatório.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      await apiRequest("DELETE", `/api/reports/saved/${reportId}`);
      await refetchReports();
      toast({
        title: "Relatório removido",
        description: "O relatório foi excluído com sucesso."
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover o relatório.",
        variant: "destructive"
      });
    }
  };

  if (reportsLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Central de Relatórios</h1>
            <p className="text-muted-foreground mt-2">Carregando seus relatórios...</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'performance': return <TrendingUp className="h-4 w-4" />;
      case 'pipeline': return <BarChart3 className="h-4 w-4" />;
      case 'analysis': return <Target className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'performance': return 'Performance';
      case 'pipeline': return 'Pipeline';
      case 'analysis': return 'Análise';
      case 'custom': return 'Personalizado';
      default: return 'Outros';
    }
  };

  const formatLastGenerated = (date: string | null) => {
    if (!date) return 'Nunca executado';
    const now = new Date();
    const generated = new Date(date);
    const diffMs = now.getTime() - generated.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h atrás`;
    return `${Math.floor(diffMins / 1440)} dias atrás`;
  };

  return (
    <div className="min-h-screen bg-background" data-testid="reports-dashboard">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Central de Relatórios</h1>
              <p className="text-muted-foreground mt-2">
                Gerencie e visualize seus relatórios personalizados
              </p>
            </div>
            <Dialog open={createReportOpen} onOpenChange={setCreateReportOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-report">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Relatório
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Criar Novo Relatório</DialogTitle>
                  <DialogDescription>
                    Configure seu relatório personalizado com filtros e visualizações
                  </DialogDescription>
                </DialogHeader>
                <CreateReportForm onSuccess={() => {
                  setCreateReportOpen(false);
                  refetchReports();
                }} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Relatórios</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{savedReports.length}</div>
              <p className="text-xs text-muted-foreground">
                {savedReports.filter(r => r.autoRefresh).length} com auto-atualização
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Executados Hoje</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {savedReports.filter(r => {
                  if (!r.lastGenerated) return false;
                  const today = new Date().toDateString();
                  const generated = new Date(r.lastGenerated).toDateString();
                  return today === generated;
                }).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Relatórios atualizados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mais Popular</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Pipeline</div>
              <p className="text-xs text-muted-foreground">
                Categoria mais usada
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Públicos</CardTitle>
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {savedReports.filter(r => r.isPublic).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Compartilhados com equipe
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar relatórios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-reports"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48" data-testid="select-category">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="pipeline">Pipeline</SelectItem>
              <SelectItem value="analysis">Análise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {getCategoryIcon(report.category)}
                    <div>
                      <CardTitle className="text-lg">{report.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {report.description || 'Sem descrição'}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleRunReport(report.id)}>
                        <Play className="h-4 w-4 mr-2" />
                        Executar Agora
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteReport(report.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <Badge variant="outline">
                    {getCategoryName(report.category)}
                  </Badge>
                  <div className="flex items-center space-x-1">
                    {report.autoRefresh ? (
                      <RefreshCw className="h-3 w-3 text-green-500" />
                    ) : (
                      <Pause className="h-3 w-3 text-gray-400" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {report.autoRefresh ? 'Auto' : 'Manual'}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>Última execução: {formatLastGenerated(report.lastGenerated)}</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => handleRunReport(report.id)}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Executar
                  </Button>
                  <Button size="sm" variant="outline">
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredReports.length === 0 && (
            <div className="col-span-full">
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum relatório encontrado</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    {searchTerm || selectedCategory !== "all" 
                      ? "Tente ajustar seus filtros de busca"
                      : "Comece criando seu primeiro relatório personalizado"
                    }
                  </p>
                  {!searchTerm && selectedCategory === "all" && (
                    <Button onClick={() => setCreateReportOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Primeiro Relatório
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple create report form component
function CreateReportForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "custom"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await apiRequest("POST", "/api/reports/saved", {
        ...formData,
        filters: {},
        charts: {},
        layout: {},
        autoRefresh: true,
        refreshInterval: 30
      });
      
      toast({
        title: "Relatório criado",
        description: "Seu novo relatório foi criado com sucesso."
      });
      
      onSuccess();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar o relatório.",
        variant: "destructive"
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Nome do Relatório</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Ex: Relatório de Vendas Mensal"
          required
        />
      </div>
      
      <div>
        <label className="text-sm font-medium">Descrição</label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Descreva o propósito deste relatório"
        />
      </div>
      
      <div>
        <label className="text-sm font-medium">Categoria</label>
        <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Personalizado</SelectItem>
            <SelectItem value="performance">Performance</SelectItem>
            <SelectItem value="pipeline">Pipeline</SelectItem>
            <SelectItem value="analysis">Análise</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline">Cancelar</Button>
        <Button type="submit">Criar Relatório</Button>
      </div>
    </form>
  );
}