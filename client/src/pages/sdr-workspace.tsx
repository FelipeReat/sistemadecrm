import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Opportunity, User } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import NewOpportunityModal from "@/components/new-opportunity-modal";
import OpportunityDetailsModal from "@/components/opportunity-details-modal";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ClipboardList,
  Eye,
  FileSpreadsheet,
  KanbanSquare,
  LayoutDashboard,
  Map as MapIcon,
  Plus,
  Target,
  Users,
} from "lucide-react";

const MONTHLY_TARGET = 50;

const ORIGIN_OPTIONS = [
  "Locador - sem locacao 3 meses",
  "Locador - sem locacao 6 meses",
  "Instagram",
  "Grupos de WhatsApp",
  "CNO",
  "Lista de transmissao WhatsApp",
  "Celular principal 1",
  "Celular principal 2",
  "Dropdesk",
  "Trafego pago",
  "Site",
  "Google Maps",
  "Indicacao",
  "Acao externa",
  "Outro",
];

const DAILY_SCHEDULE = [
  {
    time: "08:00 - 08:20",
    block: "Abertura e alinhamento",
    action: "Ler metas do dia, revisar pendencias e verificar mensagens dos dois celulares, Dropdesk, site e leads de anuncios.",
    goal: "Nenhum lead novo sem leitura no inicio do dia.",
    required: "Atualizar pendencias na aba Leads.",
  },
  {
    time: "08:20 - 09:00",
    block: "Triagem de entradas",
    action: "Classificar leads que chegaram por WhatsApp, Dropdesk, trafego pago, site e Instagram.",
    goal: "Separar: urgente, proposta, visita, sem perfil, reativacao.",
    required: "Status, origem e proximo passo.",
  },
  {
    time: "09:00 - 10:30",
    block: "Prospeccao ativa - base interna",
    action: "Usar o Locador para filtrar clientes sem locar ha 3 ou 6 meses e iniciar reativacao.",
    goal: "Gerar contatos qualificados e registrar feedback.",
    required: "Nome, equipamento, contato, feedback e data do proximo contato.",
  },
  {
    time: "10:30 - 11:30",
    block: "Prospeccao externa digital",
    action: "Pesquisar Instagram, grupos de WhatsApp, Google Maps, CNO e empresas com obras em Manaus e cidades proximas.",
    goal: "Cadastrar oportunidades com potencial real.",
    required: "Origem/base, cidade, tipo e qualidade do lead.",
  },
  {
    time: "11:30 - 12:00",
    block: "Repasse para vendedores",
    action: "Enviar oportunidades qualificadas para vendedor responsavel, com contexto e necessidade do cliente.",
    goal: "Todo lead quente precisa ter dono e proximo passo.",
    required: "Vendedor responsavel e repassado = Sim.",
  },
  {
    time: "13:30 - 14:30",
    block: "Follow-up de oportunidades",
    action: "Retomar leads sem retorno, propostas abertas e clientes que demonstraram interesse.",
    goal: "Nenhuma oportunidade quente sem retorno por mais de 48h.",
    required: "Proximo passo, horario e feedback atualizado.",
  },
  {
    time: "14:30 - 15:30",
    block: "Listas de transmissao e conteudo",
    action: "Enviar mensagens e videos de marketing para listas segmentadas, sem disparo generico.",
    goal: "Segmentar por perfil: obra, manutencao, industria, construtora, cliente inativo.",
    required: "Registrar campanha, feedback e interessados.",
  },
  {
    time: "15:30 - 16:30",
    block: "Alinhamento com vendedores",
    action: "Confirmar visitas realizadas, resultado de cada visita e proximos passos.",
    goal: "Toda visita precisa gerar registro detalhado.",
    required: "Preencher aba Visitas Vendedores.",
  },
  {
    time: "16:30 - 17:00",
    block: "Fechamento do dia",
    action: "Consolidar leads gerados, leads qualificados, repasses, visitas e bloqueios.",
    goal: "Enviar resumo para Thayssa.",
    required: "Resumo diario + pendencias para o dia seguinte.",
  },
];

