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
import { Calendar, FileText, Handshake, MapPin, DollarSign, Upload, User, X, Trash2, TriangleAlert, Image, Edit, Save, XCircle } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useReportsSync } from "@/hooks/useReportsSync";
import { useAuth } from "@/hooks/useAuth";
import { useKanbanStore } from "@/hooks/useKanbanStore";
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
  budgetNumber: z.string().min(1, "Número do orçamento é obrigatório"),
  budget: z.string().min(1, "Valor da proposta é obrigatório"),
  notes: z.string().optional(),
});

// Schema para o formulário de negociação
const negociacaoSchema = z.object({
  status: z.string().optional(),
  finalValue: z.string().min(1, "Valor final negociado é obrigatório"),
  contract: z.string().optional(),
  invoiceNumber: z.string().optional(),
});

// Schema para o formulário de perdido
const perdidoSchema = z.object({
  lossReason: z.string().trim().min(1, "Motivo da perda é obrigatório"),
  lossObservation: z.string().trim().min(1, "Observação é obrigatória"),
});

// Schema para o formulário de informações essenciais
const essentialInfoSchema = z.object({
  contact: z.string().min(1, "Nome do contato é obrigatório"),
  company: z.string().min(1, "Nome da empresa é obrigatório"),
  phone: z.string().min(1, "Telefone é obrigatório"),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  proposalOrigin: z.string().optional(),
  businessTemperature: z.string().optional(),
  needCategory: z.string().optional(),
  clientNeeds: z.string().optional(),
});

type ProspeccaoFormData = z.infer<typeof prospeccaoSchema>;
type EmAtendimentoFormData = z.infer<typeof emAtendimentoSchema>;
type VisitaTecnicaFormData = z.infer<typeof visitaTecnicaSchema>;
type PropostaFormData = z.infer<typeof propostaSchema>;
type NegociacaoFormData = z.infer<typeof negociacaoSchema>;
type PerdidoFormData = z.infer<typeof perdidoSchema>;
type EssentialInfoFormData = z.infer<typeof essentialInfoSchema>;

