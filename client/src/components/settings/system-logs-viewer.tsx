import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  AlertTriangle,
  Info,
  AlertCircle,
  XCircle,
  Search,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SystemLog {
  id: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  category: string;
  message: string;
  details?: string;
  user_id?: string;
  user_name?: string;
  ip_address?: string;
  created_at: string;
}

interface SystemLogFilters {
  level?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

const LOG_LEVELS = [
  { value: 'info', label: 'Info', icon: Info, color: 'text-blue-600 bg-blue-50' },
  { value: 'warning', label: 'Warning', icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-50' },
  { value: 'error', label: 'Error', icon: XCircle, color: 'text-red-600 bg-red-50' },
  { value: 'debug', label: 'Debug', icon: AlertCircle, color: 'text-gray-600 bg-gray-50' }
];

const LOG_CATEGORIES = [
  'authentication',
  'authorization',
  'database',
  'api',
  'system',
  'security',
  'performance',
  'backup',
  'email',
  'file_upload'
];

export function SystemLogsViewer() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize] = useState(50);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);

  // Filters
  const [filters, setFilters] = useState<SystemLogFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Load system logs
  useEffect(() => {
    loadSystemLogs();
  }, [currentPage, filters]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (currentPage === 1) {
        loadSystemLogs();
      }
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, currentPage, filters]);

  const loadSystemLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        )
      });

      const response = await fetch(`/api/system/logs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.records || []);
        setTotalPages(data.totalPages || 1);
        setTotalRecords(data.total || 0);
      } else {
        toast({
          title: "Erro",
          description: "Erro ao carregar logs do sistema",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar logs do sistema",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search: searchTerm }));
    setCurrentPage(1);
  };

  const handleFilterChange = (key: keyof SystemLogFilters, value: string | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setCurrentPage(1);
  };

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams({
        export: 'true',
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        )
      });

      const response = await fetch(`/api/system/logs?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({
          title: "Sucesso",
          description: "Logs exportados com sucesso!"
        });
      } else {
        toast({
          title: "Erro",
          description: "Erro ao exportar logs",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({
        title: "Erro",
        description: "Erro ao exportar logs",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getLevelBadge = (level: string) => {
    const levelConfig = LOG_LEVELS.find(l => l.value === level);
    if (!levelConfig) return null;

    const Icon = levelConfig.icon;
    return (
      <Badge className={levelConfig.color}>
        <Icon className="h-3 w-3 mr-1" />
        {levelConfig.label}
      </Badge>
    );
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      authentication: 'bg-blue-100 text-blue-800',
      authorization: 'bg-purple-100 text-purple-800',
      database: 'bg-green-100 text-green-800',
      api: 'bg-orange-100 text-orange-800',
      system: 'bg-gray-100 text-gray-800',
      security: 'bg-red-100 text-red-800',
      performance: 'bg-yellow-100 text-yellow-800',
      backup: 'bg-indigo-100 text-indigo-800',
      email: 'bg-pink-100 text-pink-800',
      file_upload: 'bg-teal-100 text-teal-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getLogStats = () => {
    const stats = LOG_LEVELS.map(level => ({
      ...level,
      count: logs.filter(log => log.level === level.value).length
    }));
    return stats;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Logs do Sistema</h3>
          <p className="text-sm text-muted-foreground">
            Monitore eventos e atividades do sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
          <Button
            variant="outline"
            onClick={exportLogs}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button
            onClick={loadSystemLogs}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Buscar</Label>
                <div className="flex gap-2">
                  <Input
                    id="search"
                    placeholder="Mensagem, usuário, IP..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button size="sm" onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="level">Nível</Label>
                <Select
                  value={filters.level || ''}
                  onValueChange={(value) => 
                    handleFilterChange('level', value === '' ? undefined : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {LOG_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={filters.category || ''}
                  onValueChange={(value) => 
                    handleFilterChange('category', value === '' ? undefined : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {LOG_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="date-from">Data (De)</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => handleFilterChange('date_from', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="date-to">Data (Até)</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => handleFilterChange('date_to', e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {getLogStats().map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.value}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${stat.color.split(' ')[0].replace('bg-', 'text-').replace('-50', '-600')}`} />
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-semibold">{stat.count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum log encontrado</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nível</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {getLevelBadge(log.level)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getCategoryColor(log.category)}>
                          {log.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="truncate">{log.message}</p>
                          {log.ip_address && (
                            <p className="text-xs text-muted-foreground font-mono">
                              IP: {log.ip_address}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.user_name ? (
                          <div>
                            <p className="text-sm font-medium">{log.user_name}</p>
                            <p className="text-xs text-muted-foreground">ID: {log.user_id}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sistema</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(log.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.details && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalRecords)} de {totalRecords} registros
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Detalhes do Log
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLog(null)}
                >
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nível</Label>
                      <div className="mt-1">{getLevelBadge(selectedLog.level)}</div>
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <div className="mt-1">
                        <Badge className={getCategoryColor(selectedLog.category)}>
                          {selectedLog.category}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Mensagem</Label>
                    <p className="mt-1 p-3 bg-muted rounded-md">{selectedLog.message}</p>
                  </div>

                  {selectedLog.details && (
                    <div>
                      <Label>Detalhes</Label>
                      <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-x-auto whitespace-pre-wrap">
                        {selectedLog.details}
                      </pre>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Usuário</Label>
                      <p className="mt-1">
                        {selectedLog.user_name || 'Sistema'}
                        {selectedLog.user_id && (
                          <span className="text-muted-foreground"> (ID: {selectedLog.user_id})</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <Label>IP</Label>
                      <p className="mt-1 font-mono">{selectedLog.ip_address || 'N/A'}</p>
                    </div>
                  </div>

                  <div>
                    <Label>Data/Hora</Label>
                    <p className="mt-1">{formatDate(selectedLog.created_at)}</p>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}