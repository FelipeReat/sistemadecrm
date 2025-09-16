import { User, Phone, Building, Calendar, FileText, DollarSign, MapPin, TriangleAlert, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Opportunity } from "@shared/schema";
import { formatters } from "@/lib/formatters";

// Função para validar se uma fase está completa
const validatePhaseCompletion = (opportunity: Opportunity): { isComplete: boolean; missingFields?: string[] } => {
  const missingFields: string[] = [];

  switch (opportunity.phase) {
    case 'prospeccao':
      if (!opportunity.opportunityNumber) missingFields.push('Número da oportunidade');
      if (!opportunity.salesperson) missingFields.push('Vendedor');
      break;

    case 'em-atendimento':
      if (!opportunity.salesperson) missingFields.push('Vendedor');
      // Temperatura do negócio só é obrigatória se já foi preenchida anteriormente
      // ou se estamos editando especificamente esta fase
      break;

    case 'visita-tecnica':
      if (!opportunity.visitSchedule) missingFields.push('Data de agendamento da visita');
      if (!opportunity.visitDate) missingFields.push('Data de realização da visita');
      break;

    case 'proposta':
      if (!opportunity.budgetNumber) missingFields.push('Número da proposta');
      if (!opportunity.budget) missingFields.push('Valor da proposta');
      if (!opportunity.validityDate) missingFields.push('Data de validade');
      break;

    case 'negociacao':
      if (!opportunity.finalValue) missingFields.push('Valor final');
      if (!opportunity.negotiationInfo) missingFields.push('Informações da negociação');
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
}

export default function OpportunityCard({ opportunity, onViewDetails }: OpportunityCardProps) {
  const phaseValidation = validatePhaseCompletion(opportunity);

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
        return <Badge className="bg-green-100 text-green-800 text-xs font-medium">Ganho</Badge>;
      case "perdido":
        return <Badge className="bg-red-100 text-red-800 text-xs font-medium">Perdido</Badge>;
      case "negociacao":
        return <Badge className="bg-orange-100 text-orange-800 text-xs font-medium">Em negociação</Badge>;
      case "proposta":
        if (opportunity.budget) {
          return <Badge className="bg-green-100 text-green-800 text-xs font-medium">{formatCurrency(opportunity.budget)}</Badge>;
        }
        break;
      case "prospeccao":
        if (opportunity.opportunityNumber) {
          return <Badge className="bg-blue-100 text-blue-800 text-xs font-medium">{opportunity.opportunityNumber}</Badge>;
        }
        break;
    }
    return null;
  };


  return (
    <div
      className="bg-card rounded-lg border border-border p-3 cursor-move hover:shadow-md transition-shadow"
      draggable
      onDragStart={handleDragStart}
      data-testid={`opportunity-card-${opportunity.id}`}
    >
      {/* Cabeçalho do card - título com indicador e ações */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <h4 className="font-bold text-card-foreground truncate" data-testid={`opportunity-contact-title-${opportunity.id}`}>
            {opportunity.contact}
          </h4>
          {/* Indicador de status da fase */}
          {!['ganho', 'perdido'].includes(opportunity.phase) && (
            <div className="flex items-center flex-shrink-0" title={phaseValidation.isComplete ? 'Fase completa' : `Campos faltando: ${phaseValidation.missingFields?.join(', ')}`}>
              {phaseValidation.isComplete ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-500" />
              )}
            </div>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-blue-500 hover:text-blue-600 text-xs font-medium h-auto px-2 py-1 flex-shrink-0 ml-2"
          onClick={() => onViewDetails?.(opportunity)}
        >
          Ver detalhes
        </Button>
      </div>

      {/* Badge de status */}
      {getStatusBadge() && (
        <div className="mb-3">
          {getStatusBadge()}
        </div>
      )}

      <div className="space-y-1 text-sm text-muted-foreground">
        {opportunity.phone && (
          <div className="flex items-center">
            <Phone className="h-3 w-3 text-muted-foreground mr-2" />
            <span data-testid={`opportunity-phone-${opportunity.id}`}>{opportunity.phone}</span>
          </div>
        )}

        {opportunity.cnpj && (
          <div className="flex items-center">
            <Building className="h-3 w-3 text-muted-foreground mr-2" />
            <span data-testid={`opportunity-cnpj-${opportunity.id}`}>{opportunity.cnpj}</span>
          </div>
        )}

        {opportunity.businessTemperature && (
          <div className="flex items-center">
            <span className="h-3 w-3 text-muted-foreground mr-2">🌡️</span>
            <span className={`font-medium ${
              opportunity.businessTemperature === 'quente' ? 'text-red-600' :
              opportunity.businessTemperature === 'morno' ? 'text-yellow-600' :
              'text-blue-600'
            }`}>
              {opportunity.businessTemperature.charAt(0).toUpperCase() + opportunity.businessTemperature.slice(1)}
            </span>
          </div>
        )}

        {opportunity.needCategory && (
          <div className="flex items-center">
            <FileText className="h-3 w-3 text-muted-foreground mr-2" />
            <span className="truncate" title={opportunity.needCategory}>
              {opportunity.needCategory}
            </span>
          </div>
        )}

        {opportunity.documents && opportunity.documents.length > 0 && (
          <div className="flex items-center">
            <FileText className="h-3 w-3 text-muted-foreground mr-2" />
            <span className="text-blue-600 font-medium">
              {opportunity.documents.length} documento(s)
            </span>
          </div>
        )}

        {opportunity.salesperson && (
          <div className="flex items-center">
            <User className="h-3 w-3 text-muted-foreground mr-2" />
            <span>Vendedor: {opportunity.salesperson}</span>
          </div>
        )}</div>

      {/* Informações específicas da fase */}
      <div className="space-y-1 text-sm text-muted-foreground">

        {opportunity.phase === "prospeccao" && opportunity.nextActivityDate && (
          <div className="flex items-center">
            <Calendar className="h-3 w-3 text-muted-foreground mr-2" />
            <span>Próxima atividade: {new Date(opportunity.nextActivityDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
          </div>
        )}

        {opportunity.phase === "visita-tecnica" && opportunity.visitSchedule && (
          <div className="flex items-center">
            <Calendar className="h-3 w-3 text-muted-foreground mr-2" />
            <span>
              Agendado: {(() => {
                try {
                  // Parse da data brasileira DD/MM/AAAA HH:MM
                  const date = formatters.parseDateTime(opportunity.visitSchedule);
                  if (!date || isNaN(date.getTime())) {
                    return "Data inválida";
                  }
                  const dateStr = date.toLocaleDateString("pt-BR", { 
                    day: "2-digit", 
                    month: "2-digit", 
                    year: "numeric", 
                    timeZone: "America/Sao_Paulo" 
                  });
                  const timeStr = date.toLocaleTimeString("pt-BR", { 
                    hour: "2-digit", 
                    minute: "2-digit", 
                    timeZone: "America/Sao_Paulo" 
                  });
                  return `${dateStr} às ${timeStr}`;
                } catch (error) {
                  return "Data inválida";
                }
              })()}
            </span>
          </div>
        )}

        {opportunity.phase === "visita-tecnica" && (
          <div className="flex items-center">
            <MapPin className="h-3 w-3 text-muted-foreground mr-2" />
            <span>Localização disponível</span>
          </div>
        )}

        {opportunity.phase === "proposta" && opportunity.budgetNumber && (
          <div className="flex items-center">
            <FileText className="h-3 w-3 text-muted-foreground mr-2" />
            <span>Proposta {opportunity.budgetNumber}</span>
          </div>
        )}

        {opportunity.phase === "proposta" && opportunity.validityDate && (
          <div className="flex items-center">
            <Calendar className="h-3 w-3 text-muted-foreground mr-2" />
            <span>Válida até: {new Date(opportunity.validityDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
          </div>
        )}

        {opportunity.phase === "negociacao" && opportunity.finalValue && (
          <div className="flex items-center">
            <DollarSign className="h-3 w-3 text-muted-foreground mr-2" />
            <span>Valor: {formatCurrency(opportunity.finalValue)}</span>
          </div>
        )}

        {opportunity.phase === "negociacao" && opportunity.negotiationInfo && (
          <div className="flex items-center">
            <FileText className="h-3 w-3 text-muted-foreground mr-2" />
            <span>{opportunity.negotiationInfo}</span>
          </div>
        )}

        {opportunity.phase === "ganho" && (
          <div className="flex items-center">
            <Calendar className="h-3 w-3 text-muted-foreground mr-2" />
            <span>Fechado {formatDate(opportunity.updatedAt)}</span>
          </div>
        )}

        {opportunity.phase === "perdido" && opportunity.lossReason && (
          <div className="flex items-center">
            <TriangleAlert className="h-3 w-3 text-muted-foreground mr-2" />
            <span>Motivo: {opportunity.lossReason}</span>
          </div>
        )}

        {opportunity.phase === "perdido" && opportunity.lossObservation && (
          <div className="flex items-center">
            <FileText className="h-3 w-3 text-muted-foreground mr-2" />
            <span 
              className="line-clamp-2 break-words" 
              title={opportunity.lossObservation}
              data-testid={`opportunity-loss-observation-${opportunity.id}`}
            >
              Observação: {opportunity.lossObservation}
            </span>
          </div>
        )}

        {opportunity.phase === "perdido" && (
          <div className="flex items-center">
            <Calendar className="h-3 w-3 text-muted-foreground mr-2" />
            <span>Perdido {formatDate(opportunity.updatedAt)}</span>
          </div>
        )}
      </div>

      {/* Seção de informações de tempo e status */}
      <div className="mt-3 border-t pt-2">
        <div className="flex flex-col text-xs text-muted-foreground space-y-1">
          <span data-testid={`opportunity-created-${opportunity.id}`}>
            Criado {formatDate(opportunity.createdAt)}
          </span>
          <span data-testid={`opportunity-phase-time-${opportunity.id}`} className="text-primary font-medium">
            Nesta fase {formatDate(opportunity.phaseUpdatedAt || opportunity.updatedAt)}
          </span>
        </div>

        {/* Indicador de campos faltando */}
        {!phaseValidation.isComplete && !['ganho', 'perdido'].includes(opportunity.phase) && (
          <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-orange-700">
            <div className="flex items-center space-x-1">
              <AlertCircle className="h-3 w-3" />
              <span className="font-medium">Campos pendentes:</span>
            </div>
            <div className="text-xs mt-1">
              {phaseValidation.missingFields?.join(', ')}
            </div>
          </div>
        )}

        {phaseValidation.isComplete && !['ganho', 'perdido'].includes(opportunity.phase) && (
          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-green-700">
            <div className="flex items-center space-x-1">
              <CheckCircle className="h-3 w-3" />
              <span className="text-xs font-medium">Fase completa - Pronto para avançar</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}