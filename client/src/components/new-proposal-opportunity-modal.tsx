
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
import { FileUpload } from "@/components/ui/file-upload";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useReportsSync } from "@/hooks/useReportsSync";
import { insertOpportunitySchema } from "@shared/schema";
import { masks } from "@/lib/masks";
import { X } from "lucide-react";

interface NewProposalOpportunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formSchema = insertOpportunitySchema.pick({
  contact: true,
  cpf: true,
  company: true,
  cnpj: true,
  phone: true,
  hasRegistration: true,
  proposalOrigin: true,
  businessTemperature: true,
  needCategory: true,
  clientNeeds: true,
}).extend({
  contact: z.string().min(1, "Nome do contato é obrigatório"),
  phone: z.string().min(1, "Telefone é obrigatório"),
  needCategory: z.string().min(1, "Categoria de necessidade é obrigatória"),
  clientNeeds: z.string().min(1, "Necessidades do cliente são obrigatórias"),
  cpf: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  hasRegistration: z.boolean().nullable().optional(),
  proposalOrigin: z.string().nullable().optional(),
  businessTemperature: z.string().nullable().optional(),
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
    },
  });

  const createOpportunityMutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/opportunities", {
      ...data,
      phase: "proposta",
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="new-proposal-opportunity-modal">
        <DialogHeader className="relative">
          <DialogTitle className="flex items-center space-x-2">
            <span>Nova Oportunidade - Fase de Proposta</span>
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="absolute top-0 right-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Fechar modal"
          >
            <X className="h-4 w-4" />
          </Button>
          <DialogDescription>
            Cadastre uma nova oportunidade diretamente na fase de proposta
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <i className="fas fa-user mr-1"></i>Contato *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nome do contato" 
                      {...field} 
                      data-testid="input-contact"
                    />
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
                  <FormLabel>
                    <i className="fas fa-id-card mr-1"></i>CPF
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="000.000.000-00" 
                      {...field}
                      value={field.value ?? ""}
                      mask={masks.cpf}
                      data-testid="input-cpf"
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
                  <FormLabel>
                    <i className="fas fa-building mr-1"></i>Empresa *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nome da empresa" 
                      {...field} 
                      data-testid="input-company"
                    />
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
                  <FormLabel>
                    <i className="fas fa-building mr-1"></i>CNPJ
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="00.000.000/0000-00" 
                      {...field}
                      value={field.value ?? ""}
                      mask={masks.cnpj}
                      data-testid="input-cnpj"
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
                  <FormLabel>
                    <i className="fas fa-phone mr-1"></i>Telefone *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="(00) 00000-0000" 
                      {...field} 
                      value={field.value ?? ""}
                      mask={masks.phone}
                      data-testid="input-phone"
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
                      data-testid="checkbox-has-registration"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Possui cadastro no Locador?</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="proposalOrigin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <i className="fas fa-source mr-1"></i>Origem da oportunidade
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-proposal-origin">
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
                  <FormLabel>
                    <i className="fas fa-tags mr-1"></i>Categoria de necessidade *
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-need-category">
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
                  <FormLabel>
                    <i className="fas fa-thermometer-half mr-1"></i>Temperatura do negócio
                  </FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                      className="flex flex-row space-x-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="frio" id="frio-proposal" />
                        <Label htmlFor="frio-proposal">Frio</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="morno" id="morno-proposal" />
                        <Label htmlFor="morno-proposal">Morno</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="quente" id="quente-proposal" />
                        <Label htmlFor="quente-proposal">Quente</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientNeeds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <i className="fas fa-clipboard-list mr-1"></i>Necessidades do Cliente *
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva as necessidades específicas do cliente..."
                      rows={4}
                      {...field}
                      data-testid="textarea-client-needs"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                <i className="fas fa-file-upload mr-1"></i>Documentos
              </Label>
              <FileUpload
                onFilesChange={() => {}}
                multiple
                accept="image/*,.pdf,.doc,.docx"
                data-testid="input-documents"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                data-testid="button-create"
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