const PROSPECTION_BASES = [
  {
    source: "Locador - clientes sem locar ha 3 meses",
    how: "Filtrar clientes ativos sem locacao recente e entrar em contato para entender nova demanda.",
    filter: "Sem locacao ha 90 dias, historico de obras, equipamentos ja locados.",
    type: "Reativacao rapida com maior chance de fechamento.",
    care: "Nao mandar mensagem generica; citar historico e possivel necessidade.",
  },
  {
    source: "Locador - clientes sem locar ha 6 meses",
    how: "Criar lista de recuperacao com clientes que esfriaram e precisam de nova abordagem.",
    filter: "Sem locacao ha 180 dias; ticket anterior; segmento.",
    type: "Reativacao e limpeza de carteira.",
    care: "Classificar motivo de parada: preco, atendimento, obra finalizada, concorrente.",
  },
  {
    source: "Instagram da empresa",
    how: "Responder directs, comentarios e interacoes nos stories e seguidores com perfil de obra/empresa.",
    filter: "Curtidas, comentarios, direct, perfis de construtoras, obras e manutencao.",
    type: "Lead inbound e relacionamento.",
    care: "Registrar origem como Instagram e nao deixar mensagem sem retorno.",
  },
  {
    source: "Grupos de WhatsApp",
    how: "Monitorar grupos de construcao, manutencao, obras, prestadores e empresas locais.",
    filter: "Pedidos de equipamento, obra em andamento, indicacao de fornecedor.",
    type: "Prospeccao ativa e oportunidade local.",
    care: "Nao fazer spam; abordar com contexto e educacao.",
  },
  {
    source: "Cadastro Nacional de Obras - CNO",
    how: "Pesquisar obras em Manaus e cidades proximas para mapear empresas/obras ativas.",
    filter: "Municipio, situacao da obra, responsavel, segmento.",
    type: "Oportunidades de obra em andamento.",
    care: "Validar dados antes de repassar ao vendedor.",
  },
  {
    source: "Lista de transmissao WhatsApp",
    how: "Enviar mensagens, videos e campanhas de marketing para clientes segmentados.",
    filter: "Separar por cliente inativo, obra, industria, manutencao, construtora.",
    type: "Reativacao e geracao de demanda.",
    care: "Evitar disparo sem segmentacao; registrar respostas.",
  },
  {
    source: "Celular principal 1",
    how: "Ler mensagens recebidas, recuperar conversas antigas e classificar oportunidades.",
    filter: "Mensagens nao respondidas, clientes antigos, pedidos de orcamento.",
    type: "Inbound e recuperacao de oportunidades.",
    care: "Toda conversa com potencial deve virar registro.",
  },
  {
    source: "Celular principal 2",
    how: "Mesmo processo do celular 1, garantindo que nenhum contato fique perdido.",
    filter: "Conversas recentes e antigas, pedidos pendentes.",
    type: "Inbound, reativacao e propostas.",
    care: "Padronizar feedback no cadastro.",
  },
  {
    source: "Dropdesk",
    how: "Classificar mensagens recebidas e transformar atendimento em oportunidade registrada.",
    filter: "Novos atendimentos, solicitacoes de preco, duvidas sobre equipamento.",
    type: "Inbound qualificado.",
    care: "Definir responsavel e proximo passo.",
  },
  {
    source: "Anuncios de trafego pago",
    how: "Tratar leads vindos de campanhas Meta/Google com velocidade.",
    filter: "Leads do dia, formularios, WhatsApp, campanhas especificas.",
    type: "Lead quente de alta prioridade.",
    care: "SLA rapido; registrar campanha quando souber.",
  },
  {
    source: "Site e formularios",
    how: "Responder solicitacoes e registrar dados completos.",
    filter: "Formularios, paginas de equipamento, contatos via site.",
    type: "Lead inbound com intencao.",
    care: "Confirmar telefone, equipamento e prazo de locacao.",
  },
  {
    source: "Google Maps",
    how: "Pesquisar construtoras, industrias, galpoes, obras, prestadores e empresas locais.",
    filter: "Manaus, Itacoatiara, Manacapuru, Iranduba e cidades proximas.",
    type: "Prospeccao ativa B2B.",
    care: "Validar se ha potencial antes de repassar.",
  },
  {
    source: "Indicacoes internas",
    how: "Pedir aos vendedores e operacao nomes de clientes/obras com potencial.",
    filter: "Clientes atendidos, obras vistas, contatos de campo.",
    type: "Oportunidade quente por indicacao.",
    care: "Registrar quem indicou e acompanhar retorno.",
  },
  {
    source: "Acoes externas / eventos",
    how: "Registrar contatos obtidos em visitas, eventos, obras e acoes comerciais.",
    filter: "Cartoes, contatos de obra, responsaveis por compra/locacao.",
    type: "Abertura de mercado.",
    care: "Nao deixar contato solto sem proximo passo.",
  },
];

