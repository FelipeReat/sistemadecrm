
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useReportsSync } from "@/hooks/useReportsSync";
import { masks } from "@/lib/masks";

interface NewProposalOpportunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formSchema = z.object({
  contact: z.string().min(1, "Nome do contato é obrigatório"),
  cpf: z.string().nullable().optional(),
  company: z.string().min(1, "Empresa é obrigatória"),
  cnpj: z.string().nullable().optional(),
  phone: z.string().min(1, "Telefone é obrigatório"),
  hasRegistration: z.boolean().nullable().optional(),
  proposalOrigin: z.string().nullable().optional(),
  businessTemperature: z.string().nullable().optional(),
  needCategory: z.string().min(1, "Categoria de necessidade é obrigatória"),
  clientNeeds: z.string().min(1, "Necessidades do cliente são obrigatórias"),
  opportunityNumber: z.string().min(1, "Número da oportunidade é obrigatório"),
  salesperson: z.string().min(1, "Vendedor é obrigatório"),
  budgetNumber: z.string().min(1, "Número da proposta é obrigatório"),
  budget: z.string().min(1, "Valor da proposta é obrigatório"),
  validityDate: z.date({ required_error: "Data de validade é obrigatória" }),
});

type FormData = z.infer<typeof formSchema>;

const PROPOSAL_ORIGINS = [
  "Redes Sociais",
  "Indicação",
  "Busca ativa",
  "Visita em Obra",
  "Indicação de Diretoria",
  "SDR",
  "Renovação",
  "Whatsapp",
  "Dropdesk"
];

const NEED_CATEGORIES = [
  "Andaimes",
  "Escoras",
  "Painel de Escoramento",
  "Ferramentas",
  "Plataformas Elevatórias",
  "Imóveis",
  "Veículos"
];

export default function NewProposalOpportunityModal({ open, onOpenChange }: NewProposalOpportunityModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { invalidateAllData } = useReportsSync();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contact: "",
      cpf: null,
      company: "",
      cnpj: null,
      phone: "",
      hasRegistration: false,
      proposalOrigin: null,
      businessTemperature: null,
      needCategory: "",
      clientNeeds: "",
      opportunityNumber: "",
      salesperson: "",
      budgetNumber: "",
      budget: "",
    },
  });

  const createOpportunityMutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/opportunities", {
      ...data,
      phase: "proposta",
      budget: parseFloat(data.budget.replace(/[^\d,]/g, '').replace(',', '.')),
      validityDate: data.validityDate.toISOString(),
      documents: []
    }),
    onSuccess: () => {
      invalidateAllData();
      toast({
        title: "Sucesso",
        description: "Nova oportunidade criada na fase de proposta!",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar oportunidade.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    createOpportunityMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="new-proposal-opportunity-modal">
        <DialogHeader>
          <DialogTitle>Nova Oportunidade - Fase de Proposta</DialogTitle>
          <DialogDescription>
            Cadastre uma nova oportunidade diretamente na fase de proposta
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Informações Básicas */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informações Básicas</h3>
                
                <FormField
                  control={form.control}
                  name="contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contato *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do contato" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="000.000.000-00" 
                          {...field}
                          value={field.value ?? ""}
                          mask={masks.cpf}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome da empresa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="00.000.000/0000-00" 
                          {...field}
                          value={field.value ?? ""}
                          mask={masks.cnpj}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="(00) 00000-0000" 
                          {...field} 
                          mask={masks.phone}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hasRegistration"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Possui cadastro no Locador?</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {/* Informações da Oportunidade */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informações da Oportunidade</h3>

                <FormField
                  control={form.control}
                  name="opportunityNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da Oportunidade *</FormLabel>
                      <FormControl>
                        <Input placeholder="#123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="salesperson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendedor *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do vendedor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="proposalOrigin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origem da oportunidade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a origem" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PROPOSAL_ORIGINS.map((origin) => (
                            <SelectItem key={origin} value={origin}>
                              {origin}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="needCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria de necessidade *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {NEED_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessTemperature"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Temperatura do negócio</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                          className="flex flex-row space-x-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="frio" id="frio" />
                            <Label htmlFor="frio">Frio</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="morno" id="morno" />
                            <Label htmlFor="morno">Morno</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="quente" id="quente" />
                            <Label htmlFor="quente">Quente</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Informações da Proposta */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold">Informações da Proposta</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="budgetNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da Proposta *</FormLabel>
                      <FormControl>
                        <Input placeholder="#PROP-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor da Proposta *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="R$ 0,00" 
                          {...field}
                          mask="currency"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="validityDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data de Validade *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy", { locale: ptBR })
                              ) : (
                                <span>Selecione a data</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Necessidades do Cliente */}
            <FormField
              control={form.control}
              name="clientNeeds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Necessidades do Cliente *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva as necessidades específicas do cliente..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4">
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
              >
                {isSubmitting ? "Criando..." : "Criar Oportunidade"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
