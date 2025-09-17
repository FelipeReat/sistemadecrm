import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, Handshake, MapPin, DollarSign, Upload, User, X, Trash2, TriangleAlert, Image } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useReportsSync } from "@/hooks/useReportsSync";
import type { Opportunity } from "@shared/schema";
import { masks } from "@/lib/masks";
import { formatters } from "@/lib/formatters";

interface OpportunityDetailsModalProps {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Schema para o formulário de prospecção
const prospeccaoSchema = z.object({
  opportunityNumber: z.string().optional(),
  salesperson: z.string().optional(),
  requiresVisit: z.boolean().default(false),
});

// Schema para o formulário de em atendimento
const emAtendimentoSchema = z.object({
  statement: z.string().optional(),
});

// Schema para o formulário de visita técnica
const visitaTecnicaSchema = z.object({
  visitSchedule: z.string().min(1, "Data de agendamento da visita é obrigatória"),
  visitDate: z.string().optional(),
  visitDescription: z.string().optional(),
  visitPhotos: z.array(z.object({
    id: z.string(),
    name: z.string(),
    size: z.number(),
    type: z.string(),
    url: z.string()
  })).optional().default([]),
});

// Schema para o formulário de proposta
const propostaSchema = z.object({
  discount: z.string().optional(),
  discountDescription: z.string().optional(),
  validityDate: z.string().min(1, "Data de validade é obrigatória"),
  budgetNumber: z.string().min(1, "Número do orçamento é obrigatório"),
  budget: z.string().min(1, "Valor do orçamento é obrigatório"),
  salesperson: z.string().optional(),
  budgetFile: z.object({
    id: z.string(),
    name: z.string(),
    size: z.number(),
    type: z.string(),
    url: z.string()
  }).optional(),
});

// Schema para o formulário de negociação
const negociacaoSchema = z.object({
  status: z.string().min(1, "Status é obrigatório"),
  finalValue: z.string().min(1, "Valor final é obrigatório"),
  negotiationInfo: z.string().optional(),
  contract: z.string().optional(), // String para o número do contrato
  invoiceNumber: z.string().optional(),
  lossReason: z.string().optional(),
});

// Schema para o formulário de perdido
const perdidoSchema = z.object({
  lossReason: z.string().trim().min(1, "Motivo da perda é obrigatório"),
  lossObservation: z.string().trim().min(1, "Observação é obrigatória"),
});

type ProspeccaoFormData = z.infer<typeof prospeccaoSchema>;
type EmAtendimentoFormData = z.infer<typeof emAtendimentoSchema>;
type VisitaTecnicaFormData = z.infer<typeof visitaTecnicaSchema>;
type PropostaFormData = z.infer<typeof propostaSchema>;
type NegociacaoFormData = z.infer<typeof negociacaoSchema>;
type PerdidoFormData = z.infer<typeof perdidoSchema>;

export default function OpportunityDetailsModal({
  opportunity,
  open,
  onOpenChange,
}: OpportunityDetailsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { invalidateAllData } = useReportsSync();

  // Query para buscar usuários que podem ser vendedores
  const { data: salespeople, isLoading: isLoadingSalespeople } = useQuery({
    queryKey: ["/api/users/salespeople"],
    staleTime: 0, // Sempre buscar dados atualizados
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const prospeccaoForm = useForm<ProspeccaoFormData>({
    resolver: zodResolver(prospeccaoSchema),
    defaultValues: {
      opportunityNumber: opportunity?.opportunityNumber || "",
      salesperson: opportunity?.salesperson || "",
      requiresVisit: opportunity?.requiresVisit || false,
    },
    mode: "onChange", // Validação em tempo real
    reValidateMode: "onChange"
  });

  const emAtendimentoForm = useForm<EmAtendimentoFormData>({
    resolver: zodResolver(emAtendimentoSchema),
    defaultValues: {
      statement: opportunity?.statement || "",
    },
  });

  const visitaTecnicaForm = useForm<VisitaTecnicaFormData>({
    resolver: zodResolver(visitaTecnicaSchema),
    defaultValues: {
      visitSchedule: opportunity?.visitSchedule || "",
      visitDate: opportunity?.visitRealization || "",
      visitDescription: opportunity?.visitDescription || "",
      visitPhotos: opportunity?.visitPhotos || [],
    },
  });

  const propostaForm = useForm<PropostaFormData>({
    resolver: zodResolver(propostaSchema),
    defaultValues: {
      discount: opportunity?.discount || "",
      discountDescription: opportunity?.discountDescription || "",
      validityDate: opportunity?.validityDate || "",
      budgetNumber: opportunity?.budgetNumber || opportunity?.opportunityNumber || "",
      budget: opportunity?.budget || "",
      budgetFile: undefined,
    },
  });

  const negociacaoForm = useForm<NegociacaoFormData>({
    resolver: zodResolver(negociacaoSchema),
    defaultValues: {
      status: opportunity?.status || "",
      finalValue: opportunity?.finalValue || "",
      negotiationInfo: opportunity?.negotiationInfo || "",
      contract: opportunity?.contract || "",
      invoiceNumber: opportunity?.invoiceNumber || "",
      lossReason: opportunity?.lossReason || "",
    },
  });

  const perdidoForm = useForm<PerdidoFormData>({
    resolver: zodResolver(perdidoSchema),
    defaultValues: {
      lossReason: opportunity?.lossReason || "",
      lossObservation: opportunity?.lossObservation || "",
    },
  });

  // Resetar todos os formulários quando o modal abrir ou a oportunidade mudar
  useEffect(() => {
    if (open && opportunity) {
      // Resetar todos os formulários com os dados da oportunidade atual
      prospeccaoForm.reset({
        opportunityNumber: opportunity.opportunityNumber || "",
        salesperson: opportunity.salesperson || "",
        requiresVisit: opportunity.requiresVisit || false,
      });

      emAtendimentoForm.reset({
        statement: opportunity.statement || "",
      });

      visitaTecnicaForm.reset({
        visitSchedule: opportunity.visitSchedule || "",
        visitDate: opportunity.visitDate || "",
        visitPhotos: opportunity.visitPhotos || [],
      });

      propostaForm.reset({
        discount: opportunity.discount || "",
        discountDescription: opportunity.discountDescription || "",
        validityDate: opportunity.validityDate ? new Date(opportunity.validityDate).toISOString().split('T')[0] : "",
        budgetNumber: opportunity.budgetNumber || opportunity.opportunityNumber || "",
        budget: opportunity.budget || "",
        salesperson: opportunity.salesperson || "",
        budgetFile: undefined,
      });

      negociacaoForm.reset({
        status: opportunity.status || "",
        finalValue: opportunity.finalValue || "",
        negotiationInfo: opportunity.negotiationInfo || "",
        contract: opportunity.contract || "",
        invoiceNumber: opportunity.invoiceNumber || "",
        lossReason: opportunity.lossReason || "",
      });

      perdidoForm.reset({
        lossReason: opportunity.lossReason || "",
        lossObservation: opportunity.lossObservation || "",
      });
    } else if (open && !opportunity) {
      // Limpar todos os formulários quando abrir sem oportunidade
      prospeccaoForm.reset({
        opportunityNumber: "",
        salesperson: "",
        requiresVisit: false,
      });

      emAtendimentoForm.reset({
        statement: "",
      });

      visitaTecnicaForm.reset({
        visitSchedule: "",
        visitDate: "",
        visitPhotos: [],
      });

      propostaForm.reset({
        discount: "",
        discountDescription: "",
        validityDate: "",
        budgetNumber: "",
        budget: "",
        salesperson: "",
        budgetFile: undefined,
      });

      negociacaoForm.reset({
        status: "",
        finalValue: "",
        negotiationInfo: "",
        contract: "",
        invoiceNumber: "",
        lossReason: "",
      });

      perdidoForm.reset({
        lossReason: "",
        lossObservation: "",
      });
    }
  }, [open, opportunity, prospeccaoForm, emAtendimentoForm, visitaTecnicaForm, propostaForm, negociacaoForm, perdidoForm]);

  const updateOpportunityMutation = useMutation({
    mutationFn: (data: any & { id: string }) =>
      apiRequest("PATCH", `/api/opportunities/${data.id}`, data),
    onSuccess: () => {
      invalidateAllData(); // Sincroniza dashboard e relatórios
      toast({
        title: "Sucesso",
        description: "Oportunidade atualizada com sucesso!",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao atualizar oportunidade.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const moveToNextPhaseMutation = useMutation({
    mutationFn: ({ opportunityId, newPhase }: { opportunityId: string; newPhase: string }) =>
      apiRequest("PATCH", `/api/opportunities/${opportunityId}/move/${newPhase}`),
    onSuccess: () => {
      invalidateAllData(); // Sincroniza dashboard e relatórios
      toast({
        title: "Sucesso",
        description: "Oportunidade movida para a próxima fase!",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao mover oportunidade.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const deleteOpportunityMutation = useMutation({
    mutationFn: (opportunityId: string) =>
      apiRequest("DELETE", `/api/opportunities/${opportunityId}`),
    onSuccess: () => {
      invalidateAllData(); // Sincroniza dashboard e relatórios
      toast({
        title: "Sucesso",
        description: "Oportunidade excluída com sucesso!",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao excluir oportunidade.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const getNextPhase = (currentPhase: string): string | null => {
    const phaseOrder = ["prospeccao", "em-atendimento", "visita-tecnica", "proposta", "negociacao", "ganho"];
    const currentIndex = phaseOrder.indexOf(currentPhase);
    return currentIndex < phaseOrder.length - 1 ? phaseOrder[currentIndex + 1] : null;
  };

  const handleDelete = () => {
    if (!opportunity) return;

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir a oportunidade da empresa "${opportunity.company}"? Esta ação não pode ser desfeita.`
    );

    if (confirmed) {
      setIsSubmitting(true);
      deleteOpportunityMutation.mutate(opportunity.id);
    }
  };

  const handleSubmit = async (data: any) => {
    if (!opportunity) return;

    setIsSubmitting(true);

    try {
      // Clean the formatted values before sending to API
      const cleanedData = { ...data };

      // Clean budget value (remove currency formatting) - Keep as string
      if (cleanedData.budget) {
        cleanedData.budget = cleanedData.budget
          .replace(/[R$\s]/g, '')  // Remove R$ and spaces
          .replace(/\./g, '')      // Remove thousand separators
          .replace(',', '.')       // Convert decimal separator
      }

      // Clean discount value (remove percentage formatting) - Keep as string
      if (cleanedData.discount) {
        cleanedData.discount = cleanedData.discount
          .replace('%', '')        // Remove percentage symbol
          .replace(',', '.')       // Convert decimal separator
      }

      // Clean finalValue (remove currency formatting) - Keep as string
      if (cleanedData.finalValue) {
        cleanedData.finalValue = cleanedData.finalValue
          .replace(/[R$\s]/g, '')  // Remove R$ and spaces
          .replace(/\./g, '')      // Remove thousand separators
          .replace(',', '.')       // Convert decimal separator
      }

      // Clean date value (convert DD/MM/YYYY to YYYY-MM-DD)
      if (cleanedData.validityDate) {
        const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const match = cleanedData.validityDate.match(dateRegex);
        if (match) {
          const [, day, month, year] = match;
          cleanedData.validityDate = `${year}-${month}-${day}`;
        }
      }

      // Handle budget file - add to existing documents with proper tracking
      if (cleanedData.budgetFile) {
        const existingDocuments = opportunity.documents ? [...opportunity.documents] : [];
        
        // Mark this document as a proposal document with metadata
        const budgetDoc = {
          ...cleanedData.budgetFile,
          documentType: 'proposal', // Add metadata to identify document type
          phaseAdded: 'proposta',
          addedAt: new Date().toISOString(),
          addedInPhase: opportunity.phase
        };
        
        // Convert to JSON string as expected by the backend
        existingDocuments.push(JSON.stringify(budgetDoc));
        cleanedData.documents = existingDocuments;
      } else {
        // Preserve existing documents if no budget file was uploaded
        if (opportunity.documents && !cleanedData.documents) {
          cleanedData.documents = opportunity.documents;
        }
      }

      if (opportunity.visitPhotos && !cleanedData.visitPhotos) {
        cleanedData.visitPhotos = opportunity.visitPhotos;
      }

      // Remove apenas campos undefined ou null, mantém strings vazias
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key] === undefined || cleanedData[key] === null) {
          delete cleanedData[key];
        }
      });

      // Remove o campo budgetFile que é específico do form (já foi processado acima)
      delete cleanedData.budgetFile;

      // Apenas atualiza os dados da oportunidade
      await updateOpportunityMutation.mutateAsync({ ...cleanedData, id: opportunity.id });

    } catch (error) {
      console.error("Erro ao salvar:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPhaseForm = () => {
    if (!opportunity) return null;

    switch (opportunity.phase) {
      case "prospeccao":
        return (
          <Form {...prospeccaoForm}>
            <form onSubmit={prospeccaoForm.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold text-gray-900 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Informações de Prospecção
                </h4>

                <FormField
                  control={prospeccaoForm.control}
                  name="opportunityNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        Número do orçamento
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="#9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={prospeccaoForm.control}
                  name="salesperson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        * Vendedor responsável
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o vendedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingSalespeople ? (
                            <SelectItem value="loading" disabled>Carregando vendedores...</SelectItem>
                          ) : salespeople && salespeople.length > 0 ? (
                            salespeople.map((user: any) => (
                              <SelectItem key={user.id} value={user.name}>
                                {user.name} ({user.role === 'admin' ? 'Admin' : user.role === 'gerente' ? 'Gerente' : 'Vendedor'})
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-salespeople" disabled>Nenhum vendedor encontrado</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={prospeccaoForm.control}
                  name="requiresVisit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>* Necessário Visita?</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => field.onChange(value === "sim")}
                          defaultValue={field.value ? "sim" : "nao"}
                          className="flex flex-row space-x-4"
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting || deleteOpportunityMutation.isPending}
                  data-testid="button-delete-opportunity"
                  title="Excluir oportunidade"
                  aria-label="Excluir oportunidade"
                  className="text-red-600 bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmitting ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        );

      case "em-atendimento":
        return (
          <Form {...emAtendimentoForm}>
            <form onSubmit={emAtendimentoForm.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold text-gray-900 flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Informações de Atendimento
                </h4>

                <FormField
                  control={emAtendimentoForm.control}
                  name="statement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        * Declaração/Observações
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva as necessidades do cliente, informações importantes..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting || deleteOpportunityMutation.isPending}
                  data-testid="button-delete-opportunity"
                  title="Excluir oportunidade"
                  aria-label="Excluir oportunidade"
                  className="text-red-600 bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmitting ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        );

      case "visita-tecnica":
        return (
          <Form {...visitaTecnicaForm}>
            <form onSubmit={visitaTecnicaForm.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold text-gray-900 flex items-center">
                  <MapPin className="h-4 w-4 mr-2" />
                  Informações da Visita Técnica
                </h4>

                <FormField
                  control={visitaTecnicaForm.control}
                  name="visitSchedule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        * Data de agendamento da visita
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder={masks.datetime.placeholder}
                          mask={masks.datetime.mask}
                          {...field}
                          onChange={(e) => {
                            masks.datetime.onChange(e);
                            field.onChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                   </FormItem>
                  )}
                />

                {/* Data de realização */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Data de realização da visita</Label>
                <FormField
                  control={visitaTecnicaForm.control}
                  name="visitDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder={masks.datetime.placeholder}
                          mask={masks.datetime.mask}
                          {...field}
                          onChange={(e) => {
                            masks.datetime.onChange(e);
                            field.onChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Descrição da visita */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Descrição da visita</Label>
                <FormField
                  control={visitaTecnicaForm.control}
                  name="visitDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva os detalhes da visita técnica..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>


                <FormField
                  control={visitaTecnicaForm.control}
                  name="visitPhotos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Upload className="h-4 w-4 mr-2" />
                        Fotos da visita
                      </FormLabel>
                      <FormControl>
                        <FileUpload
                          multiple={true}
                          accept="image/*"
                          value={field.value || []}
                          onFilesChange={(files) => field.onChange(files)}
                          placeholder="Clique para adicionar fotos ou arraste arquivos aqui"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting || deleteOpportunityMutation.isPending}
                  data-testid="button-delete-opportunity"
                  title="Excluir oportunidade"
                  aria-label="Excluir oportunidade"
                  className="text-red-600 bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmitting ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        );

      case "proposta":
        return (
          <Form {...propostaForm}>
            <form onSubmit={propostaForm.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold text-gray-900 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Informações da Proposta
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={propostaForm.control}
                    name="budgetNumber"
                    render={({ field }) => {
                      // Verifica se o número do orçamento foi preenchido automaticamente
                      // Isso acontece quando a oportunidade vem de outras fases e já tem opportunityNumber
                      const isAutoFilled = opportunity?.opportunityNumber && field.value === opportunity.opportunityNumber;
                      // Se foi criado direto na fase de proposta, não tem opportunityNumber nas fases anteriores
                      const wasCreatedDirectlyInProposal = !opportunity?.opportunityNumber;

                      return (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            <FileText className="h-4 w-4 mr-2" />
                            * Número do orçamento
                            {isAutoFilled && (
                              <span className="ml-2 text-xs text-gray-500">(preenchido automaticamente)</span>
                            )}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="ORC-001"
                              {...field}
                              disabled={isAutoFilled}
                              className={isAutoFilled ? "bg-gray-100 cursor-not-allowed" : ""}
                              onChange={(e) => field.onChange(masks.cnpjOrCpf(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={propostaForm.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-2" />
                          * Valor do orçamento
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={masks.currency.placeholder}
                            {...field}
                            onChange={(e) => {
                              masks.currency.onChange(e);
                              field.onChange(e.target.value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={propostaForm.control}
                    name="discount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desconto (%)</FormLabel>
                        <FormControl>
                          <Input placeholder="10" {...field} onChange={(e) => { masks.percent.onChange(e); field.onChange(e.target.value); }} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={propostaForm.control}
                    name="validityDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          * Data de validade
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder={masks.date.placeholder}
                            mask={masks.date.mask}
                            {...field}
                            onChange={(e) => {
                              masks.date.onChange(e);
                              field.onChange(e.target.value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={propostaForm.control}
                  name="salesperson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        Vendedor responsável
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o vendedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingSalespeople ? (
                            <SelectItem value="loading" disabled>Carregando vendedores...</SelectItem>
                          ) : salespeople && salespeople.length > 0 ? (
                            salespeople.map((user: any) => (
                              <SelectItem key={user.id} value={user.name}>
                                {user.name} ({user.role === 'admin' ? 'Admin' : user.role === 'gerente' ? 'Gerente' : 'Vendedor'})
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-salespeople" disabled>Nenhum vendedor encontrado</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={propostaForm.control}
                  name="discountDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição do desconto</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Justificativa do desconto aplicado..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={propostaForm.control}
                  name="budgetFile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        Anexar documento da proposta
                      </FormLabel>
                      <FormControl>
                        <FileUpload
                          multiple={false}
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                          value={field.value ? [field.value] : []}
                          onFilesChange={(files) => field.onChange(files.length > 0 ? files[0] : null)}
                          placeholder="Clique para anexar documento da proposta ou arraste arquivo aqui"
                          data-testid="input-budget-file"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting || deleteOpportunityMutation.isPending}
                  data-testid="button-delete-opportunity"
                  title="Excluir oportunidade"
                  aria-label="Excluir oportunidade"
                  className="text-red-600 bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmitting ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        );

      case "negociacao":
        return (
          <Form {...negociacaoForm}>
            <form onSubmit={negociacaoForm.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold text-gray-900 flex items-center">
                  <Handshake className="h-4 w-4 mr-2" />
                  Informações da Negociação
                </h4>

                <FormField
                  control={negociacaoForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>* Status da negociação</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="aguardando-cliente">Aguardando Cliente</SelectItem>
                          <SelectItem value="em-negociacao">Em Negociação</SelectItem>
                          <SelectItem value="proposta-aceita">Proposta Aceita</SelectItem>
                          <SelectItem value="perdida">Perdida</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={negociacaoForm.control}
                  name="finalValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2" />
                        * Valor final negociado
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={masks.currency.placeholder}
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => {
                            masks.currency.onChange(e);
                            field.onChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={negociacaoForm.control}
                  name="negotiationInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Informações da negociação</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detalhes da negociação, condições especiais..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={negociacaoForm.control}
                  name="contract"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do contrato</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="CONT-001"
                          {...field}
                          onChange={(e) => field.onChange(masks.uppercase(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={negociacaoForm.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da danfe</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="NF-001"
                          {...field}
                          onChange={(e) => field.onChange(masks.uppercase(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={negociacaoForm.control}
                  name="lossReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo da perda (se aplicável)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva o motivo caso a negociação seja perdida..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting || deleteOpportunityMutation.isPending}
                  data-testid="button-delete-opportunity"
                  title="Excluir oportunidade"
                  aria-label="Excluir oportunidade"
                  className="text-red-600 bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmitting ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        );

      case "ganho":
        return (
          <div className="flex justify-end mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        );

      case "perdido":
        return (
          <Form {...perdidoForm}>
            <form onSubmit={perdidoForm.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold text-gray-900 flex items-center">
                  <TriangleAlert className="h-4 w-4 mr-2 text-red-600" />
                  Informações da Oportunidade Perdida
                </h4>

                <FormField
                  control={perdidoForm.control}
                  name="lossReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <TriangleAlert className="h-4 w-4 mr-2" />
                        * Motivo da perda
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Preço alto, prazo inadequado, concorrência..."
                          {...field}
                          data-testid="input-loss-reason"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={perdidoForm.control}
                  name="lossObservation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        * Observação detalhada
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva detalhadamente o que aconteceu, contexto da perda, feedback do cliente, lições aprendidas..."
                          className="min-h-[120px]"
                          {...field}
                          data-testid="textarea-loss-observation"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting || deleteOpportunityMutation.isPending}
                  data-testid="button-delete-opportunity"
                  title="Excluir oportunidade"
                  aria-label="Excluir oportunidade"
                  className="text-red-600 bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isSubmitting ? "Salvando..." : "Salvar Observação"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        );

      default:
        return (
          <div className="py-4">
            <p className="text-gray-600">Esta fase não possui formulário específico.</p>
          </div>
        );
    }
  };

  if (!opportunity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Detalhes da Oportunidade</span>
          </DialogTitle>
          <DialogDescription>
            Empresa: {opportunity.company} • Fase: {opportunity.phase}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Informações Essenciais - Sempre Visíveis */}
          <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Informações Essenciais
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="font-medium text-gray-700">Empresa:</span>
                <span className="ml-2 text-gray-900">{opportunity.company || "Não informado"}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Contato:</span>
                <span className="ml-2 text-gray-900">{opportunity.contact || "Não informado"}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Telefone:</span>
                <span className="ml-2 text-gray-900">{opportunity.phone || "Não informado"}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Temperatura:</span>
                <span className={`ml-2 font-medium ${
                  opportunity.businessTemperature === 'quente' ? 'text-red-600' :
                  opportunity.businessTemperature === 'morno' ? 'text-yellow-600' :
                  opportunity.businessTemperature === 'frio' ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {opportunity.businessTemperature ? 
                    opportunity.businessTemperature.charAt(0).toUpperCase() + opportunity.businessTemperature.slice(1) : 
                    "Não informado"
                  }
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Categoria:</span>
                <span className="ml-2 text-gray-900">{opportunity.needCategory || "Não informado"}</span>
              </div>
              {opportunity.cpf && (
                <div>
                  <span className="font-medium text-gray-700">CPF:</span>
                  <span className="ml-2 text-gray-900">{opportunity.cpf}</span>
                </div>
              )}
              {opportunity.cnpj && (
                <div>
                  <span className="font-medium text-gray-700">CNPJ:</span>
                  <span className="ml-2 text-gray-900">{opportunity.cnpj}</span>
                </div>
              )}
              {opportunity.proposalOrigin && (
                <div>
                  <span className="font-medium text-gray-700">Origem:</span>
                  <span className="ml-2 text-gray-900">{opportunity.proposalOrigin}</span>
                </div>
              )}
              {opportunity.documents && opportunity.documents.length > 0 && (
                <div className="md:col-span-3">
                  <span className="font-medium text-gray-700">Documentos ({opportunity.documents.length}):</span>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {opportunity.documents.map((doc, index) => {
                      // Parse document if it's a JSON string
                      let parsedDoc;
                      try {
                        parsedDoc = typeof doc === 'string' ? JSON.parse(doc) : doc;
                      } catch {
                        // If parsing fails, treat as legacy format
                        parsedDoc = { name: `Documento ${index + 1}`, url: doc };
                      }

                      return (
                        <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded border">
                          <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <a
                              href={parsedDoc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline text-sm block truncate"
                              title={`Abrir ${parsedDoc.name}`}
                            >
                              {parsedDoc.name || `Documento ${index + 1}`}
                            </a>
                            {parsedDoc.size && (
                              <span className="text-xs text-gray-500">
                                ({(parsedDoc.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}</div>
            </div>

            {opportunity.clientNeeds && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <span className="font-medium text-gray-700">Necessidades:</span>
                <p className="mt-1 text-gray-900 text-sm">{opportunity.clientNeeds}</p>
              </div>
            )}
          </div>

          {/* Histórico de Fases - Sempre Visível */}
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Histórico de Fases Anteriores
            </h3>

            <div className="space-y-4">
              {/* Prospecção */}
              {(opportunity.opportunityNumber || opportunity.salesperson || opportunity.requiresVisit !== undefined) && (
                <div className="border-l-4 border-orange-400 pl-4">
                  <h4 className="font-semibold text-orange-700 mb-2">📈 Prospecção</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {opportunity.opportunityNumber && (
                      <div>
                        <span className="font-medium text-gray-700">Número do orçamento:</span>
                        <span className="ml-2 text-gray-900">{opportunity.opportunityNumber}</span>
                      </div>
                    )}
                    {opportunity.salesperson && (
                      <div>
                        <span className="font-medium text-gray-700">Vendedor responsável:</span>
                        <span className="ml-2 text-gray-900">{opportunity.salesperson}</span>
                      </div>
                    )}
                    {opportunity.requiresVisit !== undefined && (
                      <div>
                        <span className="font-medium text-gray-700">Requer visita:</span>
                        <span className="ml-2 text-gray-900">{opportunity.requiresVisit ? 'Sim' : 'Não'}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Em Atendimento */}
              {opportunity.statement && (
                <div className="border-l-4 border-purple-400 pl-4">
                  <h4 className="font-semibold text-purple-700 mb-2">🎧 Em Atendimento</h4>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Declaração/Observações:</span>
                    <p className="mt-1 text-gray-900 bg-white p-2 rounded border">{opportunity.statement}</p>
                  </div>
                </div>
              )}

              {/* Visita Técnica */}
              {(opportunity.visitSchedule || opportunity.visitDate || opportunity.visitDescription || (opportunity.visitPhotos && opportunity.visitPhotos.length > 0)) && (
                <div className="border-l-4 border-blue-400 pl-4">
                  <h4 className="font-semibold text-blue-700 mb-2">🔧 Visita Técnica</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {opportunity.visitSchedule && (
                      <div>
                        <span className="font-medium text-gray-700">Data agendada:</span>
                        <span className="ml-2 text-gray-900">{opportunity.visitSchedule}</span>
                      </div>
                    )}
                    {opportunity.visitDate && (
                      <div>
                        <span className="font-medium text-gray-700">Data realizada:</span>
                        <span className="ml-2 text-gray-900">{opportunity.visitDate}</span>
                      </div>
                    )}
                    {opportunity.visitDescription && (
                      <div className="md:col-span-2">
                        <span className="font-medium text-gray-700">Descrição:</span>
                        <p className="mt-1 text-gray-900 bg-white p-2 rounded border">{opportunity.visitDescription}</p>
                      </div>
                    )}
                    {opportunity.visitPhotos && opportunity.visitPhotos.length > 0 && (
                      <div className="md:col-span-2">
                        <span className="font-medium text-gray-700">Fotos da visita:</span>
                        <div className="ml-2 space-y-1">
                          {opportunity.visitPhotos.map((photo, index) => {
                            // Parse photo if it's a JSON string
                            let parsedPhoto;
                            try {
                              parsedPhoto = typeof photo === 'string' ? JSON.parse(photo) : photo;
                            } catch {
                              // If parsing fails, treat as legacy format
                              parsedPhoto = { name: `Foto ${index + 1}`, url: photo };
                            }

                            return (
                              <div key={index} className="flex items-center space-x-2">
                                <Image className="h-4 w-4 text-gray-500" />
                                <a
                                  href={parsedPhoto.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                                  title={`Visualizar ${parsedPhoto.name}`}
                                >
                                  {parsedPhoto.name || `Foto ${index + 1}`}
                                </a>
                                {parsedPhoto.size && (
                                  <span className="text-xs text-gray-500">
                                    ({(parsedPhoto.size / 1024 / 1024).toFixed(2)} MB)
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}</div>
                  </div>
                )}

                {/* Proposta */}
                {(opportunity.budgetNumber || opportunity.budget || opportunity.validityDate || opportunity.discount) && (
                  <>
                    <div className="border-l-4 border-pink-400 pl-4">
                      <h4 className="font-semibold text-pink-700 mb-2">📄 Proposta</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {opportunity.budgetNumber && (
                          <div>
                            <span className="font-medium text-gray-700">Número do orçamento:</span>
                            <span className="ml-2 text-gray-900">{opportunity.budgetNumber}</span>
                          </div>
                        )}
                        {opportunity.budget && (
                          <div>
                            <span className="font-medium text-gray-700">Valor do orçamento:</span>
                            <span className="ml-2 text-gray-900 font-medium text-green-600">
                              R$ {parseFloat(opportunity.budget.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {opportunity.validityDate && (
                          <div>
                            <span className="font-medium text-gray-700">Data de validade:</span>
                            <span className="ml-2 text-gray-900">
                              {new Date(opportunity.validityDate).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        )}
                        {opportunity.discount && (
                          <div>
                            <span className="font-medium text-gray-700">Desconto:</span>
                            <span className="ml-2 text-gray-900">{opportunity.discount}%</span>
                          </div>
                        )}
                        {opportunity.discountDescription && (
                          <div className="md:col-span-2">
                            <span className="font-medium text-gray-700">Descrição do desconto:</span>
                            <p className="mt-1 text-gray-900 bg-white p-2 rounded border">{opportunity.discountDescription}</p>
                          </div>
                        )}
                        {/* Show proposal documents - only documents added during proposal phase */}
                        {(() => {
                          if (!opportunity.documents || opportunity.documents.length === 0) return null;
                          
                          // Filter documents to show only those added during proposal phase
                          // We'll identify proposal documents by checking if they have documentType: 'proposal' 
                          // or if they were added after the opportunity reached proposal phase
                          const proposalDocs = opportunity.documents.filter((doc) => {
                            let parsedDoc;
                            try {
                              parsedDoc = typeof doc === 'string' ? JSON.parse(doc) : doc;
                            } catch {
                              return false; // Skip malformed documents
                            }
                            
                            // Check if document was marked as proposal document or has proposal metadata
                            return parsedDoc.documentType === 'proposal' || 
                                   parsedDoc.phaseAdded === 'proposta' ||
                                   (parsedDoc.name && parsedDoc.name.toLowerCase().includes('orçamento')) ||
                                   (parsedDoc.name && parsedDoc.name.toLowerCase().includes('orcamento')) ||
                                   (parsedDoc.name && parsedDoc.name.toLowerCase().includes('proposta'));
                          });

                          if (proposalDocs.length === 0) return null;

                          return (
                            <div className="md:col-span-2">
                              <span className="font-medium text-gray-700">Documentos da proposta:</span>
                              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                {proposalDocs.map((doc, index) => {
                                  let parsedDoc;
                                  try {
                                    parsedDoc = typeof doc === 'string' ? JSON.parse(doc) : doc;
                                  } catch {
                                    parsedDoc = { name: `Documento ${index + 1}`, url: doc };
                                  }

                                  return (
                                    <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded border">
                                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <a
                                          href={parsedDoc.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:text-blue-800 hover:underline text-sm block truncate"
                                          title={`Abrir ${parsedDoc.name}`}
                                        >
                                          {parsedDoc.name || `Documento ${index + 1}`}
                                        </a>
                                        {parsedDoc.size && (
                                          <span className="text-xs text-gray-500">
                                            ({(parsedDoc.size / 1024 / 1024).toFixed(2)} MB)
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                )}

                {/* Negociação */}
                {(opportunity.status || opportunity.finalValue || opportunity.negotiationInfo || opportunity.contract || opportunity.invoiceNumber) && (
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-blue-700 mb-2">🤝 Negociação</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {opportunity.status && (
                        <div>
                          <span className="font-medium text-gray-700">Status:</span>
                          <span className="ml-2 text-gray-900">{opportunity.status}</span>
                        </div>
                      )}
                      {opportunity.finalValue && (
                        <div>
                          <span className="font-medium text-gray-700">Valor final:</span>
                          <span className="ml-2 text-gray-900 font-medium text-green-600">
                            R$ {parseFloat(opportunity.finalValue.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {opportunity.contract && (
                        <div>
                          <span className="font-medium text-gray-700">Contrato:</span>
                          <span className="ml-2 text-gray-900">{opportunity.contract}</span>
                        </div>
                      )}
                      {opportunity.invoiceNumber && (
                        <div>
                          <span className="font-medium text-gray-700">Número da danfe:</span>
                          <span className="ml-2 text-gray-900">{opportunity.invoiceNumber}</span>
                        </div>
                      )}
                      {opportunity.negotiationInfo && (
                        <div className="md:col-span-2">
                          <span className="font-medium text-gray-700">Informações da negociação:</span>
                          <p className="mt-1 text-gray-900 bg-white p-2 rounded border">{opportunity.negotiationInfo}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Perdido */}
                {(opportunity.lossReason || opportunity.lossObservation) && (
                  <div className="border-l-4 border-red-400 pl-4">
                    <h4 className="font-semibold text-red-700 mb-2">❌ Oportunidade Perdida</h4>
                    <div className="space-y-2 text-sm">
                      {opportunity.lossReason && (
                        <div>
                          <span className="font-medium text-gray-700">Motivo da perda:</span>
                          <span className="ml-2 text-gray-900">{opportunity.lossReason}</span>
                        </div>
                      )}
                      {opportunity.lossObservation && (
                        <div>
                          <span className="font-medium text-gray-700">Observação detalhada:</span>
                          <p className="mt-1 text-gray-900 bg-white p-2 rounded border">{opportunity.lossObservation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mensagem se não houver histórico */}
                {!opportunity.opportunityNumber && !opportunity.salesperson && !opportunity.statement && 
                 !opportunity.visitSchedule && !opportunity.visitDate && !opportunity.budgetNumber && 
                 !opportunity.budget && !opportunity.status && !opportunity.finalValue && 
                 !opportunity.lossReason && (
                  <div className="text-center py-4 text-gray-500">
                    <p>Nenhum dado de fases anteriores encontrado.</p>
                    <p className="text-sm">As informações aparecerão aqui conforme o card avança pelas fases.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Formulário específico da fase */}
            {renderPhaseForm()}
        </DialogContent>
      </Dialog>
    );
  }