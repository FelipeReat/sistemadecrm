import { User, Phone, Building, Calendar, FileText, DollarSign, MapPin, TriangleAlert, CheckCircle, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Opportunity, User as UserType } from "@shared/schema";
import { formatters } from "@/lib/formatters";
import { useEffect } from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";

// Função para validar se uma fase está completa
const validatePhaseCompletion = (opportunity: Opportunity): { isComplete: boolean; missingFields?: string[] } => {
  const missingFields: string[] = [];

  switch (opportunity.phase) {
    case 'prospeccao':
      // if (!opportunity.salesperson) missingFields.push('Vendedor');
      break;

    case 'em-atendimento':
      // if (!opportunity.salesperson) missingFields.push('Vendedor');
      // Temperatura do negócio só é obrigatória se já foi preenchida anteriormente
      // ou se estamos editando especificamente esta fase
      break;

    case 'visita-tecnica':
      if (!opportunity.visitSchedule) missingFields.push('Data de agendamento da visita');
      if (!opportunity.visitDate) missingFields.push('Data de realização da visita');
      break;

    case 'proposta':
      if (!opportunity.budgetNumber) missingFields.push('Número da proposta');
      break;

    case 'negociacao':
      // Campos de negociação agora são opcionais
      break;

    case 'ganho':
    case 'perdido':
      // Fases finais sempre consideradas completas para movimentação
      break;
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields: missingFields.length > 0 ? missingFields : undefined
  };
};

interface OpportunityCardProps {
  opportunity: Opportunity;
  onViewDetails?: (opportunity: Opportunity) => void;
  users?: UserType[];
}

