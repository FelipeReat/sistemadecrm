
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { DollarSign, TrendingUp, Users, Target } from "lucide-react";

interface BillingReportData {
  salespersonBilling: Array<{
    salesperson: string;
    totalRevenue: number;
    totalOpportunities: number;
    wonOpportunities: number;
    avgTicket: number;
    conversionRate: number;
  }>;
  totalRevenue: number;
  totalOpportunities: number;
  totalWonOpportunities: number;
  avgTicketOverall: number;
}

export default function BillingReport() {
  const { data: billingData, isLoading } = useQuery<BillingReportData>({
    queryKey: ["/api/reports/billing"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Relatório de Faturamento por Vendedor</h1>
            <p className="text-gray-600 mt-2">Carregando dados...</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const chartColors = ['#f97316', '#06d6a0', '#ffd60a', '#3b82f6', '#ec4899', '#06b6d4', '#10b981'];

  return (
    <div className="min-h-screen bg-gray-50" data-testid="billing-report">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900" data-testid="title-billing-report">
            Relatório de Faturamento por Vendedor
          </h1>
          <p className="text-gray-600 mt-2">
            Análise detalhada da performance de vendas e faturamento por vendedor
          </p>
        </div>

        {/* KPIs Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Faturamento Total
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-total-billing">
                {billingData?.totalRevenue ? formatCurrency(billingData.totalRevenue) : 'R$ 0,00'}
              </div>
              <p className="text-xs text-green-600 mt-1">
                Total de receita conquistada
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Vendedores Ativos
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-active-salespeople">
                {billingData?.salespersonBilling?.length || 0}
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Vendedores com oportunidades
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ticket Médio Geral
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-avg-ticket">
                {billingData?.avgTicketOverall ? formatCurrency(billingData.avgTicketOverall) : 'R$ 0,00'}
              </div>
              <p className="text-xs text-green-600 mt-1">
                Valor médio por venda
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Taxa de Conversão Geral
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-overall-conversion">
                {billingData && billingData.totalOpportunities > 0 ? 
                  `${((billingData.totalWonOpportunities / billingData.totalOpportunities) * 100).toFixed(1)}%` 
                  : '0%'
                }
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Conversão média da equipe
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Faturamento por Vendedor - Gráfico de Barras */}
          <Card>
            <CardHeader>
              <CardTitle>Faturamento por Vendedor</CardTitle>
              <CardDescription>
                Comparativo de receita entre os vendedores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={billingData?.salespersonBilling || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="salesperson" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={12}
                  />
                  <YAxis 
                    tickFormatter={(value) => `R$ ${(value/1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value) => [formatCurrency(Number(value)), 'Faturamento']}
                  />
                  <Bar 
                    dataKey="totalRevenue" 
                    fill="#f97316"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Participação no Faturamento - Gráfico Pizza */}
          <Card>
            <CardHeader>
              <CardTitle>Participação no Faturamento</CardTitle>
              <CardDescription>
                Percentual de contribuição de cada vendedor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={billingData?.salespersonBilling || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="totalRevenue"
                  >
                    {billingData?.salespersonBilling?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Faturamento']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tabela Detalhada */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Vendedor</CardTitle>
            <CardDescription>
              Performance completa de cada vendedor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-center">Oportunidades</TableHead>
                  <TableHead className="text-center">Vendas</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="text-center">Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingData?.salespersonBilling?.map((salesperson, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {salesperson.salesperson}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {formatCurrency(salesperson.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {salesperson.totalOpportunities}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="default">
                        {salesperson.wonOpportunities}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(salesperson.avgTicket)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={salesperson.conversionRate >= 30 ? "default" : "secondary"}
                        className={salesperson.conversionRate >= 30 ? "bg-green-100 text-green-800" : ""}
                      >
                        {salesperson.conversionRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                )) || (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-sm text-gray-500">
                        Nenhum dado de faturamento disponível
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Ranking Section */}
        {billingData?.salespersonBilling && billingData.salespersonBilling.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {/* Top Faturamento */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  🏆 Top Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {billingData.salespersonBilling
                    .sort((a, b) => b.totalRevenue - a.totalRevenue)
                    .slice(0, 3)
                    .map((salesperson, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">
                          {index + 1}. {salesperson.salesperson}
                        </span>
                        <span className="text-sm font-bold text-green-600">
                          {formatCurrency(salesperson.totalRevenue)}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Melhor Taxa de Conversão */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  🎯 Melhor Conversão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {billingData.salespersonBilling
                    .sort((a, b) => b.conversionRate - a.conversionRate)
                    .slice(0, 3)
                    .map((salesperson, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">
                          {index + 1}. {salesperson.salesperson}
                        </span>
                        <span className="text-sm font-bold text-blue-600">
                          {salesperson.conversionRate.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Maior Ticket Médio */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  💰 Maior Ticket Médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {billingData.salespersonBilling
                    .sort((a, b) => b.avgTicket - a.avgTicket)
                    .slice(0, 3)
                    .map((salesperson, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">
                          {index + 1}. {salesperson.salesperson}
                        </span>
                        <span className="text-sm font-bold text-purple-600">
                          {formatCurrency(salesperson.avgTicket)}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