export default function OpportunityDetailsModal({
  opportunity,
  open,
  onOpenChange,
}: OpportunityDetailsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { invalidateAllData } = useReportsSync();
  const { user } = useAuth();
  
  // CORREÇÃO: Usar o hook corretamente para obter as funções do store
  const { updateOpportunity, removeOpportunity } = useKanbanStore();

  // Funções auxiliares para formatação
  const formatBudgetForDisplay = (value: string | number | null | undefined): string => {
    if (!value) return '';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '';
    return numValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    });
  };

  const formatDiscountForDisplay = (value: string | number | null | undefined): string => {
    if (!value) return '';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '';
    return numValue.toFixed(2).replace('.', ',') + '%';
  };

  const formatDateForDisplay = (value: string | null | undefined): string => {
    if (!value) return '';
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };

  const prospeccaoForm = useForm<ProspeccaoFormData>({
    resolver: zodResolver(prospeccaoSchema),
    defaultValues: {
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
      visitDate: opportunity?.visitDate || "",
      visitDescription: opportunity?.visitDescription || "",
      visitPhotos: Array.isArray(opportunity?.visitPhotos) ? opportunity!.visitPhotos.map(photo => 
        typeof photo === 'string' ? { id: '', name: photo, size: 0, type: '', url: photo } : photo
      ) : [],
    },
  });

  const propostaForm = useForm<PropostaFormData>({
    resolver: zodResolver(propostaSchema),
    defaultValues: {
      budgetNumber: opportunity?.budgetNumber || opportunity?.opportunityNumber || "",
      budget: opportunity?.budget ? formatBudgetForDisplay(opportunity.budget) : "",
      notes: opportunity?.notes || "",
    },
  });

  const negociacaoForm = useForm<NegociacaoFormData>({
    resolver: zodResolver(negociacaoSchema),
    defaultValues: {
      status: opportunity?.status || "",
      finalValue: opportunity?.finalValue ? formatBudgetForDisplay(opportunity.finalValue) : "",
      contract: opportunity?.contract || "",
      invoiceNumber: opportunity?.invoiceNumber || "",
    },
  });

  const perdidoForm = useForm<PerdidoFormData>({
    resolver: zodResolver(perdidoSchema),
    defaultValues: {
      lossReason: opportunity?.lossReason || "",
      lossObservation: opportunity?.lossObservation || "",
    },
  });

  const essentialInfoForm = useForm<EssentialInfoFormData>({
    resolver: zodResolver(essentialInfoSchema),
    defaultValues: {
      contact: opportunity?.contact || "",
      company: opportunity?.company || "",
      phone: opportunity?.phone || "",
      cpf: opportunity?.cpf || "",
      cnpj: opportunity?.cnpj || "",
      proposalOrigin: opportunity?.proposalOrigin || "",
      businessTemperature: opportunity?.businessTemperature || "",
      needCategory: opportunity?.needCategory || "",
      clientNeeds: opportunity?.clientNeeds || "",
    },
  });

  // Resetar todos os formulários quando o modal abrir ou a oportunidade mudar
  useEffect(() => {
    if (open && opportunity) {
      // Resetar todos os formulários com os dados da oportunidade atual
      prospeccaoForm.reset({
        requiresVisit: opportunity.requiresVisit || false,
      });

      emAtendimentoForm.reset({
        statement: opportunity.statement || "",
      });

      visitaTecnicaForm.reset({
        visitSchedule: opportunity.visitSchedule || "",
        visitDate: opportunity.visitDate || "",
        visitPhotos: Array.isArray(opportunity.visitPhotos) ? opportunity.visitPhotos.map(photo => 
          typeof photo === 'string' ? { id: '', name: photo, size: 0, type: '', url: photo } : photo
        ) : [],
      });

      propostaForm.reset({
        budgetNumber: opportunity.budgetNumber || opportunity.opportunityNumber || "",
        budget: opportunity.budget ? formatBudgetForDisplay(opportunity.budget) : "",
        notes: opportunity.notes || "",
      });

      negociacaoForm.reset({
        status: opportunity.status || "",
        finalValue: formatBudgetForDisplay(opportunity.finalValue),
        contract: opportunity.contract || "",
        invoiceNumber: opportunity.invoiceNumber || "",
      });

      perdidoForm.reset({
        lossReason: opportunity.lossReason || "",
        lossObservation: opportunity.lossObservation || "",
      });

      essentialInfoForm.reset({
        contact: opportunity.contact || "",
        company: opportunity.company || "",
        phone: opportunity.phone || "",
        cpf: opportunity.cpf || "",
        cnpj: opportunity.cnpj || "",
        proposalOrigin: opportunity.proposalOrigin || "",
        businessTemperature: opportunity.businessTemperature || "",
        needCategory: opportunity.needCategory || "",
        clientNeeds: opportunity.clientNeeds || "",
      });
    } else if (open && !opportunity) {
      // Limpar todos os formulários quando abrir sem oportunidade
      prospeccaoForm.reset({
        opportunityNumber: "",
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
        budgetNumber: "",
        budget: "",
        notes: "",
      });

      negociacaoForm.reset({
        status: "",
        contract: "",
        invoiceNumber: "",
      });

      perdidoForm.reset({
        lossReason: "",
        lossObservation: "",
      });
    }
  }, [open, opportunity, prospeccaoForm, emAtendimentoForm, visitaTecnicaForm, propostaForm, negociacaoForm, perdidoForm]);

  // Função para renderizar documentos da proposta
  const renderProposalDocuments = () => {
    if (!opportunity || !opportunity.documents || opportunity.documents.length === 0) return null;
    
    // Filter documents to show only those added during proposal phase
    // We'll identify proposal documents by checking if they have documentType: 'proposal' 
    // or if they were added after the opportunity reached proposal phase
    const proposalDocs = opportunity.documents.filter((doc) => {
      let parsedDoc: any;
      try {
        parsedDoc = typeof doc === 'string' ? JSON.parse(doc) : doc;
      } catch {
        return false; // Skip malformed documents
      }
      
      // Check if document was marked as proposal document or has proposal metadata
      return parsedDoc.documentType === 'proposal' || 
             parsedDoc.phaseAdded === 'proposta' ||
             (parsedDoc.name && parsedDoc.name.toLowerCase().includes('orcamento')) ||
             (parsedDoc.name && parsedDoc.name.toLowerCase().includes('proposta'));
    });

    if (proposalDocs.length === 0) return null;

    return (
      <div className="md:col-span-2">
        <span className="font-medium text-gray-700 dark:text-gray-300">Documentos da proposta:</span>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          {proposalDocs.map((doc, index) => {
            let parsedDoc: any;
            try {
              parsedDoc = typeof doc === 'string' ? JSON.parse(doc) : doc;
            } catch {
              parsedDoc = { name: `Documento ${index + 1}`, url: doc };
            }

            return (
              <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded border dark:border-gray-600">
                <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <a
                    href={parsedDoc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-sm block truncate"
                    title={`Abrir ${parsedDoc.name}`}
                    download={parsedDoc.name}
                  >
                    {parsedDoc.name || `Documento ${index + 1}`}
                  </a>
                  {parsedDoc.size && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
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
  };

  const updateOpportunityMutation = useMutation({
    mutationFn: (data: any & { id: string }) =>
      apiRequest("PATCH", `/api/opportunities/${data.id}`, data),
    onSuccess: async (updatedOpportunity) => {
      // CORREÇÃO: Invalidação mais agressiva e sincronização com store
      await queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      await queryClient.refetchQueries({ queryKey: ["/api/opportunities"] });
      
      // CORREÇÃO: Usar as funções do hook diretamente
      if (updatedOpportunity && updatedOpportunity.id) {
        updateOpportunity(updatedOpportunity.id, updatedOpportunity);
      }
      
      // Também invalidar outros dados relacionados
      invalidateAllData();
      
      toast({
        title: "Sucesso",
        description: "Oportunidade atualizada com sucesso!",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('❌ Modal: Erro na mutation updateOpportunity:', error);
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
    onSuccess: async (updatedOpportunity) => {
      // CORREÇÃO: Invalidação mais agressiva e sincronização com store
      await queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      await queryClient.refetchQueries({ queryKey: ["/api/opportunities"] });
      
      // CORREÇÃO: Usar as funções do hook diretamente
      if (updatedOpportunity && updatedOpportunity.id) {
        updateOpportunity(updatedOpportunity.id, updatedOpportunity);
      }
      
      invalidateAllData(); // Sincroniza dashboard e relatórios
      toast({
        title: "Sucesso",
        description: "Oportunidade movida para a próxima fase!",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('❌ Modal: Erro na mutation moveToNextPhase:', error);
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
    mutationFn: (opportunityId: string) => {
      console.log(`🗑️  Modal: Iniciando exclusão da oportunidade ${opportunityId}`);
      return apiRequest("DELETE", `/api/opportunities/${opportunityId}`);
    },
    onSuccess: async (_, opportunityId) => {
      console.log(`✅ Modal: Exclusão bem-sucedida para oportunidade ${opportunityId}`);
      
      // CORREÇÃO: Invalidação mais agressiva e sincronização com store
      await queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      await queryClient.refetchQueries({ queryKey: ["/api/opportunities"] });
      
      // CORREÇÃO: Usar as funções do hook diretamente
      console.log('🗑️ Modal: Removendo do store Zustand:', opportunityId);
      removeOpportunity(opportunityId);
      
      invalidateAllData(); // Sincroniza dashboard e relatórios
      toast({
        title: "Sucesso",
        description: "Oportunidade excluída com sucesso!",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error(`❌ Modal: Erro na exclusão:`, error);
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao excluir oportunidade.";
      console.error(`❌ Modal: Mensagem de erro:`, errorMessage);
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

  // Check if user can edit/delete imported cards
  const canEditImportedCard = (opportunity: Opportunity): boolean => {
    // Allow all users to edit imported cards
    return true;
  };

  const canDeleteImportedCard = (opportunity: Opportunity): boolean => {
    // Allow all users to delete imported cards
    return true;
  };

  const handleDelete = () => {
    if (!opportunity) return;

    // Verificação de propriedade: Apenas o criador pode excluir
    if (user && opportunity.createdBy && String(user.id) !== String(opportunity.createdBy)) {
      toast({
        title: "Acesso negado",
        description: "Apenas o criador do card tem autonomia para excluí-lo.",
        variant: "destructive",
      });
      return;
    }

    // Check permissions for imported cards
    if (opportunity.isImported && !canDeleteImportedCard(opportunity)) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para excluir cards importados. Apenas gerentes e administradores podem excluir cards importados.",
        variant: "destructive",
      });
      return;
    }

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

    // Check permissions for imported cards
    if (opportunity.isImported && !canEditImportedCard(opportunity)) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para editar este card importado. Apenas gerentes, administradores ou o vendedor responsável podem editar cards importados.",
        variant: "destructive",
      });
      return;
    }

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
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Informações de Prospecção
                </h4>

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
                  disabled={isSubmitting || deleteOpportunityMutation.isPending || (opportunity?.isImported === true && !canDeleteImportedCard(opportunity))}
                  data-testid="button-delete-opportunity"
                  title={opportunity?.isImported && !canDeleteImportedCard(opportunity) ? "Você não tem permissão para excluir cards importados" : "Excluir oportunidade"}
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
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center">
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
                  disabled={isSubmitting || deleteOpportunityMutation.isPending || (opportunity?.isImported === true && !canDeleteImportedCard(opportunity))}
                  data-testid="button-delete-opportunity"
                  title={opportunity?.isImported && !canDeleteImportedCard(opportunity) ? "Você não tem permissão para excluir cards importados" : "Excluir oportunidade"}
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
                    disabled={isSubmitting || (opportunity?.isImported === true && !canEditImportedCard(opportunity))}
                    className="bg-blue-600 hover:bg-blue-700"
                    title={opportunity?.isImported && !canEditImportedCard(opportunity) ? "Você não tem permissão para editar cards importados" : undefined}
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
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <MapPin className="h-4 w-4 mr-2" />
                  Informações da Visita Técnica
                </h4>

                <FormField
                  control={visitaTecnicaForm.control as any}
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
                  control={visitaTecnicaForm.control as any}
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
                  control={visitaTecnicaForm.control as any}
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
                  control={visitaTecnicaForm.control as any}
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
                          placeholder="Clique para adicionar fotos ou arraste arquivos aqui (ou Ctrl+V)"
                          enableGlobalPaste={open}
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
                  disabled={isSubmitting || deleteOpportunityMutation.isPending || (opportunity?.isImported === true && !canDeleteImportedCard(opportunity))}
                  data-testid="button-delete-opportunity"
                  title={opportunity?.isImported && !canDeleteImportedCard(opportunity) ? "Você não tem permissão para excluir cards importados" : "Excluir oportunidade"}
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
                    disabled={isSubmitting || (opportunity?.isImported === true && !canEditImportedCard(opportunity))}
                    className="bg-blue-600 hover:bg-blue-700"
                    title={opportunity?.isImported && !canEditImportedCard(opportunity) ? "Você não tem permissão para editar cards importados" : undefined}
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
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Informações da Proposta
                </h4>

                <FormField
                  control={propostaForm.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor da Proposta *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                          <Input 
                            className="pl-9"
                            placeholder="0,00"
                            {...field} 
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              const formattedValue = (Number(value) / 100).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              });
                              field.onChange(formattedValue);
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={propostaForm.control as any}
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
                            disabled={isAutoFilled === true}
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
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observação (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Digite uma observação sobre a proposta..."
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
                  disabled={isSubmitting || deleteOpportunityMutation.isPending || ((opportunity?.isImported ?? false) && !canDeleteImportedCard(opportunity))}
                  data-testid="button-delete-opportunity"
                  title={opportunity?.isImported && !canDeleteImportedCard(opportunity) ? "Você não tem permissão para excluir cards importados" : "Excluir oportunidade"}
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
                    disabled={isSubmitting || ((opportunity?.isImported ?? false) && !canEditImportedCard(opportunity))}
                    className="bg-blue-600 hover:bg-blue-700"
                    title={opportunity?.isImported && !canEditImportedCard(opportunity) ? "Você não tem permissão para editar cards importados" : undefined}
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
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <Handshake className="h-4 w-4 mr-2" />
                  Informações da Negociação
                </h4>

                <FormField
                  control={negociacaoForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status da negociação</FormLabel>
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
                      <FormLabel>Valor final negociado *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                          <Input 
                            className="pl-9"
                            placeholder="0,00"
                            {...field} 
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              const formattedValue = (Number(value) / 100).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              });
                              field.onChange(formattedValue);
                            }}
                          />
                        </div>
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


              </div>

              <DialogFooter className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting || deleteOpportunityMutation.isPending || ((opportunity?.isImported ?? false) && !canDeleteImportedCard(opportunity))}
                  data-testid="button-delete-opportunity"
                  title={opportunity?.isImported && !canDeleteImportedCard(opportunity) ? "Você não tem permissão para excluir cards importados" : "Excluir oportunidade"}
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
                    disabled={isSubmitting || ((opportunity?.isImported ?? false) && !canEditImportedCard(opportunity))}
                    className="bg-blue-600 hover:bg-blue-700"
                    title={opportunity?.isImported && !canEditImportedCard(opportunity) ? "Você não tem permissão para editar cards importados" : undefined}
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
          <div className="space-y-6">
            {/* Informações Essenciais - Sempre Visíveis */}
            <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Informações Essenciais
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingPhase(editingPhase === 'essential-info' ? null : 'essential-info')}
                  className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                  title="Editar informações essenciais"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              </div>

            {editingPhase === 'essential-info' ? (
              <Form {...essentialInfoForm}>
                <form onSubmit={essentialInfoForm.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={essentialInfoForm.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Empresa *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={essentialInfoForm.control}
                      name="contact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contato *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={essentialInfoForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Criado por</Label>
                      <Input 
                        value={opportunity?.createdByName || "Sistema"} 
                        readOnly 
                        className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-not-allowed mt-2"
                      />
                    </div>
                    <FormField
                      control={essentialInfoForm.control}
                      name="businessTemperature"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Temperatura</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a temperatura" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="frio">Frio</SelectItem>
                              <SelectItem value="morno">Morno</SelectItem>
                              <SelectItem value="quente">Quente</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={essentialInfoForm.control}
                      name="needCategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a categoria" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Andaimes">Andaimes</SelectItem>
                              <SelectItem value="Escoras">Escoras</SelectItem>
                              <SelectItem value="Painel de Escoramento">Painel de Escoramento</SelectItem>
                              <SelectItem value="Ferramentas">Ferramentas</SelectItem>
                              <SelectItem value="Plataformas Elevatórias">Plataformas Elevatórias</SelectItem>
                              <SelectItem value="Imóveis">Imóveis</SelectItem>
                              <SelectItem value="Veículos">Veículos</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={essentialInfoForm.control}
                      name="proposalOrigin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Origem da Proposta</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a origem" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Redes Sociais">Redes Sociais</SelectItem>
                              <SelectItem value="Indicação">Indicação</SelectItem>
                              <SelectItem value="Busca ativa">Busca ativa</SelectItem>
                              <SelectItem value="Visita em Obra">Visita em Obra</SelectItem>
                              <SelectItem value="Indicação de Diretoria">Indicação de Diretoria</SelectItem>
                              <SelectItem value="SDR">SDR</SelectItem>
                              <SelectItem value="Renovação">Renovação</SelectItem>
                              <SelectItem value="Whatsapp">Whatsapp</SelectItem>
                              <SelectItem value="Dropdesk">Dropdesk</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={essentialInfoForm.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="000.000.000-00" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={essentialInfoForm.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="00.000.000/0000-00" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={essentialInfoForm.control}
                    name="clientNeeds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Necessidades do Cliente</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingPhase(null)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit">
                      Salvar
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Empresa:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.company || "Não informado"}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Contato:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.contact || "Não informado"}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Telefone:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.phone || "Não informado"}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Criado por:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.createdByName || "Sistema"}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Temperatura:</span>
                  <span className={`ml-2 font-medium ${
                    opportunity.businessTemperature === 'quente' ? 'text-red-600 dark:text-red-400' :
                    opportunity.businessTemperature === 'morno' ? 'text-yellow-600 dark:text-yellow-400' :
                    opportunity.businessTemperature === 'frio' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {opportunity.businessTemperature ? 
                      opportunity.businessTemperature.charAt(0).toUpperCase() + opportunity.businessTemperature.slice(1) : 
                      "Não informado"
                    }
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Categoria:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.needCategory || "Não informado"}</span>
                </div>
                {opportunity.cpf && (
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">CPF:</span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.cpf}</span>
                  </div>
                )}
                {opportunity.cnpj && (
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">CNPJ:</span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.cnpj}</span>
                  </div>
                )}
                {opportunity.proposalOrigin && (
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Origem:</span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.proposalOrigin}</span>
                  </div>
                )}
                {opportunity.clientNeeds && (
                  <div className="md:col-span-3">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Necessidades do Cliente:</span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.clientNeeds}</span>
                  </div>
                )}
                {opportunity.documents && opportunity.documents.length > 0 && (
                  <div className="md:col-span-3">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Documentos ({opportunity.documents.length}):</span>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {opportunity.documents.map((doc, index) => {
                        // Parse document if it's a JSON string
                        let parsedDoc: any;
                        try {
                          parsedDoc = typeof doc === 'string' ? JSON.parse(doc) : doc;
                        } catch {
                          // If parsing fails, treat as legacy format
                          parsedDoc = { name: `Documento ${index + 1}`, url: doc };
                        }

                        return (
                          <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded border dark:border-gray-600">
                            <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <a
                                href={parsedDoc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-sm block truncate"
                                title={`Abrir ${parsedDoc.name}`}
                                download={parsedDoc.name}
                              >
                                {parsedDoc.name || `Documento ${index + 1}`}
                              </a>
                              {parsedDoc.size && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  ({(parsedDoc.size / 1024 / 1024).toFixed(2)} MB)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Histórico de Fases - Sempre Visível */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Histórico de Fases Anteriores
            </h3>

            <div className="space-y-4">
              {/* Prospecção */}
              {(opportunity.requiresVisit !== undefined) && (
                <div className="border-l-4 border-orange-400 pl-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-orange-700">📈 Prospecção</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingPhase(editingPhase === 'prospeccao' ? null : 'prospeccao')}
                      className="h-6 w-6 p-0 text-orange-600 hover:text-orange-800 hover:bg-orange-50"
                      title="Editar informações da fase de Prospecção"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                  {editingPhase === 'prospeccao' ? (
                    <Form {...prospeccaoForm}>
                      <form onSubmit={prospeccaoForm.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                          control={prospeccaoForm.control}
                          name="requiresVisit"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={field.onChange}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                Requer visita técnica
                              </FormLabel>
                            </FormItem>
                          )}
                        />

                        <div className="flex space-x-2 pt-4">
                          <Button type="submit" size="sm" disabled={isSubmitting}>
                            <Save className="h-3 w-3 mr-1" />
                            Salvar
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setEditingPhase(null)}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    </Form>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {opportunity.requiresVisit !== undefined && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Requer visita:</span>
                          <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.requiresVisit ? 'Sim' : 'Não'}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Em Atendimento */}
              {opportunity.statement && (
                <div className="border-l-4 border-purple-400 pl-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-purple-700">🎧 Em Atendimento</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingPhase(editingPhase === 'em-atendimento' ? null : 'em-atendimento')}
                      className="h-6 w-6 p-0 text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                      title="Editar informações da fase de Em Atendimento"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                  {editingPhase === 'em-atendimento' ? (
                    <Form {...emAtendimentoForm}>
                      <form onSubmit={emAtendimentoForm.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                          control={emAtendimentoForm.control}
                          name="statement"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Declaração/Observações</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Descreva as observações do atendimento..."
                                  className="min-h-[100px]"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex space-x-2 pt-4">
                          <Button type="submit" size="sm" disabled={isSubmitting}>
                            <Save className="h-3 w-3 mr-1" />
                            Salvar
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setEditingPhase(null)}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    </Form>
                  ) : (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Declaração/Observações:</span>
                      <p className="mt-1 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 p-2 rounded border dark:border-gray-600">{opportunity.statement}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Visita Técnica */}
              {(opportunity.visitSchedule || opportunity.visitDate || opportunity.visitDescription || (opportunity.visitPhotos && opportunity.visitPhotos.length > 0)) && (
                <div className="border-l-4 border-blue-400 pl-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-blue-700">🔧 Visita Técnica</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingPhase(editingPhase === 'visita-tecnica' ? null : 'visita-tecnica')}
                      className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      title="Editar informações da fase de Visita Técnica"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                  {editingPhase === 'visita-tecnica' ? (
                    <Form {...visitaTecnicaForm}>
                      <form onSubmit={visitaTecnicaForm.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                          control={visitaTecnicaForm.control}
                          name="visitSchedule"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data de agendamento da visita *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="date"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={visitaTecnicaForm.control}
                          name="visitDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data de realização da visita</FormLabel>
                              <FormControl>
                                <Input 
                                  type="date"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={visitaTecnicaForm.control}
                          name="visitDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Descrição da visita</FormLabel>
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

                        <div className="flex space-x-2 pt-4">
                          <Button type="submit" size="sm" disabled={isSubmitting}>
                            <Save className="h-3 w-3 mr-1" />
                            Salvar
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setEditingPhase(null)}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    </Form>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {opportunity.visitSchedule && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Data agendada:</span>
                          <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.visitSchedule}</span>
                        </div>
                      )}
                      {opportunity.visitDate && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Data realizada:</span>
                          <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.visitDate}</span>
                        </div>
                      )}
                      {opportunity.visitDescription && (
                        <div className="md:col-span-2">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Descrição:</span>
                          <p className="mt-1 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 p-2 rounded border dark:border-gray-600">{opportunity.visitDescription}</p>
                        </div>
                      )}
                      {opportunity.visitPhotos && opportunity.visitPhotos.length > 0 && (
                        <div className="md:col-span-2">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Fotos da visita:</span>
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
                      )}
                    </div>
                  )}
                  </div>
                )}

                {/* Proposta */}
                {opportunity.budgetNumber && (
                  <>
                    <div className="border-l-4 border-pink-400 pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-pink-700">📄 Proposta</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPhase(editingPhase === 'proposta' ? null : 'proposta')}
                          className="h-6 w-6 p-0 text-pink-600 hover:text-pink-800 hover:bg-pink-50"
                          title="Editar informações da fase de Proposta"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                      {editingPhase === 'proposta' ? (
                        <Form {...propostaForm}>
                          <form onSubmit={propostaForm.handleSubmit(handleSubmit)} className="space-y-4">
                            <FormField
                              control={propostaForm.control}
                              name="budgetNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Número do orçamento *</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="Digite o número do orçamento"
                                      {...field} 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={propostaForm.control}
                              name="budget"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Valor da Proposta *</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                                      <Input 
                                        className="pl-9"
                                        placeholder="0,00"
                                        {...field} 
                                        onChange={(e) => {
                                          const value = e.target.value.replace(/\D/g, "");
                                          const formattedValue = (Number(value) / 100).toLocaleString("pt-BR", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          });
                                          field.onChange(formattedValue);
                                        }}
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={propostaForm.control}
                              name="notes"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Observação (Opcional)</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="Digite uma observação sobre a proposta..."
                                      className="min-h-[100px]"
                                      {...field} 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="flex space-x-2 pt-4">
                              <Button type="submit" size="sm" disabled={isSubmitting}>
                                <Save className="h-3 w-3 mr-1" />
                                Salvar
                              </Button>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setEditingPhase(null)}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancelar
                              </Button>
                            </div>
                          </form>
                        </Form>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {opportunity.budgetNumber && (
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Número do orçamento:</span>
                              <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.budgetNumber}</span>
                            </div>
                          )}
                          {opportunity.budget && (
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Valor da proposta:</span>
                              <span className="ml-2 text-gray-900 dark:text-gray-100 font-medium text-green-600 dark:text-green-400">
                                {formatBudgetForDisplay(opportunity.budget)}
                              </span>
                            </div>
                          )}
                          {opportunity.notes && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-gray-700 dark:text-gray-300">Observação:</span>
                              <p className="mt-1 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 p-2 rounded border dark:border-gray-600 whitespace-pre-wrap">
                                {opportunity.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Negociação */}
                {(opportunity.status || opportunity.finalValue || opportunity.negotiationInfo || opportunity.contract || opportunity.invoiceNumber) && (
                  <div className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-blue-700">🤝 Negociação</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingPhase(editingPhase === 'negociacao' ? null : 'negociacao')}
                        className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        title="Editar informações da fase de Negociação"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                    {editingPhase === 'negociacao' ? (
                      <Form {...negociacaoForm}>
                        <form onSubmit={negociacaoForm.handleSubmit(handleSubmit)} className="space-y-4">
                          <FormField
                            control={negociacaoForm.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Status da negociação</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione o status" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="em-negociacao">Em negociação</SelectItem>
                                    <SelectItem value="aguardando-aprovacao">Aguardando aprovação</SelectItem>
                                    <SelectItem value="aprovado">Aprovado</SelectItem>
                                    <SelectItem value="rejeitado">Rejeitado</SelectItem>
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
                                <FormLabel>Valor final negociado *</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                                    <Input 
                                      className="pl-9"
                                      placeholder="0,00"
                                      {...field} 
                                      onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, "");
                                        const formattedValue = (Number(value) / 100).toLocaleString("pt-BR", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        });
                                        field.onChange(formattedValue);
                                      }}
                                    />
                                  </div>
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
                                    placeholder="Digite o número do contrato"
                                    {...field} 
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
                                <FormLabel>Número da nota fiscal</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="Digite o número da nota fiscal"
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />



                          <div className="flex space-x-2 pt-4">
                            <Button type="submit" size="sm" disabled={isSubmitting}>
                              <Save className="h-3 w-3 mr-1" />
                              Salvar
                            </Button>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setEditingPhase(null)}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      </Form>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {opportunity.status && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.status}</span>
                          </div>
                        )}
                        {opportunity.finalValue && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Valor final:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100 font-medium text-green-600 dark:text-green-400">
                              R$ {parseFloat(opportunity.finalValue.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {opportunity.contract && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Contrato:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.contract}</span>
                          </div>
                        )}
                        {opportunity.invoiceNumber && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Número da danfe:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.invoiceNumber}</span>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                )}

                {/* Perdido */}
                {(opportunity.lossReason || opportunity.lossObservation) && (
                  <div className="border-l-4 border-red-400 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-red-700">❌ Oportunidade Perdida</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingPhase(editingPhase === 'perdido' ? null : 'perdido')}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                        title="Editar informações da oportunidade perdida"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                    {editingPhase === 'perdido' ? (
                      <Form {...perdidoForm}>
                        <form onSubmit={perdidoForm.handleSubmit(handleSubmit)} className="space-y-4">
                          <FormField
                            control={perdidoForm.control}
                            name="lossReason"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Motivo da perda *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione o motivo" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="preco">Preço</SelectItem>
                                    <SelectItem value="prazo">Prazo</SelectItem>
                                    <SelectItem value="concorrencia">Concorrência</SelectItem>
                                    <SelectItem value="qualidade">Qualidade</SelectItem>
                                    <SelectItem value="desistencia">Desistência do cliente</SelectItem>
                                    <SelectItem value="outro">Outro</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={perdidoForm.control}
                            name="lossObservation"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Observação detalhada</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Descreva os detalhes sobre a perda da oportunidade..."
                                    className="min-h-[100px]"
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex space-x-2 pt-4">
                            <Button type="submit" size="sm" disabled={isSubmitting}>
                              <Save className="h-3 w-3 mr-1" />
                              Salvar
                            </Button>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setEditingPhase(null)}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      </Form>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {opportunity.lossReason && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Motivo da perda:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">{opportunity.lossReason}</span>
                          </div>
                        )}
                        {opportunity.lossObservation && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Observação detalhada:</span>
                            <p className="mt-1 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 p-2 rounded border dark:border-gray-600">{opportunity.lossObservation}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Mensagem se não houver histórico */}
                {opportunity.requiresVisit === undefined && !opportunity.statement && 
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
