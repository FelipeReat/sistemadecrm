import { useState } from "react";
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
import { Calendar, FileText, Handshake, MapPin, DollarSign, Upload, User, X } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useReportsSync } from "@/hooks/useReportsSync";
import type { Opportunity } from "@shared/schema";
import { masks } from "@/lib/masks";

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
  visitSchedule: z.string().min(1, "Data da visita é obrigatória"),
  visitDate: z.string().optional(),
  visitPhotos: z.array(z.string()).optional(),
});

// Schema para o formulário de proposta
const propostaSchema = z.object({
  discount: z.string().optional(),
  discountDescription: z.string().optional(),
  validityDate: z.string().min(1, "Data de validade é obrigatória"),
  budgetNumber: z.string().min(1, "Número do orçamento é obrigatório"),
  budget: z.string().min(1, "Valor do orçamento é obrigatório"),
});

// Schema para o formulário de negociação
const negociacaoSchema = z.object({
  status: z.string().min(1, "Status é obrigatório"),
  finalValue: z.string().min(1, "Valor final é obrigatório"),
  negotiationInfo: z.string().optional(),
  contract: z.string().optional(),
  invoiceNumber: z.string().optional(),
  lossReason: z.string().optional(),
});

type ProspeccaoFormData = z.infer<typeof prospeccaoSchema>;
type EmAtendimentoFormData = z.infer<typeof emAtendimentoSchema>;
type VisitaTecnicaFormData = z.infer<typeof visitaTecnicaSchema>;
type PropostaFormData = z.infer<typeof propostaSchema>;
type NegociacaoFormData = z.infer<typeof negociacaoSchema>;

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
      visitPhotos: opportunity?.visitPhotos || [],
    },
  });

  const propostaForm = useForm<PropostaFormData>({
    resolver: zodResolver(propostaSchema),
    defaultValues: {
      discount: opportunity?.discount || "",
      discountDescription: opportunity?.discountDescription || "",
      validityDate: opportunity?.validityDate || "",
      budgetNumber: opportunity?.budgetNumber || "",
      budget: opportunity?.budget || "",
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
      console.error("Mutation error:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao atualizar oportunidade.";
      console.error("Detailed error message:", errorMessage);
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

  const getNextPhase = (currentPhase: string): string | null => {
    const phaseOrder = ["prospeccao", "em-atendimento", "visita-tecnica", "proposta", "negociacao", "ganho"];
    const currentIndex = phaseOrder.indexOf(currentPhase);
    return currentIndex < phaseOrder.length - 1 ? phaseOrder[currentIndex + 1] : null;
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
      
      // Clean date value (convert DD/MM/YYYY to YYYY-MM-DD)
      if (cleanedData.validityDate) {
        const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const match = cleanedData.validityDate.match(dateRegex);
        if (match) {
          const [, day, month, year] = match;
          cleanedData.validityDate = `${year}-${month}-${day}`;
        }
      }

      console.log("Data being sent to API:", cleanedData);

      // Apenas atualiza os dados da oportunidade
      await updateOpportunityMutation.mutateAsync({ ...cleanedData, id: opportunity.id });

      // Fecha o modal após salvar (sem perguntar sobre mover para próxima fase)
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      console.error("Error details:", error?.response?.data || error?.message || error);
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

              <DialogFooter className="flex justify-between">
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

              <DialogFooter className="flex justify-between">
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
                        * Data da visita
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
                          type="date"
                          {...field}
                          placeholder="Data de realização"
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

              <DialogFooter className="flex justify-between">
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
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          <FileText className="h-4 w-4 mr-2" />
                          * Número do orçamento
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="ORC-001" {...field} onChange={(e) => field.onChange(masks.cnpjOrCpf(e.target.value))} />
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
              </div>

              <DialogFooter className="flex justify-between">
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
                      <FormLabel>Número da nota fiscal</FormLabel>
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

              <DialogFooter className="flex justify-between">
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
          {/* Informações básicas */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label>Empresa</Label>
              <Input value={opportunity.company} disabled className="bg-gray-50" />
            </div>
            <div>
              <Label>Contato</Label>
              <Input value={opportunity.contact} disabled className="bg-gray-50" />
            </div>
          </div>

          {/* Formulário específico da fase */}
          {renderPhaseForm()}
        </div>
      </DialogContent>
    </Dialog>
  );
}