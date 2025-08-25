import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Upload, CloudUpload } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PHASES, insertOpportunitySchema } from "@shared/schema";

interface OpportunityFormProps {
  phase: string;
}

// Form schema for Prospecção (creation)
const prospeccaoFormSchema = insertOpportunitySchema.pick({
  contact: true,
  cpf: true,
  company: true,
  cnpj: true,
  phone: true,
  hasRegistration: true,
}).extend({
  cpf: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  hasRegistration: z.boolean().nullable().optional(),
});

type ProspeccaoFormData = z.infer<typeof prospeccaoFormSchema>;

export default function OpportunityForm({ phase }: OpportunityFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form for Prospecção phase (creation)
  const prospeccaoForm = useForm<ProspeccaoFormData>({
    resolver: zodResolver(prospeccaoFormSchema),
    defaultValues: {
      contact: "",
      cpf: null,
      company: "",
      cnpj: null,
      phone: "",
      hasRegistration: false,
    },
  });

  const createOpportunityMutation = useMutation({
    mutationFn: (data: ProspeccaoFormData) => apiRequest("POST", "/api/opportunities", {
      ...data,
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
    <Form {...prospeccaoForm}>
      <form onSubmit={prospeccaoForm.handleSubmit(onSubmitProspeccao)} className="space-y-3">
        <FormField
          control={prospeccaoForm.control}
          name="contact"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">
                <i className="fas fa-user mr-1"></i>Contato
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="Nome do contato" 
                  {...field} 
                  data-testid="form-contact"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={prospeccaoForm.control}
          name="cpf"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">
                <i className="fas fa-id-card mr-1"></i>CPF
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="000.000.000-00" 
                  {...field}
                  value={field.value || ""}
                  data-testid="form-cpf"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={prospeccaoForm.control}
          name="company"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">
                <i className="fas fa-building mr-1"></i>Empresa
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="Nome da empresa" 
                  {...field} 
                  data-testid="form-company"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={prospeccaoForm.control}
          name="cnpj"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">
                <i className="fas fa-building mr-1"></i>CNPJ
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="00.000.000/0000-00" 
                  {...field}
                  value={field.value || ""}
                  data-testid="form-cnpj"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={prospeccaoForm.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700">
                <i className="fas fa-phone mr-1"></i>Telefone
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="(00) 00000-0000" 
                  {...field} 
                  data-testid="form-phone"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={prospeccaoForm.control}
          name="hasRegistration"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value || false}
                  onCheckedChange={field.onChange}
                  data-testid="form-has-registration"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-medium text-gray-700">
                  Possui cadastro no Locador?
                </FormLabel>
              </div>
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          disabled={createOpportunityMutation.isPending}
          data-testid="button-create-opportunity"
        >
          {createOpportunityMutation.isPending ? "Criando..." : "Criar Oportunidade"}
        </Button>
      </form>
    </Form>
  );

  const renderEmAtendimentoForm = () => (
    <div className="space-y-3">
      <div>
        <Label htmlFor="opportunityNumber" className="text-sm font-medium text-gray-700">
          <i className="fas fa-hashtag mr-1"></i>Número da oportunidade
        </Label>
        <Input
          id="opportunityNumber"
          placeholder="OP-001"
          className="mt-1"
          onChange={(e) => handleInputChange("opportunityNumber", e.target.value)}
          data-testid="form-opportunity-number"
        />
      </div>
      <div>
        <Label htmlFor="salesperson" className="text-sm font-medium text-gray-700">
          <i className="fas fa-user-tie mr-1"></i>Vendedor responsável
        </Label>
        <Select onValueChange={(value) => handleInputChange("salesperson", value)}>
          <SelectTrigger className="mt-1" data-testid="form-salesperson">
            <SelectValue placeholder="Selecione o vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="carlos">Carlos Mendes</SelectItem>
            <SelectItem value="ana">Ana Silva</SelectItem>
            <SelectItem value="pedro">Pedro Santos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center space-x-3">
        <Checkbox
          id="requiresVisit"
          onCheckedChange={(value) => handleInputChange("requiresVisit", value)}
          data-testid="form-requires-visit"
        />
        <Label htmlFor="requiresVisit" className="text-sm font-medium text-gray-700">
          Necessário Visita?
        </Label>
      </div>
      <div>
        <Label htmlFor="statement" className="text-sm font-medium text-gray-700">
          <i className="fas fa-file-alt mr-1"></i>Statement
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
      <div>
        <Label htmlFor="nextActivityDate" className="text-sm font-medium text-gray-700">
          <i className="fas fa-calendar-alt mr-1"></i>Data da próxima atividade
        </Label>
        <Input
          id="nextActivityDate"
          type="date"
          className="mt-1"
          onChange={(e) => handleInputChange("nextActivityDate", e.target.value)}
          data-testid="form-next-activity-date"
        />
      </div>
    </div>
  );

  const renderVisitaTecnicaForm = () => (
    <div className="space-y-3">
      <div>
        <Label htmlFor="visitSchedule" className="text-sm font-medium text-gray-700">
          <i className="fas fa-calendar-plus mr-1"></i>Agendamento de Visita
        </Label>
        <Input
          id="visitSchedule"
          type="datetime-local"
          className="mt-1"
          onChange={(e) => handleInputChange("visitSchedule", e.target.value)}
          data-testid="form-visit-schedule"
        />
      </div>
      <div>
        <Label htmlFor="visitRealization" className="text-sm font-medium text-gray-700">
          <i className="fas fa-clock mr-1"></i>Data e Hora de Realização da Visita
        </Label>
        <Input
          id="visitRealization"
          type="datetime-local"
          className="mt-1"
          onChange={(e) => handleInputChange("visitRealization", e.target.value)}
          data-testid="form-visit-realization"
        />
      </div>
      <div>
        <Label htmlFor="visitPhotos" className="text-sm font-medium text-gray-700">
          <i className="fas fa-camera mr-1"></i>Registro Fotográfico de Visita
        </Label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center mt-1 cursor-pointer hover:border-gray-400 transition-colors">
          <CloudUpload className="text-gray-400 text-xl mb-2 mx-auto" />
          <p className="text-sm text-gray-500">Clique para adicionar fotos ou arraste arquivos aqui</p>
          <input type="file" className="hidden" multiple accept="image/*" data-testid="form-visit-photos" />
        </div>
      </div>
    </div>
  );

  const renderPropostaForm = () => (
    <div className="space-y-3">
      <div>
        <Label htmlFor="discount" className="text-sm font-medium text-gray-700">
          <i className="fas fa-percentage mr-1"></i>Descontos
        </Label>
        <Input
          id="discount"
          type="number"
          placeholder="0%"
          className="mt-1"
          onChange={(e) => handleInputChange("discount", e.target.value)}
          data-testid="form-discount"
        />
      </div>
      <div>
        <Label htmlFor="statementProposta" className="text-sm font-medium text-gray-700">
          <i className="fas fa-file-alt mr-1"></i>Statement
        </Label>
        <Textarea
          id="statementProposta"
          placeholder="Statement-feddf1835-1561-63f5-ab..."
          rows={2}
          className="mt-1"
          onChange={(e) => handleInputChange("statement", e.target.value)}
          data-testid="form-statement-proposta"
        />
      </div>
      <div>
        <Label htmlFor="discountDescription" className="text-sm font-medium text-gray-700">
          <i className="fas fa-align-left mr-1"></i>Descritivo de descontos
        </Label>
        <Textarea
          id="discountDescription"
          placeholder="Descreva os descontos aplicados..."
          rows={3}
          className="mt-1"
          onChange={(e) => handleInputChange("discountDescription", e.target.value)}
          data-testid="form-discount-description"
        />
      </div>
      <div>
        <Label htmlFor="validityDate" className="text-sm font-medium text-gray-700">
          <i className="fas fa-calendar-times mr-1"></i>Data de validade da proposta
        </Label>
        <Input
          id="validityDate"
          type="date"
          className="mt-1"
          onChange={(e) => handleInputChange("validityDate", e.target.value)}
          data-testid="form-validity-date"
        />
      </div>
      <div>
        <Label htmlFor="budgetNumber" className="text-sm font-medium text-gray-700">
          <i className="fas fa-hashtag mr-1"></i>Nº de Orçamento
        </Label>
        <Input
          id="budgetNumber"
          placeholder="ORC-001"
          className="mt-1"
          onChange={(e) => handleInputChange("budgetNumber", e.target.value)}
          data-testid="form-budget-number"
        />
      </div>
      <div>
        <Label htmlFor="budget" className="text-sm font-medium text-gray-700">
          <i className="fas fa-dollar-sign mr-1"></i>Orçamento
        </Label>
        <Input
          id="budget"
          type="number"
          placeholder="R$ 0,00"
          className="mt-1"
          onChange={(e) => handleInputChange("budget", e.target.value)}
          data-testid="form-budget"
        />
      </div>
    </div>
  );

  const renderNegociacaoForm = () => (
    <div className="space-y-3">
      <div>
        <Label htmlFor="status" className="text-sm font-medium text-gray-700">
          <i className="fas fa-info-circle mr-1"></i>Status
        </Label>
        <Select onValueChange={(value) => handleInputChange("status", value)}>
          <SelectTrigger className="mt-1" data-testid="form-status">
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="em-negociacao">Em negociação</SelectItem>
            <SelectItem value="aguardando-resposta">Aguardando resposta</SelectItem>
            <SelectItem value="aguardando-documentacao">Aguardando documentação</SelectItem>
            <SelectItem value="pronto-para-fechar">Pronto para fechar</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="finalValue" className="text-sm font-medium text-gray-700">
          <i className="fas fa-trophy mr-1"></i>Valor final da oportunidade
        </Label>
        <Input
          id="finalValue"
          type="number"
          placeholder="R$ 0,00"
          className="mt-1"
          onChange={(e) => handleInputChange("finalValue", e.target.value)}
          data-testid="form-final-value"
        />
      </div>
      <div>
        <Label htmlFor="negotiationInfo" className="text-sm font-medium text-gray-700">
          <i className="fas fa-comments mr-1"></i>Informações da negociação
        </Label>
        <Textarea
          id="negotiationInfo"
          placeholder="Detalhes da negociação..."
          rows={3}
          className="mt-1"
          onChange={(e) => handleInputChange("negotiationInfo", e.target.value)}
          data-testid="form-negotiation-info"
        />
      </div>
      <div>
        <Label htmlFor="contract" className="text-sm font-medium text-gray-700">
          <i className="fas fa-file-signature mr-1"></i>Contrato
        </Label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center mt-1 cursor-pointer hover:border-gray-400 transition-colors">
          <Upload className="text-gray-400 text-lg mb-1 mx-auto" />
          <p className="text-xs text-gray-500">Upload do contrato</p>
          <input type="file" className="hidden" accept=".pdf,.doc,.docx" data-testid="form-contract" />
        </div>
      </div>
      <div>
        <Label htmlFor="invoiceNumber" className="text-sm font-medium text-gray-700">
          <i className="fas fa-receipt mr-1"></i>Nº de Fatura
        </Label>
        <Input
          id="invoiceNumber"
          placeholder="FAT-001"
          className="mt-1"
          onChange={(e) => handleInputChange("invoiceNumber", e.target.value)}
          data-testid="form-invoice-number"
        />
      </div>
      <div>
        <Label htmlFor="lossReason" className="text-sm font-medium text-gray-700">
          <i className="fas fa-times-circle mr-1"></i>Motivo da perda
        </Label>
        <Textarea
          id="lossReason"
          placeholder="Caso a oportunidade seja perdida..."
          rows={2}
          className="mt-1"
          onChange={(e) => handleInputChange("lossReason", e.target.value)}
          data-testid="form-loss-reason"
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
      {renderAutomationSection()}
    </div>
  );
}
