import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/ui/file-upload";
import { UploadedFile } from "@/hooks/useFileUpload";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useReportsSync } from "@/hooks/useReportsSync";
import { useAuth } from "@/hooks/useAuth";
import { masks } from "@/lib/masks";

interface NewOpportunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhase?: string;
  mode?: "lead" | "visit";
}

const ORIGIN_OPTIONS = [
  "Locador - sem locacao 3 meses",
  "Locador - sem locacao 6 meses",
  "Instagram",
  "Grupos de WhatsApp",
  "CNO",
  "Lista de transmissao WhatsApp",
  "Celular principal 1",
  "Celular principal 2",
  "Dropdesk",
  "Trafego pago",
  "Site",
  "Google Maps",
  "Indicacao",
  "Acao externa",
  "Outro",
];

const LEAD_STATUS_OPTIONS = [
  "Novo",
  "Em contato",
  "Qualificado",
  "Repassado ao vendedor",
  "Proposta gerada",
  "Visita agendada",
  "Sem retorno",
  "Perdido",
  "Fechado",
  "Descartado",
];

const QUALITY_OPTIONS = [
  "qualificado",
  "morno",
  "frio",
  "sem perfil",
  "duplicado",
];

const OPPORTUNITY_TYPE_OPTIONS = [
  "Novo cliente",
  "Reativacao",
  "Oportunidade de obra",
  "Lead inbound",
  "Indicacao",
  "Recuperacao de proposta",
  "Outro",
];

const YES_NO_PENDING_OPTIONS = ["Sim", "Nao", "Pendente"];
const VISIT_TYPE_OPTIONS = ["Prospeccao", "Follow-up", "Medicao/levantamento", "Negociacao", "Pos-venda", "Recuperacao", "Outro"];
const VISIT_STATUS_OPTIONS = ["Agendada", "Realizada", "Remarcada", "Cancelada", "Sem retorno", "Gerou proposta", "Fechada", "Perdida"];

const baseFormSchema = z.object({
  clientName: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  proposalNumber: z.string().optional(),
  opportunityFeedback: z.string().optional(),
  registrationDate: z.string().optional(),
  leadOrigin: z.string().optional(),
  city: z.string().optional(),
  opportunityType: z.string().optional(),
  leadStatus: z.string().optional(),
  salespersonName: z.string().optional(),
  expectedValue: z.string().optional(),
  leadQuality: z.string().optional(),
  nextStep: z.string().optional(),
  nextStepDate: z.string().optional(),
  handoffStatus: z.string().optional(),
  sellerReturn: z.string().optional(),
  leadObservations: z.string().optional(),
  visitDateField: z.string().optional(),
  visitVendor: z.string().optional(),
  visitedClient: z.string().optional(),
  visitClientContact: z.string().optional(),
  visitOrigin: z.string().optional(),
  equipmentDemand: z.string().optional(),
  visitLocation: z.string().optional(),
  visitType: z.string().optional(),
  visitObjective: z.string().optional(),
  visitStatus: z.string().optional(),
  visitResult: z.string().optional(),
  visitProposalNumber: z.string().optional(),
  visitExpectedValue: z.string().optional(),
  visitNextStep: z.string().optional(),
  visitNextStepOwner: z.string().optional(),
  visitNextStepDeadline: z.string().optional(),
  vendorFeedback: z.string().optional(),
  visitObservations: z.string().optional(),
});

function createFormSchema(mode: "lead" | "visit") {
  return baseFormSchema.superRefine((data, ctx) => {
  if (mode === "visit") {
    if (!data.visitDateField?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["visitDateField"], message: "Data da visita é obrigatória" });
    }
    if (!data.visitVendor?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["visitVendor"], message: "Vendedor é obrigatório" });
    }
    if (!data.visitedClient?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["visitedClient"], message: "Cliente visitado é obrigatório" });
    }
  } else {
    if (!data.clientName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["clientName"], message: "Nome do cliente é obrigatório" });
    }
    if (!data.contactName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contactName"], message: "Contato é obrigatório" });
    }
    if (!data.contactPhone?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contactPhone"], message: "Numero de contato é obrigatório" });
    }
    if (!data.proposalNumber?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["proposalNumber"], message: "Numero da proposta é obrigatório" });
    }
    if (!data.opportunityFeedback?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["opportunityFeedback"], message: "Feedback da oportunidade é obrigatório" });
    }
  }
  });
}

type FormData = z.infer<typeof baseFormSchema>;

