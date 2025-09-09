import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Upload, CloudUpload, Calendar, User, FileText, Phone, Building, Target, DollarSign, CheckCircle2, X } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PHASES, insertOpportunitySchema } from "@shared/schema";
import { masks, formatters } from "@/lib/masks";

interface OpportunityFormProps {
  phase: string;
}

// Form schema for Prospecção (creation) - simplified
const prospeccaoFormSchema = insertOpportunitySchema.pick({
  company: true,
});

type ProspeccaoFormData = z.infer<typeof prospeccaoFormSchema>;

export default function OpportunityForm({ phase }: OpportunityFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch salespeople from users endpoint
  const { data: salespeople = [] } = useQuery({
    queryKey: ["/api/users/salespeople"],
    staleTime: 0, // Sempre buscar dados atualizados
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Form for Prospecção phase (creation)
  const prospeccaoForm = useForm<ProspeccaoFormData>({
    resolver: zodResolver(prospeccaoFormSchema),
    defaultValues: {
      company: "",
    },
  });

  const createOpportunityMutation = useMutation({
    mutationFn: (data: ProspeccaoFormData) => apiRequest("POST", "/api/opportunities", {
      ...data,
      contact: data.company, // Use company name as contact initially
      phone: "", // Will be filled in later phases
      phase: "prospeccao"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Sucesso",
        description: "Nova oportunidade criada com sucesso!",
      });
      prospeccaoForm.reset();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar oportunidade.",
        variant: "destructive",
      });
    },
  });

  const onSubmitProspeccao = async (data: ProspeccaoFormData) => {
    createOpportunityMutation.mutate(data);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderProspeccaoForm = () => (
    <div className="space-y-4">
      {/* Número da oportunidade */}
      <div>
        <Label htmlFor="opportunityNumber" className="text-sm font-medium text-gray-700 flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          Número do orçamento
        </Label>
        <Input
          id="opportunityNumber"
          placeholder="#9999"
          className="mt-1"
          onChange={(e) => handleInputChange("opportunityNumber", e.target.value)}
          data-testid="form-opportunity-number"
        />
      </div>

      {/* Vendedor responsável */}
      <div>
        <Label htmlFor="salesperson" className="text-sm font-medium text-gray-700 flex items-center">
          <User className="h-4 w-4 mr-2" />
          * Vendedor responsável
        </Label>
        <Select onValueChange={(value) => handleInputChange("salesperson", value)}>
          <SelectTrigger className="mt-1" data-testid="form-salesperson">
            <SelectValue placeholder="+ Adicionar responsável" />
          </SelectTrigger>
          <SelectContent>
            {salespeople.map((salesperson) => (
              <SelectItem key={salesperson.id} value={salesperson.name}>
                {salesperson.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Necessário Visita? */}
      <div>
        <Label className="text-sm font-medium text-gray-700">* Necessário Visita?</Label>
        <RadioGroup
          className="flex flex-row space-x-4 mt-2"
          onValueChange={(value) => handleInputChange("requiresVisit", value === "sim")}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="sim" id="visit-sim" />
            <Label htmlFor="visit-sim">Sim</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="nao" id="visit-nao" />
            <Label htmlFor="visit-nao">Não</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Atividades */}
      <div>
        <Label className="text-sm font-medium text-gray-700 flex items-center">
          <Calendar className="h-4 w-4 mr-2" />
          Atividades
        </Label>
        <div className="mt-2 p-3 bg-green-50 rounded-md">
          <p className="text-sm text-green-700">
            📝 Lembre-se de logar suas atividades no menu de Atividades ou na forma de comentário!
          </p>
        </div>
      </div>

      
    </div>
  );

  const renderEmAtendimentoForm = () => (
    <div className="space-y-3">
      <div>
        <Label htmlFor="contact" className="text-sm font-medium text-gray-700">
          <User className="h-4 w-4 mr-2"/>Contato
        </Label>
        <Input
          id="contact"
          placeholder="Nome do contato"
          className="mt-1"
          onChange={(e) => handleInputChange("contact", e.target.value)}
          data-testid="form-contact"
        />
      </div>
      <div>
        <Label htmlFor="cpf" className="text-sm font-medium text-gray-700">
          <FileText className="h-4 w-4 mr-2"/>CPF
        </Label>
        <Input
          id="cpf"
          placeholder="000.000.000-00"
          className="mt-1"
          onChange={(e) => handleInputChange("cpf", e.target.value)}
          data-testid="form-cpf"
          {...masks.cpf}
        />
      </div>
      <div>
        <Label htmlFor="cnpj" className="text-sm font-medium text-gray-700">
          <Building className="h-4 w-4 mr-2"/>CNPJ
        </Label>
        <Input
          id="cnpj"
          placeholder="00.000.000/0000-00"
          className="mt-1"
          onChange={(e) => handleInputChange("cnpj", e.target.value)}
          data-testid="form-cnpj"
          {...masks.cnpj}
        />
      </div>
      <div>
        <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
          <Phone className="h-4 w-4 mr-2"/>Telefone
        </Label>
        <Input
          id="phone"
          placeholder="(00) 00000-0000"
          className="mt-1"
          onChange={(e) => handleInputChange("phone", e.target.value)}
          data-testid="form-phone"
          {...masks.phone}
        />
      </div>
      <div className="flex items-center space-x-3">
        <Checkbox
          id="hasRegistration"
          onCheckedChange={(value) => handleInputChange("hasRegistration", value)}
          data-testid="form-has-registration"
        />
        <Label htmlFor="hasRegistration" className="text-sm font-medium text-gray-700">
          Possui cadastro no Locador?
        </Label>
      </div>
      <div>
        <Label htmlFor="statement" className="text-sm font-medium text-gray-700">
          <FileText className="h-4 w-4 mr-2"/>Statement
        </Label>
        <Textarea
          id="statement"
          placeholder="Statement-2740521-4f2e-40a7-b0..."
          rows={3}
          className="mt-1"
          onChange={(e) => handleInputChange("statement", e.target.value)}
          data-testid="form-statement"
        />
      </div>
    </div>
  );

  const renderVisitaTecnicaForm = () => (
    <div className="space-y-4">
      {/* Agendamento de Visita */}
      <div>
        <Label htmlFor="visitSchedule" className="text-sm font-medium text-gray-700 flex items-center">
          <Calendar className="h-4 w-4 mr-2" />
          * Data de agendamento da visita
        </Label>
        <Input
          id="visitSchedule"
          type="text"
          placeholder={masks.date.placeholder}
          mask={masks.date.mask}
          className="mt-1"
          onChange={(e) => {
            masks.date.onChange(e);
            const isoDate = formatters.dateToISO(e.target.value);
            handleInputChange("visitSchedule", isoDate);
          }}
          data-testid="form-visit-schedule"
        />
      </div>

      {/* Descrição da Visita */}
      <div>
        <Label htmlFor="visitDescription" className="text-sm font-medium text-gray-700 flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          Descrição da visita
        </Label>
        <Textarea
          id="visitDescription"
          placeholder="Descreva os detalhes da visita técnica..."
          rows={4}
          className="mt-1"
          onChange={(e) => handleInputChange("visitDescription", e.target.value)}
          data-testid="form-visit-description"
        />
      </div>

      {/* Data de Realização da Visita */}
      <div>
        <Label htmlFor="visitDate" className="text-sm font-medium text-gray-700 flex items-center">
          <Calendar className="h-4 w-4 mr-2" />
          Data de realização da visita
        </Label>
        <Input
          id="visitDate"
          type="text"
          placeholder={masks.date.placeholder}
          mask={masks.date.mask}
          className="mt-1"
          onChange={(e) => {
            masks.date.onChange(e);
            const isoDate = formatters.dateToISO(e.target.value);
            handleInputChange("visitDate", isoDate);
          }}
          data-testid="form-visit-date"
        />
      </div>

      {/* Registro Fotográfico de Visita */}
      <div>
        <Label className="text-sm font-medium text-gray-700 flex items-center">
          <CloudUpload className="h-4 w-4 mr-2" />
          Fotos da visita
        </Label>
        <FileUpload
          multiple={true}
          accept="image/*"
          value={formData.visitPhotos || []}
          onFilesChange={(files) => handleInputChange("visitPhotos", files)}
          placeholder="Clique para adicionar fotos ou arraste arquivos aqui"
          data-testid="form-visit-photos"
        />
      </div>
    </div>
  );

  const renderPropostaForm = () => (
    <div className="space-y-4">
      {/* Descontos */}
      <div>
        <Label htmlFor="discount" className="text-sm font-medium text-gray-700 flex items-center">
          <DollarSign className="h-4 w-4 mr-2" />
          Descontos
        </Label>
        <Input
          id="discount"
          type="text"
          placeholder="0,00"
          className="mt-1"
          onChange={(e) => handleInputChange("discount", e.target.value)}
          data-testid="form-discount"
          {...masks.currency}
        />
      </div>

      {/* Lembre-se de atualizar o valor final do negócio */}
      <div className="p-3 bg-yellow-50 rounded-md">
        <p className="text-sm text-yellow-700 flex items-center">
          <i className="fas fa-exclamation-triangle mr-2"></i>
          Lembre-se de atualizar o valor final do negócio à esquerda!
        </p>
      </div>

      {/* Descritivo de descontos */}
      <div>
        <Label htmlFor="discountDescription" className="text-sm font-medium text-gray-700 flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          Descritivo de descontos
        </Label>
        <Textarea
          id="discountDescription"
          placeholder="Descreva os descontos aplicados..."
          rows={4}
          className="mt-1"
          onChange={(e) => handleInputChange("discountDescription", e.target.value)}
          data-testid="form-discount-description"
        />
      </div>

      {/* Data de validade da proposta */}
      <div>
        <Label htmlFor="validityDate" className="text-sm font-medium text-gray-700 flex items-center">
          <Calendar className="h-4 w-4 mr-2" />
          Data de validade da proposta
        </Label>
        <Input
          id="validityDate"
          type="text"
          className="mt-1"
          placeholder={masks.date.placeholder}
          mask={masks.date.mask}
          onChange={(e) => {
            masks.date.onChange(e);
            const isoDate = formatters.dateToISO(e.target.value);
            handleInputChange("validityDate", isoDate);
          }}
          data-testid="form-validity-date"
        />
      </div>

      {/* Nº de Orçamento */}
      <div>
        <Label htmlFor="budgetNumber" className="text-sm font-medium text-gray-700 flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          Nº de Orçamento
        </Label>
        <Input
          id="budgetNumber"
          placeholder="0"
          className="mt-1"
          onChange={(e) => handleInputChange("budgetNumber", e.target.value)}
          data-testid="form-budget-number"
        />
      </div>

      {/* Orçamento */}
      <div>
        <Label htmlFor="budget" className="text-sm font-medium text-gray-700 flex items-center">
          <DollarSign className="h-4 w-4 mr-2" />
          Orçamento
        </Label>
        <Input
          id="budget"
          type="text"
          placeholder={masks.currency.placeholder}
          className="mt-1"
          onChange={(e) => {
            masks.currency.onChange(e);
            handleInputChange("budget", e.target.value);
          }}
          data-testid="form-budget"
        />
        <FileUpload
          multiple={false}
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          value={formData.budgetFile ? [formData.budgetFile] : []}
          onFilesChange={(files) => handleInputChange("budgetFile", files[0])}
          placeholder="Clique para fazer upload do orçamento"
          className="mt-1"
        />
      </div>

      {/* Cliente cadastra no Locador? */}
      <div>
        <Label className="text-sm font-medium text-gray-700 flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          * Cliente cadastra no Locador?
        </Label>
        <RadioGroup
          className="flex flex-row space-x-4 mt-2"
          onValueChange={(value) => handleInputChange("clientRegistration", value === "sim")}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="sim" id="client-sim" />
            <Label htmlFor="client-sim">Sim</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="nao" id="client-nao" />
            <Label htmlFor="client-nao">Não</Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );

  const renderNegociacaoForm = () => (
    <div className="space-y-4">
      {/* Status */}
      <div>
        <Label htmlFor="status" className="text-sm font-medium text-gray-700 flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          * Status
        </Label>
        <Select onValueChange={(value) => handleInputChange("status", value)}>
          <SelectTrigger className="mt-1" data-testid="form-status">
            <SelectValue placeholder="Ganho ou Perdido" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ganho">Ganho</SelectItem>
            <SelectItem value="perdido">Perdido</SelectItem>
            <SelectItem value="em-negociacao">Em negociação</SelectItem>
            <SelectItem value="aguardando-resposta">Aguardando resposta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Valor final da oportunidade */}
      <div>
        <Label htmlFor="finalValue" className="text-sm font-medium text-gray-700 flex items-center">
          <DollarSign className="h-4 w-4 mr-2" />
          * Valor final da oportunidade
        </Label>
        <Input
          id="finalValue"
          type="text"
          placeholder={masks.currency.placeholder}
          className="mt-1"
          onChange={(e) => {
            masks.currency.onChange(e);
            handleInputChange("finalValue", e.target.value);
          }}
          data-testid="form-final-value"
        />
      </div>

      {/* Informações da negociação */}
      <div>
        <Label htmlFor="negotiationInfo" className="text-sm font-medium text-gray-700 flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          Informações da negociação
        </Label>
        <Textarea
          id="negotiationInfo"
          placeholder="Detalhes da negociação..."
          rows={4}
          className="mt-1"
          onChange={(e) => handleInputChange("negotiationInfo", e.target.value)}
          data-testid="form-negotiation-info"
        />
      </div>

      {/* Contrato */}
      <div>
        <Label htmlFor="contract" className="text-sm font-medium text-gray-700 flex items-center">
          <Upload className="h-4 w-4 mr-2" />
          Contrato
        </Label>
        <FileUpload
          multiple={false}
          accept=".pdf,.doc,.docx"
          value={formData.contract ? [formData.contract] : []}
          onFilesChange={(files) => handleInputChange("contract", files[0])}
          placeholder="Clique para fazer upload do contrato"
          data-testid="form-contract"
        />
      </div>

      {/* Nº de Fatura */}
      <div>
        <Label htmlFor="invoiceNumber" className="text-sm font-medium text-gray-700 flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          Nº de Fatura
        </Label>
        <Input
          id="invoiceNumber"
          placeholder="0"
          className="mt-1"
          onChange={(e) => handleInputChange("invoiceNumber", e.target.value)}
          data-testid="form-invoice-number"
        />
      </div>

      {/* Motivo da perda */}
      <div>
        <Label htmlFor="lossReason" className="text-sm font-medium text-gray-700 flex items-center">
          <X className="h-4 w-4 mr-2" />
          * Motivo da perda
        </Label>
        <Textarea
          id="lossReason"
          placeholder="Caso a oportunidade seja perdida..."
          rows={3}
          className="mt-1"
          onChange={(e) => handleInputChange("lossReason", e.target.value)}
          data-testid="form-loss-reason"
        />
      </div>

      {/* Data de fechamento */}
      <div>
        <Label htmlFor="closingDate" className="text-sm font-medium text-gray-700 flex items-center">
          <Calendar className="h-4 w-4 mr-2" />
          Data de fechamento
        </Label>
        <Input
          id="closingDate"
          type="text"
          className="mt-1"
          placeholder={masks.date.placeholder}
          mask={masks.date.mask}
          onChange={(e) => {
            masks.date.onChange(e);
            handleInputChange("closingDate", e.target.value);
          }}
          data-testid="form-closing-date"
        />
      </div>
    </div>
  );

  const renderAutomationSection = () => (
    <div className="pt-3 border-t border-gray-300">
      <h4 className="text-sm font-medium text-gray-900 mb-2">Adicione uma automação a esta fase</h4>
      <div className="space-y-2">
        <div>
          <Label htmlFor="automationTrigger" className="text-xs font-medium text-gray-600">
            Sempre que...
          </Label>
          <Select>
            <SelectTrigger className="mt-1" data-testid="form-automation-trigger">
              <SelectValue placeholder="Selecione um evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="opportunity-created">Oportunidade criada</SelectItem>
              <SelectItem value="field-changed">Campo alterado</SelectItem>
              <SelectItem value="time-elapsed">Tempo decorrido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="automationAction" className="text-xs font-medium text-gray-600">
            Faça isso...
          </Label>
          <Select>
            <SelectTrigger className="mt-1" data-testid="form-automation-action">
              <SelectValue placeholder="Selecione uma ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="send-email">Enviar email</SelectItem>
              <SelectItem value="create-task">Criar tarefa</SelectItem>
              <SelectItem value="move-to-next">Mover para próxima fase</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-500 hover:text-blue-600 p-0 h-auto"
          data-testid="button-add-automation"
        >
          <Plus className="mr-1 h-4 w-4" />
          Adicionar automação
        </Button>
      </div>
    </div>
  );

  const renderFormByPhase = () => {
    switch (phase) {
      case PHASES.PROSPECCAO:
        return renderProspeccaoForm();
      case PHASES.EM_ATENDIMENTO:
        return renderEmAtendimentoForm();
      case PHASES.VISITA_TECNICA:
        return renderVisitaTecnicaForm();
      case PHASES.PROPOSTA:
        return renderPropostaForm();
      case PHASES.NEGOCIACAO:
        return renderNegociacaoForm();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {renderFormByPhase()}
      {phase !== PHASES.PROSPECCAO && renderAutomationSection()}
    </div>
  );
}