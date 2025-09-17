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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XCircle, AlertTriangle } from "lucide-react";
import { Opportunity } from "@shared/schema";

interface LossReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: Opportunity | null;
  onConfirm: (data: LossReasonData) => void;
  isLoading?: boolean;
}

const lossReasonSchema = z.object({
  lossReason: z.string().min(1, "Motivo da perda é obrigatório"),
  lossObservation: z.string().min(10, "Descrição detalhada é obrigatória (mínimo 10 caracteres)").max(1000, "Descrição muito longa (máximo 1000 caracteres)"),
});

export type LossReasonData = z.infer<typeof lossReasonSchema>;

const LOSS_REASONS = [
  "Preço muito alto",
  "Concorrente escolhido", 
  "Projeto cancelado",
  "Orçamento insuficiente",
  "Timing inadequado",
  "Falta de necessidade",
  "Problemas técnicos",
  "Falta de confiança",
  "Processo interno complexo",
  "Decisor mudou",
  "Outro"
];

export default function LossReasonModal({ 
  open, 
  onOpenChange, 
  opportunity,
  onConfirm,
  isLoading = false 
}: LossReasonModalProps) {
  const form = useForm<LossReasonData>({
    resolver: zodResolver(lossReasonSchema),
    defaultValues: {
      lossReason: "",
      lossObservation: "",
    },
  });

  const handleSubmit = (data: LossReasonData) => {
    onConfirm(data);
    form.reset();
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Motivo da Perda
          </DialogTitle>
          <DialogDescription>
            {opportunity && (
              <>
                Para finalizar a movimentação de <strong>{opportunity.contact}</strong> para "Perdido", 
                é necessário informar o motivo da perda. Esta informação será salva como descrição do card.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="lossReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Motivo Principal *
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-loss-reason">
                        <SelectValue placeholder="Selecione o motivo da perda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LOSS_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
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
              name="lossObservation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição Detalhada *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva detalhadamente o que aconteceu, feedback do cliente, lições aprendidas, etc..."
                      className="min-h-[100px] resize-none"
                      data-testid="textarea-loss-observation"
                      {...field}
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground">
                    {field.value?.length || 0}/1000 caracteres
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                data-testid="button-cancel-loss"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isLoading}
                data-testid="button-confirm-loss"
              >
                {isLoading ? "Salvando..." : "Confirmar Perda"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}