const VALIDATION_LISTS = {
  origens: ORIGIN_OPTIONS,
  status: [
    "Novo",
    "Em contato",
    "Qualificado",
    "Repassado ao vendedor",
    "Proposta gerada",
    "Visita agendada",
    "Sem retorno",
    "Perdido",
    "Fechado",
    "Descartado",
  ],
  vendedores: ["Wollace", "Thayssa", "Marcio", "Luan", "Sanmiria", "A definir"],
  qualidade: ["Qualificado", "Morno", "Frio", "Sem perfil", "Duplicado"],
  tipoOportunidade: [
    "Novo cliente",
    "Reativacao",
    "Oportunidade de obra",
    "Lead inbound",
    "Indicacao",
    "Recuperacao de proposta",
    "Outro",
  ],
  simNao: ["Sim", "Nao", "Pendente"],
  tipoVisita: ["Prospeccao", "Follow-up", "Medicao/levantamento", "Negociacao", "Pos-venda", "Recuperacao", "Outro"],
  statusVisita: ["Agendada", "Realizada", "Remarcada", "Cancelada", "Sem retorno", "Gerou proposta", "Fechada", "Perdida"],
};

const MANUAL_SECTIONS = [
  {
    title: "Aba Leads do Mes",
    content: "A Sanmiria deve registrar todos os leads do dia. As cinco primeiras colunas sao obrigatorias. As demais ajudam a Thayssa a controlar origem, status, qualidade e repasse.",
  },
  {
    title: "Aba Visitas Vendedores",
    content: "Toda visita feita por vendedor deve ser registrada com cliente, objetivo, resultado, proposta, proximo passo e feedback do vendedor.",
  },
  {
    title: "Aba Dashboard",
    content: "Thayssa e Diretor devem acompanhar diariamente os indicadores: leads registrados, qualificados, propostas, visitas e gap para a meta.",
  },
  {
    title: "Aba Cronograma Diario",
    content: "Serve como manual de trabalho diario da Sanmiria. O ideal e conferir no inicio, meio e fim do expediente.",
  },
  {
    title: "Aba Bases de Prospeccao",
    content: "Lista fontes recomendadas para prospeccao: Locador, Instagram, grupos de WhatsApp, CNO, Dropdesk, anuncios, site, Google Maps e indicacoes.",
  },
  {
    title: "Regra de gestao",
    content: "Nenhum lead qualificado deve ficar sem responsavel, proximo passo e data de retorno. Nenhuma visita deve ficar sem resultado registrado.",
  },
  {
    title: "Como usar online",
    content: "Use o sistema como espelho operacional da planilha: atualize leads, visitas, resumo do dia e mantenha a visibilidade compartilhada entre Sanmiria, Thayssa e Diretor.",
  },
];

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  try {
    return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "-";
  }
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "-";
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return typeof value === "string" ? value : "-";
  }
}

function formatCurrency(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(parsed)) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(parsed);
}

function mapPhaseToSpreadsheetStatus(opportunity: Opportunity) {
  if (opportunity.leadStatus) return opportunity.leadStatus;
  if (opportunity.phase === "ganho") return "Fechado";
  if (opportunity.phase === "perdido") return "Perdido";
  if (opportunity.phase === "negociacao") return "Proposta gerada";
  if (opportunity.phase === "proposta") return "Proposta gerada";
  if (opportunity.phase === "visita-tecnica") return "Visita agendada";
  if (opportunity.salesperson) return "Repassado ao vendedor";
  if (opportunity.businessTemperature === "quente") return "Qualificado";
  if (opportunity.phase === "em-atendimento") return "Em contato";
  return "Novo";
}

