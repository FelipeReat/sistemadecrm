
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Calendar, User, FileText, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Opportunity } from "@shared/schema";

interface OpportunityDetailsModalProps {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Schema para o formulário de prospecção
const prospeccaoSchema = z.object({
  opportunityNumber: z.string().optional(),
  salesperson: z.string().min(1, "Vendedor responsável é obrigatório"),
  requiresVisit: z.boolean(),
  nextActivityDate: z.string().optional(),
});

type ProspeccaoFormData = z.infer<typeof prospeccaoSchema>;

export default function OpportunityDetailsModal({
  opportunity,
  open,
  onOpenChange,
}: OpportunityDetailsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ProspeccaoFormData>({
    resolver: zodResolver(prospeccaoSchema),
    defaultValues: {
      opportunityNumber: opportunity?.opportunityNumber || "",
      salesperson: opportunity?.salesperson || "",
      requiresVisit: opportunity?.requiresVisit || false,
      nextActivityDate: opportunity?.nextActivityDate || "",
    },
  });

  const updateOpportunityMutation = useMutation({
    mutationFn: (data: ProspeccaoFormData & { id: string }) => 
      apiRequest("PATCH", `/api/opportunities/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Sucesso",
        description: "Oportunidade atualizada com sucesso!",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar oportunidade.",
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
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
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

  const onSubmit = async (data: ProspeccaoFormData) => {
    if (!opportunity) return;
    
    setIsSubmitting(true);
    
    // Primeiro atualiza os dados da oportunidade
    await updateOpportunityMutation.mutateAsync({ ...data, id: opportunity.id });
    
    // Se estiver na fase de prospecção, perguntar se quer mover para próxima fase
    if (opportunity.phase === "prospeccao") {
      const moveToNext = window.confirm(
        "Dados salvos com sucesso! Deseja mover esta oportunidade para a próxima fase (Em Atendimento)?"
      );
      
      if (moveToNext) {
        await moveToNextPhaseMutation.mutateAsync({ 
          opportunityId: opportunity.id, 
          newPhase: "em-atendimento" 
        });
      }
    }
  };

  if (!opportunity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Detalhes da Oportunidade</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Empresa: {opportunity.company} • Fase: {opportunity.phase}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Informações básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Empresa</Label>
                  <Input value={opportunity.company} disabled className="bg-gray-50" />
                </div>
                <div>
                  <Label>Contato</Label>
                  <Input value={opportunity.contact} disabled className="bg-gray-50" />
                </div>
              </div>

              {/* Formulário específico da fase de prospecção */}
              {opportunity.phase === "prospeccao" && (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold text-gray-900 flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Informações de Prospecção
                  </h4>

                  {/* Número da oportunidade */}
                  <FormField
                    control={form.control}
                    name="opportunityNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          <FileText className="h-4 w-4 mr-2" />
                          Número da oportunidade
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="#9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Vendedor responsável */}
                  <FormField
                    control={form.control}
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
                              <SelectValue placeholder="+ Adicionar responsável" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="carlos">Carlos Mendes</SelectItem>
                            <SelectItem value="ana">Ana Silva</SelectItem>
                            <SelectItem value="pedro">Pedro Santos</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Necessário Visita? */}
                  <FormField
                    control={form.control}
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

                  {/* Atividades */}
                  <div>
                    <Label className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      Atividades
                    </Label>
                    <div className="mt-2 p-3 bg-blue-50 rounded-md">
                      <p className="text-sm text-blue-700">
                        📝 Lembre-se de logar suas atividades no menu de Atividades ou na forma de comentário!
                      </p>
                    </div>
                  </div>

                  {/* Data da próxima atividade */}
                  <FormField
                    control={form.control}
                    name="nextActivityDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          Data da próxima atividade
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            placeholder="Selecione uma data e hora"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

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
                  {isSubmitting ? "Salvando..." : "Salvar e Continuar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