function buildLeadPayload(data: FormData, uploadedDocuments: UploadedFile[], createdByName: string, initialPhase: string) {
  return {
    company: data.clientName,
    contact: data.contactName,
    phone: data.contactPhone,
    budgetNumber: data.proposalNumber,
    opportunityNumber: data.proposalNumber,
    statement: data.opportunityFeedback,
    createdAt: data.registrationDate ? new Date(data.registrationDate) : undefined,
    proposalOrigin: data.leadOrigin || null,
    contract: data.city || null,
    leadCity: data.city || null,
    needCategory: data.opportunityType || null,
    leadOpportunityType: data.opportunityType || null,
    status: data.leadStatus || null,
    leadStatus: data.leadStatus || null,
    salesperson: data.salespersonName || null,
    budget: data.expectedValue || null,
    businessTemperature: data.leadQuality || null,
    leadQuality: data.leadQuality || null,
    leadFeedback: data.opportunityFeedback || null,
    negotiationInfo: data.nextStep || null,
    leadNextStep: data.nextStep || null,
    visitSchedule: data.nextStepDate || null,
    leadNextContactAt: data.nextStepDate || null,
    discountDescription: data.handoffStatus || null,
    leadHandoffStatus: data.handoffStatus || null,
    invoiceNumber: data.sellerReturn || null,
    leadSellerReturn: data.sellerReturn || null,
    notes: data.leadObservations || null,
    leadObservations: data.leadObservations || null,
    documents: uploadedDocuments,
    createdByName,
    phase: initialPhase || "prospeccao",
  };
}

function buildVisitPayload(data: FormData, uploadedDocuments: UploadedFile[], createdByName: string, initialPhase: string) {
  return {
    company: data.visitedClient,
    contact: data.visitClientContact || data.visitedClient,
    proposalOrigin: data.visitOrigin || null,
    visitOrigin: data.visitOrigin || null,
    salesperson: data.visitVendor || null,
    visitVendor: data.visitVendor || null,
    needCategory: data.equipmentDemand || null,
    visitEquipmentDemand: data.equipmentDemand || null,
    contract: data.visitLocation || null,
    visitLocation: data.visitLocation || null,
    visitDescription: data.visitType || null,
    visitType: data.visitType || null,
    statement: data.visitObjective || null,
    visitObjective: data.visitObjective || null,
    status: data.visitStatus || null,
    visitStatus: data.visitStatus || null,
    visitRealization: data.visitResult || null,
    visitResult: data.visitResult || null,
    visitDate: data.visitDateField || null,
    budgetNumber: data.visitProposalNumber || null,
    opportunityNumber: data.visitProposalNumber || null,
    budget: data.visitExpectedValue || null,
    negotiationInfo: data.visitNextStep || null,
    visitNextStep: data.visitNextStep || null,
    invoiceNumber: data.visitNextStepOwner || null,
    visitNextStepOwner: data.visitNextStepOwner || null,
    validityDate: data.visitNextStepDeadline ? new Date(data.visitNextStepDeadline) : null,
    visitNextStepDeadline: data.visitNextStepDeadline || null,
    notes: data.vendorFeedback || null,
    vendorFeedback: data.vendorFeedback || null,
    lossObservation: data.visitObservations || null,
    visitObservations: data.visitObservations || null,
    visitClient: data.visitedClient || null,
    visitClientContact: data.visitClientContact || null,
    requiresVisit: true,
    documents: uploadedDocuments,
    createdByName,
    phase: initialPhase || "visita-tecnica",
  };
}

function renderSelectItems(values: string[]) {
  return values.map((item) => (
    <SelectItem key={item} value={item}>
      {item}
    </SelectItem>
  ));
}