function mapLeadQuality(opportunity: Opportunity) {
  const quality = (opportunity.leadQuality || opportunity.businessTemperature || "").toLowerCase();
  if (quality === "qualificado" || quality === "quente") return "Qualificado";
  if (quality === "morno") return "Morno";
  if (quality === "frio") return "Frio";
  if (quality === "sem perfil") return "Sem perfil";
  if (quality === "duplicado") return "Duplicado";
  if (opportunity.phase && ["proposta", "negociacao", "ganho"].includes(opportunity.phase)) return "Qualificado";
  return "Sem perfil";
}

function mapVisitType(opportunity: Opportunity) {
  if (opportunity.phase === "negociacao") return "Negociacao";
  if (opportunity.phase === "proposta") return "Follow-up";
  if (opportunity.phase === "visita-tecnica") return "Medicao/levantamento";
  if (opportunity.requiresVisit) return "Prospeccao";
  return "Outro";
}

function mapVisitStatus(opportunity: Opportunity) {
  if (opportunity.phase === "ganho") return "Fechada";
  if (opportunity.phase === "perdido") return "Perdida";
  if (opportunity.visitDate) return "Realizada";
  if (opportunity.visitSchedule) return "Agendada";
  if (opportunity.phase === "proposta") return "Gerou proposta";
  return "Sem retorno";
}

