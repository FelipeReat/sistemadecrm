import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ClearCardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
  cardsCount?: number;
}

export default function ClearCardsModal({ 
  open, 
  onOpenChange, 
  onConfirm,
  isLoading = false,
  cardsCount = 0
}: ClearCardsModalProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const requiredText = "LIMPAR TODOS";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmationText === requiredText) {
      onConfirm();
      setConfirmationText("");
    }
  };

  const handleCancel = () => {
    setConfirmationText("");
    onOpenChange(false);
  };

  const isConfirmationValid = confirmationText === requiredText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Limpar Todos os Cards
          </DialogTitle>
          <DialogDescription>
            Esta ação irá remover permanentemente todos os cards do Kanban.
            Um backup será criado automaticamente antes da exclusão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Atenção:</strong> Esta ação não pode ser desfeita. 
              {cardsCount > 0 && (
                <> Serão removidos <strong>{cardsCount} cards</strong> do sistema.</>
              )}
            </AlertDescription>
          </Alert>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-800 mb-2">
              <Shield className="h-4 w-4" />
              <span className="font-medium">Backup Automático</span>
            </div>
            <p className="text-sm text-blue-700">
              Antes da exclusão, todos os dados serão salvos em um backup que pode ser 
              restaurado posteriormente se necessário.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirmation">
                Para confirmar, digite <strong>"{requiredText}"</strong> no campo abaixo:
              </Label>
              <Input
                id="confirmation"
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder={`Digite "${requiredText}" para confirmar`}
                disabled={isLoading}
                data-testid="input-confirmation"
                className={confirmationText && !isConfirmationValid ? "border-red-300 focus:border-red-500" : ""}
              />
              {confirmationText && !isConfirmationValid && (
                <p className="text-sm text-red-600">
                  Texto de confirmação incorreto
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                data-testid="button-cancel-clear"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isLoading || !isConfirmationValid}
                data-testid="button-confirm-clear"
              >
                {isLoading ? "Limpando..." : "Limpar Todos os Cards"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}