import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Trash2, AlertTriangle } from "lucide-react";
import { ImportModal } from "@/components/import-modal";

export default function DataManagementSettings() {
  const { toast } = useToast();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Get current user for role-based actions
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  const exportDataMutation = useMutation({
    mutationFn: () => fetch("/api/export/opportunities").then(res => res.json()),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Dados exportados",
        description: "O arquivo foi baixado com sucesso."
      });
    }
  });

  const clearAllDataMutation = useMutation({
    mutationFn: () => fetch("/api/admin/clear-all-data", { method: "DELETE" }).then(res => res.json()),
    onSuccess: (data) => {
      toast({
        title: "Dados removidos",
        description: `Todos os dados foram removidos: ${data.summary.opportunities} oportunidades, ${data.summary.automations} automações, ${data.summary.savedReports} relatórios.`
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível limpar os dados.",
        variant: "destructive"
      });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciamento de Dados</CardTitle>
        <CardDescription>Importe, exporte ou limpe seus dados do CRM</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Importar Dados */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Importar Dados
              </CardTitle>
              <CardDescription>
                Importe oportunidades de arquivos CSV/Excel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Faça upload de um arquivo e mapeie os campos para importar.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setIsImportModalOpen(true)}
                data-testid="button-import-data"
              >
                Importar
              </Button>
            </CardContent>
          </Card>

          {/* Exportar Dados */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exportar Dados
              </CardTitle>
              <CardDescription>
                Baixe todas as oportunidades em formato JSON
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Exporte os dados atuais do CRM para backup ou análise.
              </p>
              <Button 
                variant="outline" 
                onClick={() => exportDataMutation.mutate()}
                disabled={exportDataMutation.isPending}
              >
                {exportDataMutation.isPending ? "Exportando..." : "Exportar Dados"}
              </Button>
            </CardContent>
          </Card>

          {/* Limpar Dados */}
          <Card className="border-destructive/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <Trash2 className="h-4 w-4" />
                Limpar Dados
              </CardTitle>
              <CardDescription>
                Remova permanentemente todos os dados do CRM
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">Atenção: ação irreversível</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Esta ação remove TODAS as oportunidades, automações e relatórios.
                </p>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    if (!currentUser || currentUser.role !== 'admin') {
                      toast({
                        title: "Permissão necessária",
                        description: "Apenas administradores podem limpar os dados.",
                        variant: "destructive"
                      });
                      return;
                    }
                    if (window.confirm("⚠️ ATENÇÃO: Esta ação irá remover TODOS os dados do sistema permanentemente!\n\nTem certeza que deseja continuar? Esta ação NÃO pode ser desfeita.")) {
                      clearAllDataMutation.mutate();
                    }
                  }}
                  disabled={clearAllDataMutation.isPending}
                >
                  {clearAllDataMutation.isPending ? "Limpando..." : "Limpar Dados"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Modal de Importação */}
        <ImportModal 
          isOpen={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)}
        />
      </CardContent>
    </Card>
  );
}