export default function NewOpportunityModal({ open, onOpenChange, initialPhase = "prospeccao", mode = "lead" }: NewOpportunityModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedFile[]>([]);
  const { toast } = useToast();
  const { invalidateAllData } = useReportsSync();
  const { user } = useAuth();
  const formSchema = createFormSchema(mode);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: "",
      contactName: "",
      contactPhone: "",
      proposalNumber: "",
      opportunityFeedback: "",
      registrationDate: "",
      leadOrigin: "",
      city: "",
      opportunityType: "",
      leadStatus: "",
      salespersonName: "",
      expectedValue: "",
      leadQuality: "",
      nextStep: "",
      nextStepDate: "",
      handoffStatus: "",
      sellerReturn: "",
      leadObservations: "",
      visitDateField: "",
      visitVendor: "",
      visitedClient: "",
      visitClientContact: "",
      visitOrigin: "",
      equipmentDemand: "",
      visitLocation: "",
      visitType: "",
      visitObjective: "",
      visitStatus: "",
      visitResult: "",
      visitProposalNumber: "",
      visitExpectedValue: "",
      visitNextStep: "",
      visitNextStepOwner: "",
      visitNextStepDeadline: "",
      vendorFeedback: "",
      visitObservations: "",
    },
  });

  const createOpportunityMutation = useMutation({
    mutationFn: (data: FormData) => {
      const createdByName = user?.name || user?.email || "Usuário";
      const payload = mode === "visit"
        ? buildVisitPayload(data, uploadedDocuments, createdByName, initialPhase)
        : buildLeadPayload(data, uploadedDocuments, createdByName, initialPhase);
      return apiRequest("POST", "/api/opportunities", payload);
    },
    onSuccess: () => {
      invalidateAllData(); // Sincroniza dashboard e relatórios
      toast({
        title: "Sucesso",
        description: mode === "visit" ? "Registro de visita criado com sucesso!" : "Lead criado com sucesso!",
      });
      form.reset();
      setUploadedDocuments([]);
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

  // Resetar formulário quando o modal abrir/fechar
  useEffect(() => {
    if (open) {
      // Resetar formulário quando modal abrir
      form.reset();
      setUploadedDocuments([]);
    }
  }, [open, form, mode]);

  const title = mode === "visit" ? "Nova Visita de Vendedor" : "Novo Lead do Mes";
  const description = mode === "visit"
    ? "Cadastre uma visita com os campos operacionais da planilha."
    : "Cadastre um lead com os campos da aba Leads do Mes da planilha.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="new-opportunity-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {mode === "visit" ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="visitDateField" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data da visita *</FormLabel>
                      <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitVendor" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendedor *</FormLabel>
                      <FormControl><Input placeholder="Nome do vendedor" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitedClient" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente visitado *</FormLabel>
                      <FormControl><Input placeholder="Nome do cliente ou empresa" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitClientContact" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contato do cliente</FormLabel>
                      <FormControl><Input placeholder="Responsavel ou contato" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitOrigin" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origem do lead</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>{renderSelectItems(ORIGIN_OPTIONS)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="equipmentDemand" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Equipamento / demanda</FormLabel>
                      <FormControl><Input placeholder="Equipamento, servico ou demanda" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitLocation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade / local / obra</FormLabel>
                      <FormControl><Input placeholder="Cidade, bairro, obra ou local" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de visita</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>{renderSelectItems(VISIT_TYPE_OPTIONS)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitStatus" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status da visita</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>{renderSelectItems(VISIT_STATUS_OPTIONS)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitProposalNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numero da proposta</FormLabel>
                      <FormControl><Input placeholder="Numero da proposta" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitExpectedValue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor previsto</FormLabel>
                      <FormControl><Input placeholder="R$ 0,00" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitNextStepOwner" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsavel pelo proximo passo</FormLabel>
                      <FormControl><Input placeholder="Quem vai executar o proximo passo" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="visitNextStepDeadline" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prazo do proximo passo</FormLabel>
                      <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="visitObjective" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objetivo da visita</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Objetivo comercial da visita" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="visitResult" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resultado da visita</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Resultado obtido na visita" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="visitNextStep" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proximo passo</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Qual o proximo passo acordado?" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="vendorFeedback" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feedback do vendedor</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Feedback do vendedor apos a visita" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="visitObservations" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observacoes</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Observacoes adicionais" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="clientName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do cliente *</FormLabel>
                      <FormControl><Input placeholder="Cliente ou empresa" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="contactName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contato *</FormLabel>
                      <FormControl><Input placeholder="Nome do contato" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="contactPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numero de contato *</FormLabel>
                      <FormControl><Input placeholder="(00) 00000-0000" {...field} value={field.value ?? ""} mask={masks.phone} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="proposalNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numero da proposta *</FormLabel>
                      <FormControl><Input placeholder="Numero da proposta" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="registrationDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de cadastro</FormLabel>
                      <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="leadOrigin" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origem / base do lead</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>{renderSelectItems(ORIGIN_OPTIONS)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl><Input placeholder="Cidade do lead" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="opportunityType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de oportunidade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>{renderSelectItems(OPPORTUNITY_TYPE_OPTIONS)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="leadStatus" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>{renderSelectItems(LEAD_STATUS_OPTIONS)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="salespersonName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendedor responsavel</FormLabel>
                      <FormControl><Input placeholder="Nome do vendedor" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="expectedValue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor previsto</FormLabel>
                      <FormControl><Input placeholder="R$ 0,00" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="leadQuality" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qualidade do lead</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione a qualidade" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>{renderSelectItems(QUALITY_OPTIONS)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="nextStepDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data / horario do proximo contato</FormLabel>
                      <FormControl><Input type="datetime-local" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="handoffStatus" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repassado ao vendedor?</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>{renderSelectItems(YES_NO_PENDING_OPTIONS)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="sellerReturn" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retorno do vendedor</FormLabel>
                      <FormControl><Input placeholder="Feedback ou retorno do vendedor" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="opportunityFeedback" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feedback da oportunidade *</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Descreva o contexto e o feedback da oportunidade" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="nextStep" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proximo passo</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Informe o proximo passo planejado" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="leadObservations" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observacoes</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Observacoes complementares" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Documentos</Label>
              <FileUpload
                onFilesChange={setUploadedDocuments}
                value={uploadedDocuments}
                multiple
                accept="image/*,.pdf,.doc,.docx"
                data-testid="input-documents"
                enableGlobalPaste={open}
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
                {isSubmitting ? "Salvando..." : mode === "visit" ? "Criar Visita" : "Criar Lead"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