export default function SdrWorkspace() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [isNewOpportunityModalOpen, setIsNewOpportunityModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"lead" | "visit">("lead");
  const [modalPhase, setModalPhase] = useState("prospeccao");
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const { data: opportunities = [], isLoading } = useQuery<Opportunity[]>({
    queryKey: ["/api/opportunities"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    retry: false,
  });

  const salespersonName = (value?: string | null) => {
    if (!value) return "A definir";
    if (!value.includes("-") || value.length !== 36) return value;
    return users.find((userItem) => userItem.id === value)?.name || value;
  };

  const currentMonthLeads = useMemo(() => {
    const now = new Date();
    return opportunities.filter((opportunity) => {
      if (!opportunity.createdAt) return false;
      const createdAt = new Date(opportunity.createdAt);
      return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
    });
  }, [opportunities]);

  const qualifiedLeads = useMemo(() => currentMonthLeads.filter((opportunity) => mapLeadQuality(opportunity) === "Qualificado"), [currentMonthLeads]);
  const generatedProposals = useMemo(() => currentMonthLeads.filter((opportunity) => ["proposta", "negociacao", "ganho"].includes(opportunity.phase || "")), [currentMonthLeads]);
  const registeredVisits = useMemo(() => currentMonthLeads.filter((opportunity) => Boolean(opportunity.visitSchedule || opportunity.visitDate || ["visita-tecnica", "proposta", "negociacao", "ganho", "perdido"].includes(opportunity.phase || ""))), [currentMonthLeads]);
  const staleOpportunities = useMemo(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return opportunities.filter((opportunity) => {
      if (!opportunity.phase || ["ganho", "perdido"].includes(opportunity.phase)) return false;
      if (!opportunity.updatedAt) return true;
      return new Date(opportunity.updatedAt).getTime() < cutoff;
    });
  }, [opportunities]);

  const qualificationRate = currentMonthLeads.length > 0 ? (qualifiedLeads.length / currentMonthLeads.length) * 100 : 0;
  const gapToTarget = Math.max(MONTHLY_TARGET - qualifiedLeads.length, 0);

  const originSummary = useMemo(() => {
    const counts = new Map<string, number>();
    ORIGIN_OPTIONS.forEach((origin) => counts.set(origin, 0));
    currentMonthLeads.forEach((opportunity) => {
      const origin = opportunity.proposalOrigin || "Outro";
      counts.set(origin, (counts.get(origin) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([origin, count]) => ({ origin, count }));
  }, [currentMonthLeads]);

  const visitsTable = useMemo(() => opportunities.filter((opportunity) => Boolean(opportunity.visitClient || opportunity.visitVendor || opportunity.visitSchedule || opportunity.visitDate || opportunity.requiresVisit || ["visita-tecnica", "proposta", "negociacao", "ganho", "perdido"].includes(opportunity.phase || ""))), [opportunities]);

  const openDetails = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setIsDetailsModalOpen(true);
  };

  const openLeadModal = () => {
    setModalMode("lead");
    setModalPhase("prospeccao");
    setIsNewOpportunityModalOpen(true);
  };

  const openVisitModal = () => {
    setModalMode("visit");
    setModalPhase("visita-tecnica");
    setIsNewOpportunityModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Card className="border-primary/20 bg-gradient-to-r from-slate-900 via-blue-900 to-emerald-800 text-white">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <Badge className="w-fit bg-white/15 text-white hover:bg-white/15">
                  Painel de Acompanhamento - Sanmiria SDR
                </Badge>
                <CardTitle className="text-3xl font-bold tracking-tight">
                  Central operacional baseada na planilha
                </CardTitle>
                <CardDescription className="max-w-3xl text-slate-100">
                  O sistema agora gira em volta da rotina SDR: leitura gerencial, leads do mes, visitas de vendedores, cronograma diario, bases de prospeccao, listas de validacao e manual de uso.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={openLeadModal}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo lead
                </Button>
                <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => navigate("/kanban")}>
                  <KanbanSquare className="mr-2 h-4 w-4" />
                  Abrir kanban
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-white/10 p-3">
                <div className="text-xs uppercase text-slate-200">Responsavel do dia</div>
                <div className="mt-1 text-lg font-semibold">{user?.name || "Equipe SDR"}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/10 p-3">
                <div className="text-xs uppercase text-slate-200">Meta mensal</div>
                <div className="mt-1 text-lg font-semibold">{MONTHLY_TARGET} ativacoes/reactivacoes qualificadas</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/10 p-3">
                <div className="text-xs uppercase text-slate-200">Sem retorno</div>
                <div className="mt-1 text-lg font-semibold">{staleOpportunities.length} oportunidades</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/10 p-3">
                <div className="text-xs uppercase text-slate-200">Modo de trabalho</div>
                <div className="mt-1 text-lg font-semibold">Operacao + gestao + repasse</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="dashboard" className="mt-6">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</TabsTrigger>
            <TabsTrigger value="leads"><FileSpreadsheet className="mr-2 h-4 w-4" />Leads do Mes</TabsTrigger>
            <TabsTrigger value="visitas"><Users className="mr-2 h-4 w-4" />Visitas Vendedores</TabsTrigger>
            <TabsTrigger value="cronograma"><CalendarClock className="mr-2 h-4 w-4" />Cronograma Diario</TabsTrigger>
            <TabsTrigger value="bases"><MapIcon className="mr-2 h-4 w-4" />Bases de Prospeccao</TabsTrigger>
            <TabsTrigger value="listas"><ClipboardList className="mr-2 h-4 w-4" />Listas</TabsTrigger>
            <TabsTrigger value="manual"><BookOpen className="mr-2 h-4 w-4" />Manual de Uso</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Leads registrados no mes</CardDescription>
                  <CardTitle className="text-3xl">{currentMonthLeads.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Leads qualificados</CardDescription>
                  <CardTitle className="text-3xl">{qualifiedLeads.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Propostas geradas</CardDescription>
                  <CardTitle className="text-3xl">{generatedProposals.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Visitas registradas</CardDescription>
                  <CardTitle className="text-3xl">{registeredVisits.length}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Leitura gerencial</CardTitle>
                  <CardDescription>Interpretacao operacional inspirada na planilha</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    {
                      indicator: "Leads registrados",
                      meaning: "Volume bruto de oportunidades cadastradas pela operacao SDR.",
                      value: currentMonthLeads.length,
                    },
                    {
                      indicator: "Leads qualificados",
                      meaning: "Oportunidades com potencial real e dados suficientes para repasse ao vendedor.",
                      value: qualifiedLeads.length,
                    },
                    {
                      indicator: "Propostas geradas",
                      meaning: "Leads que ja avancaram para orcamento/proposta e mostram evolucao no funil.",
                      value: generatedProposals.length,
                    },
                    {
                      indicator: "Visitas registradas",
                      meaning: "Mostra alinhamento entre SDR, vendedores e supervisao na execucao.",
                      value: registeredVisits.length,
                    },
                    {
                      indicator: "Gap para meta",
                      meaning: "Quanto falta para atingir a meta mensal de ativacoes/reactivacoes qualificadas.",
                      value: gapToTarget,
                    },
                  ].map((item) => (
                    <div key={item.indicator} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{item.indicator}</div>
                          <div className="text-sm text-muted-foreground">{item.meaning}</div>
                        </div>
                        <Badge variant="secondary">{item.value}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Meta e ritmo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                      <span>Meta mensal</span>
                      <span className="font-semibold">{MONTHLY_TARGET}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                      <span>Taxa de qualificacao</span>
                      <span className="font-semibold">{qualificationRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                      <span>Gap atual</span>
                      <span className="font-semibold">{gapToTarget}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Alertas operacionais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                      <div className="font-medium">Oportunidades sem retorno</div>
                      <div className="text-sm">{staleOpportunities.length} oportunidades ativas estao sem atualizacao ha mais de 48h.</div>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900">
                      <div className="font-medium">Repasse ao vendedor</div>
                      <div className="text-sm">{currentMonthLeads.filter((item) => Boolean(item.salesperson)).length} leads do mes ja possuem vendedor responsavel definido.</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Leads por origem</CardTitle>
                <CardDescription>Distribuicao de canais de prospeccao do mes atual</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origem</TableHead>
                      <TableHead className="w-32 text-right">Qtd.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {originSummary.map((row) => (
                      <TableRow key={row.origin}>
                        <TableCell>{row.origin}</TableCell>
                        <TableCell className="text-right font-medium">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Registro diario de leads</CardTitle>
                  <CardDescription>Espelho operacional da aba "Leads do Mes" da planilha</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={openLeadModal}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo lead
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/kanban")}>
                    <KanbanSquare className="mr-2 h-4 w-4" />
                    Ver kanban
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome do cliente</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Numero de contato</TableHead>
                      <TableHead>Numero da proposta</TableHead>
                      <TableHead>Feedback da oportunidade</TableHead>
                      <TableHead>Data de cadastro</TableHead>
                      <TableHead>Origem / base</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Tipo de oportunidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vendedor responsavel</TableHead>
                      <TableHead>Valor previsto</TableHead>
                      <TableHead>Qualidade</TableHead>
                      <TableHead>Proximo passo</TableHead>
                      <TableHead>Prazo / retorno</TableHead>
                      <TableHead>Repassado</TableHead>
                      <TableHead>Retorno vendedor</TableHead>
                      <TableHead>Observacoes</TableHead>
                      <TableHead className="w-24">Acao</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentMonthLeads.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={19} className="text-center text-muted-foreground">
                          Nenhum lead registrado neste mes.
                        </TableCell>
                      </TableRow>
                    )}
                    {currentMonthLeads.map((opportunity) => (
                      <TableRow key={opportunity.id}>
                        <TableCell className="font-medium">{opportunity.company || opportunity.contact || "-"}</TableCell>
                        <TableCell>{opportunity.contact || "-"}</TableCell>
                        <TableCell>{opportunity.phone || "-"}</TableCell>
                        <TableCell>{opportunity.budgetNumber || opportunity.opportunityNumber || "-"}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{opportunity.leadFeedback || opportunity.notes || opportunity.statement || opportunity.clientNeeds || "-"}</TableCell>
                        <TableCell>{formatDate(opportunity.createdAt)}</TableCell>
                        <TableCell>{opportunity.proposalOrigin || "-"}</TableCell>
                        <TableCell>{opportunity.leadCity || opportunity.contract || "-"}</TableCell>
                        <TableCell>{opportunity.leadOpportunityType || opportunity.needCategory || "-"}</TableCell>
                        <TableCell><Badge variant="outline">{opportunity.leadStatus || opportunity.status || mapPhaseToSpreadsheetStatus(opportunity)}</Badge></TableCell>
                        <TableCell>{salespersonName(opportunity.salesperson)}</TableCell>
                        <TableCell>{formatCurrency(opportunity.budget)}</TableCell>
                        <TableCell><Badge variant="secondary">{mapLeadQuality(opportunity)}</Badge></TableCell>
                        <TableCell className="max-w-[220px] truncate">{opportunity.leadNextStep || opportunity.negotiationInfo || opportunity.statement || (opportunity.requiresVisit ? "Agendar visita" : "-")}</TableCell>
                        <TableCell>{formatDateTime(opportunity.leadNextContactAt || opportunity.visitSchedule || opportunity.validityDate || null)}</TableCell>
                        <TableCell>{opportunity.leadHandoffStatus || opportunity.discountDescription || (opportunity.salesperson ? "Sim" : "Nao")}</TableCell>
                        <TableCell>{opportunity.leadSellerReturn || opportunity.invoiceNumber || (opportunity.visitRealization || opportunity.visitDate ? "Sim" : "Pendente")}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{opportunity.leadObservations || opportunity.lossObservation || opportunity.notes || "-"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openDetails(opportunity)}>
                            <Eye className="mr-1 h-4 w-4" />
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="visitas">
            <Card>
              <CardHeader>
                <CardTitle>Registro detalhado de visitas dos vendedores</CardTitle>
                <CardDescription>Visao inspirada na aba "Visitas Vendedores" para alinhamento entre SDR e comercial</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex justify-end">
                  <Button onClick={openVisitModal}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova visita
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data da visita</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Cliente visitado</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Origem do lead</TableHead>
                      <TableHead>Equipamento / demanda</TableHead>
                      <TableHead>Cidade / local</TableHead>
                      <TableHead>Tipo de visita</TableHead>
                      <TableHead>Objetivo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resultado da visita</TableHead>
                      <TableHead>Numero proposta</TableHead>
                      <TableHead>Valor previsto</TableHead>
                      <TableHead>Proximo passo</TableHead>
                      <TableHead>Responsavel</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Feedback vendedor</TableHead>
                      <TableHead>Registrado por</TableHead>
                      <TableHead className="w-24">Acao</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitsTable.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={19} className="text-center text-muted-foreground">
                          Nenhuma visita registrada ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {visitsTable.map((opportunity) => (
                      <TableRow key={opportunity.id}>
                        <TableCell>{formatDate(opportunity.visitDate || opportunity.visitSchedule || opportunity.updatedAt)}</TableCell>
                        <TableCell>{opportunity.visitVendor || salespersonName(opportunity.salesperson)}</TableCell>
                        <TableCell className="font-medium">{opportunity.visitClient || opportunity.company || opportunity.contact || "-"}</TableCell>
                        <TableCell>{opportunity.visitClientContact || opportunity.contact || opportunity.phone || "-"}</TableCell>
                        <TableCell>{opportunity.visitOrigin || opportunity.proposalOrigin || "-"}</TableCell>
                        <TableCell>{opportunity.visitEquipmentDemand || opportunity.needCategory || "-"}</TableCell>
                        <TableCell>{opportunity.visitLocation || opportunity.contract || "-"}</TableCell>
                        <TableCell>{opportunity.visitType || opportunity.visitDescription || mapVisitType(opportunity)}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{opportunity.visitObjective || opportunity.statement || opportunity.clientNeeds || "-"}</TableCell>
                        <TableCell><Badge variant="outline">{opportunity.visitStatus || opportunity.status || mapVisitStatus(opportunity)}</Badge></TableCell>
                        <TableCell className="max-w-[220px] truncate">{opportunity.visitResult || opportunity.visitRealization || opportunity.status || opportunity.lossReason || "-"}</TableCell>
                        <TableCell>{opportunity.budgetNumber || opportunity.opportunityNumber || "-"}</TableCell>
                        <TableCell>{formatCurrency(opportunity.budget || opportunity.finalValue)}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{opportunity.visitNextStep || opportunity.negotiationInfo || opportunity.statement || "-"}</TableCell>
                        <TableCell>{opportunity.visitNextStepOwner || opportunity.invoiceNumber || salespersonName(opportunity.salesperson) || opportunity.createdByName || "-"}</TableCell>
                        <TableCell>{formatDate(opportunity.visitNextStepDeadline || opportunity.validityDate || opportunity.visitSchedule || null)}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{opportunity.vendorFeedback || opportunity.notes || "-"}</TableCell>
                        <TableCell>{opportunity.createdByName || "-"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openDetails(opportunity)}>
                            <Eye className="mr-1 h-4 w-4" />
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cronograma">
            <Card>
              <CardHeader>
                <CardTitle>Cronograma diario de atividades</CardTitle>
                <CardDescription>Manual operacional para todos os dias de trabalho</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Horario sugerido</TableHead>
                      <TableHead>Bloco de atividade</TableHead>
                      <TableHead>O que fazer</TableHead>
                      <TableHead>Meta minima / criterio</TableHead>
                      <TableHead>Registro obrigatorio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DAILY_SCHEDULE.map((item) => (
                      <TableRow key={item.time}>
                        <TableCell className="font-medium">{item.time}</TableCell>
                        <TableCell>{item.block}</TableCell>
                        <TableCell>{item.action}</TableCell>
                        <TableCell>{item.goal}</TableCell>
                        <TableCell>{item.required}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bases">
            <Card>
              <CardHeader>
                <CardTitle>Bases de prospeccao e como usar</CardTitle>
                <CardDescription>Fontes recomendadas para gerar leads, reativacoes e oportunidades qualificadas</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Base de dados / canal</TableHead>
                      <TableHead>Como prospectar</TableHead>
                      <TableHead>Filtro recomendado</TableHead>
                      <TableHead>Tipo de oportunidade</TableHead>
                      <TableHead>Cuidados / regra de qualidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PROSPECTION_BASES.map((item) => (
                      <TableRow key={item.source}>
                        <TableCell className="font-medium">{item.source}</TableCell>
                        <TableCell>{item.how}</TableCell>
                        <TableCell>{item.filter}</TableCell>
                        <TableCell>{item.type}</TableCell>
                        <TableCell>{item.care}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listas">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { title: "Origens", items: VALIDATION_LISTS.origens },
                { title: "Status", items: VALIDATION_LISTS.status },
                { title: "Vendedores", items: VALIDATION_LISTS.vendedores },
                { title: "Qualidade", items: VALIDATION_LISTS.qualidade },
                { title: "Tipo Oportunidade", items: VALIDATION_LISTS.tipoOportunidade },
                { title: "Sim / Nao", items: VALIDATION_LISTS.simNao },
                { title: "Tipo Visita", items: VALIDATION_LISTS.tipoVisita },
                { title: "Status Visita", items: VALIDATION_LISTS.statusVisita },
              ].map((list) => (
                <Card key={list.title}>
                  <CardHeader>
                    <CardTitle className="text-base">{list.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {list.items.map((item) => (
                      <div key={item} className="rounded-md border px-3 py-2 text-sm">
                        {item}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="manual">
            <div className="grid gap-4 lg:grid-cols-2">
              {MANUAL_SECTIONS.map((section, index) => (
                <Card key={section.title}>
                  <CardHeader>
                    <CardTitle className="text-base">{index + 1}. {section.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-6 text-muted-foreground">
                    {section.content}
                  </CardContent>
                </Card>
              ))}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Como essa central deve ser usada</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center font-medium"><Target className="mr-2 h-4 w-4" />Inicio do dia</div>
                    <div className="text-sm text-muted-foreground">Entrar pelo dashboard, verificar meta, sem retorno e fila de leads do mes.</div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center font-medium"><ArrowRight className="mr-2 h-4 w-4" />Durante o dia</div>
                    <div className="text-sm text-muted-foreground">Registrar cada lead e cada visita como linha operacional, mantendo proximo passo e responsavel claros.</div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center font-medium"><KanbanSquare className="mr-2 h-4 w-4" />Execucao visual</div>
                    <div className="text-sm text-muted-foreground">Usar o kanban como acompanhamento complementar do funil, sem perder o contexto operacional da planilha.</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <NewOpportunityModal
        open={isNewOpportunityModalOpen}
        onOpenChange={setIsNewOpportunityModalOpen}
        mode={modalMode}
        initialPhase={modalPhase}
      />

      <OpportunityDetailsModal
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
        opportunity={selectedOpportunity}
      />
    </div>
  );
}