export default function OpportunityCard({ opportunity, onViewDetails, users = [] }: OpportunityCardProps) {
  const phaseValidation = validatePhaseCompletion(opportunity);

  // Função para mapear ID do vendedor para nome
  const getSalespersonName = (salespersonId: string): string => {
    if (!salespersonId) return '';
    
    // Se já é um nome (não é um UUID), retornar como está
    if (!salespersonId.includes('-') || salespersonId.length !== 36) {
      return salespersonId;
    }
    
    // Procurar o usuário pelo ID
    const user = users.find(u => u.id === salespersonId);
    return user ? user.name : salespersonId;
  };

  // Log para monitorar re-renderizações do card
  useEffect(() => {
    //console.log(`🎯 OpportunityCard: Re-renderizando card da oportunidade ${opportunity.id} - ${opportunity.contact} (${opportunity.company}) (Fase: ${opportunity.phase})`);
  }, [opportunity.id, opportunity.contact, opportunity.company, opportunity.phase, opportunity.updatedAt]);

  const handleDragStart = (e: React.DragEvent) => {
    // Passar tanto o ID quanto o objeto completo da oportunidade para validação
    const dragData = {
      opportunityId: opportunity.id,
      opportunity: opportunity
    };
    e.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(num);
  };

  const formatDate = (date: Date) => {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: ptBR,
    });
  };

  const getStatusBadge = () => {
    switch (opportunity.phase) {
      case "ganho":
        return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium px-1.5 py-0.5">Ganho</Badge>;
      case "perdido":
        return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs font-medium px-1.5 py-0.5">Perdido</Badge>;
      case "negociacao":
        return <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs font-medium px-1.5 py-0.5">Em negociação</Badge>;
      case "proposta":
        if (opportunity.budget) {
          return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium px-1.5 py-0.5">{formatCurrency(opportunity.budget)}</Badge>;
        }
        break;
      case "prospeccao":
        if (opportunity.opportunityNumber) {
          return <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium px-1.5 py-0.5">{opportunity.opportunityNumber}</Badge>;
        }
        break;
    }
    return null;
  };

  const getImportedBadge = () => {
    if (opportunity.isImported) {
      return (
        <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs font-medium flex items-center gap-1 px-1.5 py-0.5" title={`Importado via ${opportunity.importSource || 'CSV'} - Lote: ${opportunity.importBatchId || 'N/A'}`}>
          <Download className="h-2.5 w-2.5" />
          Importado
        </Badge>
      );
    }
    return null;
  };


  return (
    <div
      className="bg-card rounded-lg border border-border py-2 px-3 cursor-move hover:shadow-md transition-shadow"
      draggable
      onDragStart={handleDragStart}
      data-testid={`opportunity-card-${opportunity.id}`}
    >
      {/* Cabeçalho do card - título com indicador e ações */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <h4 className="font-bold text-sm text-card-foreground truncate tracking-tight" data-testid={`opportunity-contact-title-${opportunity.id}`}>
            {opportunity.contact}
          </h4>
          {/* Indicador de status da fase */}
          {opportunity.phase && !['ganho', 'perdido'].includes(opportunity.phase) && (
            <HoverCard openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <div className="flex items-center flex-shrink-0" title={phaseValidation.isComplete ? 'Fase completa' : 'Campos pendentes'}>
                  {phaseValidation.isComplete ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-orange-500" />
                  )}
                </div>
              </HoverCardTrigger>
              {!phaseValidation.isComplete && (
                <HoverCardContent side="top" align="start" className="w-72">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-orange-700 dark:text-orange-300">Campos pendentes nesta fase</div>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {(phaseValidation.missingFields || []).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                </HoverCardContent>
              )}
            </HoverCard>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-blue-500 hover:text-blue-600 text-xs font-medium h-6 px-2 py-0 flex-shrink-0 ml-2"
          onClick={() => onViewDetails?.(opportunity)}
        >
          Ver
        </Button>
      </div>

      {/* Badges de status e importação */}
      <div className="mb-2 flex flex-wrap gap-1">
        {getStatusBadge()}
        {getImportedBadge()}
      </div>

      {/* Informações principais em grid compacto */}
      <div className="grid grid-cols-1 gap-1 text-xs text-gray-600 dark:text-gray-300 tracking-tight mb-2">
        
        {/* Linha 1: Telefone e CNPJ */}
        <div className="flex items-center justify-between">
          {opportunity.phone && (
            <div className="flex items-center flex-1 min-w-0 mr-2">
              <Phone className="h-3 w-3 text-gray-500 dark:text-gray-400 mr-1 flex-shrink-0" />
              <span data-testid={`opportunity-phone-${opportunity.id}`} className="truncate">{opportunity.phone}</span>
            </div>
          )}
          {opportunity.cnpj && (
            <div className="flex items-center flex-1 min-w-0">
              <Building className="h-3 w-3 text-gray-500 dark:text-gray-400 mr-1 flex-shrink-0" />
              <span data-testid={`opportunity-cnpj-${opportunity.id}`} className="truncate">{opportunity.cnpj}</span>
            </div>
          )}
        </div>

        {/* Linha 2: Temperatura e Categoria */}
        <div className="flex items-center justify-between">
          {opportunity.businessTemperature && (
            <div className="flex items-center flex-1 min-w-0 mr-2">
              <span className="h-3 w-3 text-gray-500 dark:text-gray-400 mr-1 flex-shrink-0">🌡️</span>
              <span className={`font-medium truncate ${
                opportunity.businessTemperature === 'quente' ? 'text-red-600 dark:text-red-400' :
                opportunity.businessTemperature === 'morno' ? 'text-yellow-600 dark:text-yellow-400' :
                'text-blue-600 dark:text-blue-400'
              }`}>
                {opportunity.businessTemperature.charAt(0).toUpperCase() + opportunity.businessTemperature.slice(1)}
              </span>
            </div>
          )}
          {opportunity.needCategory && (
            <div className="flex items-center flex-1 min-w-0">
              <FileText className="h-3 w-3 text-gray-500 dark:text-gray-400 mr-1 flex-shrink-0" />
              <span className="truncate text-gray-700 dark:text-gray-300" title={opportunity.needCategory}>
                {opportunity.needCategory}
              </span>
            </div>
          )}
        </div>

        {/* Linha 3: Documentos e Vendedor */}
        <div className="flex items-center justify-between">
          {opportunity.documents && opportunity.documents.length > 0 && (
            <div className="flex items-center flex-1 min-w-0 mr-2">
              <FileText className="h-3 w-3 text-gray-500 dark:text-gray-400 mr-1 flex-shrink-0" />
              <span className="text-blue-600 dark:text-blue-400 font-medium truncate">
                {opportunity.documents.length} doc(s)
              </span>
            </div>
          )}
          {opportunity.salesperson && (
            <div className="flex items-center flex-1 min-w-0">
              <User className="h-3 w-3 text-gray-500 dark:text-gray-400 mr-1 flex-shrink-0" />
              <span className="text-gray-700 dark:text-gray-300 truncate">{getSalespersonName(opportunity.salesperson)}</span>
            </div>
          )}
        </div>

        {/* Criado por - linha separada se existir */}
        {opportunity.createdByName && (
          <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
            <User className="h-3 w-3 text-blue-600 dark:text-blue-400 mr-1 flex-shrink-0" />
            <span className="text-blue-800 dark:text-blue-200 font-semibold text-xs truncate">
              Criado: {opportunity.createdByName}
            </span>
          </div>
        )}
      </div>

      {/* Informações específicas da fase - layout horizontal quando possível */}
      <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300 mb-2 tracking-tight">
        {opportunity.phase === "visita-tecnica" && opportunity.visitSchedule && (
          <div className="flex items-center">
            <Calendar className="h-3 w-3 text-gray-500 dark:text-gray-400 mr-1 flex-shrink-0" />
            <span className="truncate">
              Agendado: {(() => {
                try {
                  const date = formatters.parseDateTime(opportunity.visitSchedule);
                  if (!date || isNaN(date.getTime())) {
                    return "Data inválida";
                  }
                  return date.toLocaleDateString("pt-BR", { 
                    day: "2-digit", 
                    month: "2-digit"
                  });
                } catch (error) {
                  return "Data inválida";
                }
              })()}
            </span>
          </div>
        )}

        {opportunity.phase === "proposta" && (
          <div className="flex items-center justify-between">
            {opportunity.budgetNumber && (
              <div className="flex items-center flex-1 min-w-0 mr-2">
                <FileText className="h-3 w-3 text-gray-500 dark:text-gray-400 mr-1 flex-shrink-0" />
                <span className="truncate">Proposta {opportunity.budgetNumber}</span>
              </div>
            )}
            {opportunity.validityDate && (
              <div className="flex items-center flex-1 min-w-0">
                <Calendar className="h-3 w-3 text-gray-500 dark:text-gray-400 mr-1 flex-shrink-0" />
                <span className="truncate">Válida até: {new Date(opportunity.validityDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
              </div>
            )}
          </div>
        )}

        {opportunity.phase === "negociacao" && opportunity.finalValue && (
          <div className="flex items-center">
            <DollarSign className="h-3 w-3 text-gray-500 dark:text-gray-400 mr-1 flex-shrink-0" />
            <span className="truncate">Valor: {formatCurrency(opportunity.finalValue)}</span>
          </div>
        )}

        {opportunity.phase === "perdido" && opportunity.lossReason && (
          <div className="flex items-center">
            <TriangleAlert className="h-3 w-3 text-gray-500 dark:text-gray-400 mr-1 flex-shrink-0" />
            <span className="truncate">Motivo: {opportunity.lossReason}</span>
          </div>
        )}
      </div>

      {/* Seção de informações de tempo - layout horizontal compacto */}
      <div className="pt-1 border-t">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 tracking-tight">
          <span data-testid={`opportunity-created-${opportunity.id}`} className="truncate flex-1 min-w-0 mr-2">
            Criado {opportunity.createdAt ? formatDate(opportunity.createdAt) : 'N/A'}
          </span>
          <span data-testid={`opportunity-phase-time-${opportunity.id}`} className="text-primary font-medium truncate flex-1 min-w-0">
            Nesta fase {(() => {
              const date = opportunity.phaseUpdatedAt || opportunity.updatedAt;
              return date ? formatDate(date) : 'N/A';
            })()}
          </span>
        </div>

        {/* Indicador de campos faltando - mais compacto */}
        {!phaseValidation.isComplete && opportunity.phase && !['ganho', 'perdido'].includes(opportunity.phase) && (
          <div className="mt-1 p-1.5 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded text-orange-700 dark:text-orange-300">
            <div className="flex items-center space-x-1">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span className="font-medium text-xs">Campos pendentes</span>
            </div>
            <div className="mt-1 text-[11px] text-orange-800 dark:text-orange-200">
              {(phaseValidation.missingFields || []).join(', ')}
            </div>
          </div>
        )}

        {phaseValidation.isComplete && opportunity.phase && !['ganho', 'perdido'].includes(opportunity.phase) && (
          <div className="mt-1 p-1.5 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300">
            <div className="flex items-center space-x-1">
              <CheckCircle className="h-3 w-3 flex-shrink-0" />
              <span className="text-xs font-medium truncate">Pronto para avançar</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}