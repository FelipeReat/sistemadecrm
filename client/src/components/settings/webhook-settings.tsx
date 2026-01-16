import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Webhook, insertWebhookSchema } from "@shared/schema";
import { Plus, Pencil, Trash2, Globe, Lock, Activity, CheckCircle2, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Available events for webhooks
const AVAILABLE_EVENTS = [
  { id: "opportunity.created", label: "Oportunidade Criada" },
  { id: "opportunity.updated", label: "Oportunidade Atualizada" },
  { id: "opportunity.deleted", label: "Oportunidade Excluída" },
  { id: "opportunity.won", label: "Oportunidade Ganha" },
  { id: "opportunity.lost", label: "Oportunidade Perdida" },
  { id: "client.created", label: "Cliente Criado" },
  { id: "client.updated", label: "Cliente Atualizado" },
];

export default function WebhookSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);

  // Fetch webhooks
  const { data: webhooks, isLoading } = useQuery<Webhook[]>({
    queryKey: ["/api/webhooks"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertWebhookSchema>) => {
      const res = await apiRequest("POST", "/api/webhooks", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      setIsCreateOpen(false);
      toast({
        title: "Webhook criado",
        description: "O webhook foi configurado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof insertWebhookSchema>> }) => {
      const res = await apiRequest("PUT", `/api/webhooks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      setEditingWebhook(null);
      toast({
        title: "Webhook atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/webhooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({
        title: "Webhook removido",
        description: "O webhook foi excluído com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover este webhook?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Webhooks</h3>
          <p className="text-sm text-muted-foreground">
            Configure integrações para receber notificações de eventos do sistema.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Webhook
        </Button>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Carregando webhooks...
            </CardContent>
          </Card>
        ) : webhooks?.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum webhook configurado.
            </CardContent>
          </Card>
        ) : (
          webhooks?.map((webhook) => (
            <Card key={webhook.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-lg">{webhook.name}</h4>
                      {webhook.active ? (
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <span className="font-mono">{webhook.url}</span>
                    </div>
                    {webhook.secret && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Lock className="h-4 w-4" />
                        <span>Segredo configurado</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="outline">
                          {AVAILABLE_EVENTS.find((e) => e.id === event)?.label || event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingWebhook(webhook)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(webhook.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Modal */}
      <WebhookFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        title="Novo Webhook"
        description="Configure um novo endpoint para receber notificações."
        isSubmitting={createMutation.isPending}
      />

      {/* Edit Modal */}
      <WebhookFormDialog
        open={!!editingWebhook}
        onOpenChange={(open) => !open && setEditingWebhook(null)}
        onSubmit={(data) => {
          if (editingWebhook) {
            updateMutation.mutate({ id: editingWebhook.id, data });
          }
        }}
        initialData={editingWebhook || undefined}
        title="Editar Webhook"
        description="Altere as configurações do webhook."
        isSubmitting={updateMutation.isPending}
      />
    </div>
  );
}

interface WebhookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: z.infer<typeof insertWebhookSchema>) => void;
  initialData?: Webhook;
  title: string;
  description: string;
  isSubmitting: boolean;
}

type WebhookFormValues = z.infer<typeof insertWebhookSchema>;

function WebhookFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title,
  description,
  isSubmitting,
}: WebhookFormDialogProps) {
  const form = useForm<WebhookFormValues>({
    defaultValues: initialData
      ? {
          name: initialData.name,
          url: initialData.url,
          events: initialData.events,
          secret: initialData.secret ?? "",
          active: initialData.active ?? true,
        }
      : {
          name: "",
          url: "",
          events: [],
          secret: "",
          active: true,
        },
  }) as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Integração Slack" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL do Endpoint</FormLabel>
                  <FormControl>
                    <Input placeholder="https://api.exemplo.com/webhook" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Segredo (Opcional)</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Chave para validar assinatura" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>
                    Usado para assinar o payload e verificar a autenticidade.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="events"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Eventos</FormLabel>
                    <FormDescription>
                      Selecione os eventos que dispararão este webhook.
                    </FormDescription>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {AVAILABLE_EVENTS.map((event) => (
                      <FormField
                        key={event.id}
                        control={form.control}
                        name="events"
                        render={({ field }) => {
                          const value = Array.isArray(field.value)
                            ? field.value
                            : [];
                          return (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={value.includes(event.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked === true) {
                                      field.onChange([...value, event.id]);
                                    } else {
                                      field.onChange(
                                        value.filter((v) => v !== event.id)
                                      );
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {event.label}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Ativo</FormLabel>
                    <FormDescription>
                      Desative para pausar o envio de notificações.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Checkbox
                      checked={!!field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar Webhook"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
