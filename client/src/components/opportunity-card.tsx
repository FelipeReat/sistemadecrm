import { MoreHorizontal, User, Phone, Building, Calendar, FileText, DollarSign, MapPin, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Opportunity } from "@shared/schema";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onViewDetails?: (opportunity: Opportunity) => void;
}

export default function OpportunityCard({ opportunity, onViewDetails }: OpportunityCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", opportunity.id);
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
      className="bg-white rounded-lg border border-gray-200 p-3 cursor-move hover:shadow-md transition-shadow"
      draggable
      onDragStart={handleDragStart}
      data-testid={`opportunity-card-${opportunity.id}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-gray-900" data-testid={`opportunity-contact-title-${opportunity.id}`}>
          {opportunity.contact}
        </h4>
        <div className="flex items-center space-x-2">
          {getStatusBadge()}
          <Button variant="ghost" size="sm" className="h-auto p-1">
            <MoreHorizontal className="h-4 w-4 text-gray-400" />
          </Button>
        </div>
      </div>

      <div className="space-y-1 text-sm text-gray-600">
        <div className="flex items-center">
          <User className="h-3 w-3 text-gray-400 mr-2" />
          <span data-testid={`opportunity-contact-${opportunity.id}`}>{opportunity.contact}</span>
        </div>

        <div className="flex items-center">
          <Phone className="h-3 w-3 text-gray-400 mr-2" />
          <span data-testid={`opportunity-phone-${opportunity.id}`}>{opportunity.phone}</span>
        </div>

        {opportunity.cnpj && (
          <div className="flex items-center">
            <Building className="h-3 w-3 text-gray-400 mr-2" />
            <span data-testid={`opportunity-cnpj-${opportunity.id}`}>{opportunity.cnpj}</span>
          </div>
        )}

        {opportunity.phase === "prospeccao" && opportunity.salesperson && (
          <div className="flex items-center">
            <User className="h-3 w-3 text-gray-400 mr-2" />
            <span>Vendedor: {opportunity.salesperson}</span>
          </div>
        )}

        {opportunity.phase === "prospeccao" && opportunity.nextActivityDate && (
          <div className="flex items-center">
            <Calendar className="h-3 w-3 text-gray-400 mr-2" />
            <span>Próxima atividade: {new Date(opportunity.nextActivityDate).toLocaleDateString("pt-BR")}</span>
          </div>
        )}

        {opportunity.phase === "visita-tecnica" && opportunity.visitSchedule && (
          <div className="flex items-center">
            <Calendar className="h-3 w-3 text-gray-400 mr-2" />
            <span>Agendado: {new Date(opportunity.visitSchedule).toLocaleDateString("pt-BR")} às {new Date(opportunity.visitSchedule).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}

        {opportunity.phase === "visita-tecnica" && (
          <div className="flex items-center">
            <MapPin className="h-3 w-3 text-gray-400 mr-2" />
            <span>Localização disponível</span>
          </div>
        )}

        {opportunity.phase === "proposta" && opportunity.budgetNumber && (
          <div className="flex items-center">
            <FileText className="h-3 w-3 text-gray-400 mr-2" />
            <span>Proposta {opportunity.budgetNumber}</span>
          </div>
        )}

        {opportunity.phase === "proposta" && opportunity.validityDate && (
          <div className="flex items-center">
            <Calendar className="h-3 w-3 text-gray-400 mr-2" />
            <span>Válida até: {new Date(opportunity.validityDate).toLocaleDateString("pt-BR")}</span>
          </div>
        )}

        {opportunity.phase === "negociacao" && opportunity.finalValue && (
          <div className="flex items-center">
            <DollarSign className="h-3 w-3 text-gray-400 mr-2" />
            <span>Valor: {formatCurrency(opportunity.finalValue)}</span>
          </div>
        )}

        {opportunity.phase === "negociacao" && opportunity.negotiationInfo && (
          <div className="flex items-center">
            <FileText className="h-3 w-3 text-gray-400 mr-2" />
            <span>{opportunity.negotiationInfo}</span>
          </div>
        )}

        {(opportunity.phase === "ganho" || opportunity.phase === "perdido") && opportunity.salesperson && (
          <div className="flex items-center">
            <User className="h-3 w-3 text-gray-400 mr-2" />
            <span>Vendedor: {opportunity.salesperson}</span>
          </div>
        )}

        {opportunity.phase === "ganho" && (
          <div className="flex items-center">
            <Calendar className="h-3 w-3 text-gray-400 mr-2" />
            <span>Fechado {formatDate(opportunity.updatedAt)}</span>
          </div>
        )}

        {opportunity.phase === "perdido" && opportunity.lossReason && (
          <div className="flex items-center">
            <TriangleAlert className="h-3 w-3 text-gray-400 mr-2" />
            <span>Motivo: {opportunity.lossReason}</span>
          </div>
        )}

        {opportunity.phase === "perdido" && (
          <div className="flex items-center">
            <Calendar className="h-3 w-3 text-gray-400 mr-2" />
            <span>Perdido {formatDate(opportunity.updatedAt)}</span>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-3">
        <div className="flex flex-col text-xs text-gray-500">
          <span data-testid={`opportunity-created-${opportunity.id}`}>
            Criado {formatDate(opportunity.createdAt)}
          </span>
          <span data-testid={`opportunity-phase-time-${opportunity.id}`} className="text-blue-600 font-medium">
            Nesta fase {formatDate(opportunity.phaseUpdatedAt || opportunity.updatedAt)}
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-blue-500 hover:text-blue-600 text-sm font-medium h-auto p-1"
          onClick={() => onViewDetails?.(opportunity)}
        >
          Ver detalhes
        </Button>
      </div>
    </div>
  );
}
