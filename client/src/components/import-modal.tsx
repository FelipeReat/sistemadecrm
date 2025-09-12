import { useState, useCallback, useRef } from "react";
import { X, Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, Clock, FileText, Play, BarChart3, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useReportsSync } from "@/hooks/useReportsSync";
import { cn } from "@/lib/utils";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

interface FileUploadData {
  fileId: string;
  filename: string;
  columns: string[];
  rowCount: number;
  autoMapping: Record<string, string>;
  preview: any[];
}

interface ValidationResult {
  isValid: boolean;
  requiredFieldsMapped: boolean;
  warnings: string[];
  errors: string[];
  missingRequired: string[];
}

interface PreviewData {
  previewData: Array<{
    original: any;
    transformed: any;
    isValid: boolean;
    errors: any[];
  }>;
  validationSummary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
  errors: any[];
}

interface ImportStatus {
  importId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  processedRows: number;
  totalRows: number;
  results: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: any[];
  };
  error?: string;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'progress';

const FIELD_MAPPINGS = {
  contact: { displayName: 'Nome do Contato', required: true },
  company: { displayName: 'Nome da Empresa', required: true },
  phone: { displayName: 'Telefone', required: true },
  cpf: { displayName: 'CPF', required: false },
  cnpj: { displayName: 'CNPJ', required: false },
  needCategory: { displayName: 'Categoria da Necessidade', required: true },
  clientNeeds: { displayName: 'Necessidades do Cliente', required: true },
  budget: { displayName: 'Orçamento', required: false },
  finalValue: { displayName: 'Valor Final', required: false },
  businessTemperature: { displayName: 'Temperatura do Negócio', required: false },
  salesperson: { displayName: 'Vendedor', required: false },
  phase: { displayName: 'Fase', required: false },
};

export function ImportModal({ isOpen, onClose, onImportComplete }: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [uploadData, setUploadData] = useState<FileUploadData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorsModal, setShowErrorsModal] = useState(false);
  const [selectedRowErrors, setSelectedRowErrors] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { invalidateOpportunities } = useReportsSync();

  const resetState = useCallback(() => {
    setStep('upload');
    setUploadData(null);
    setMapping({});
    setValidationResult(null);
    setPreviewData(null);
    setImportStatus(null);
    setIsLoading(false);
    setShowErrorsModal(false);
    setSelectedRowErrors([]);
  }, []);

  const handleShowErrors = useCallback((errors: any[]) => {
    setSelectedRowErrors(errors);
    setShowErrorsModal(true);
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/import/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao fazer upload do arquivo');
      }

      const data: FileUploadData = await response.json();
      setUploadData(data);
      setMapping(data.autoMapping);
      setStep('mapping');

      toast({
        title: "Arquivo carregado com sucesso",
        description: `${data.rowCount} registros encontrados`,
      });
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const validateMapping = useCallback(async () => {
    if (!uploadData) return;

    setIsLoading(true);
    try {
      // Filter out unmapped fields
      const filteredMapping = Object.fromEntries(
        Object.entries(mapping).filter(([_, value]) => value && value !== 'unmapped')
      );

      const response = await fetch('/api/import/validate-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: uploadData.fileId,
          mapping: filteredMapping,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro na validação do mapeamento');
      }

      const result: ValidationResult = await response.json();
      setValidationResult(result);

      if (result.isValid) {
        setStep('preview');
        generatePreview();
      } else {
        toast({
          title: "Mapeamento inválido",
          description: result.errors.join(', '),
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro na validação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [uploadData, mapping, toast]);

  const generatePreview = useCallback(async () => {
    if (!uploadData) return;

    setIsLoading(true);
    try {
      // Filter out unmapped fields
      const filteredMapping = Object.fromEntries(
        Object.entries(mapping).filter(([_, value]) => value && value !== 'unmapped')
      );

      const response = await fetch('/api/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: uploadData.fileId,
          mapping: filteredMapping,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao gerar preview');
      }

      const data: PreviewData = await response.json();
      setPreviewData(data);
    } catch (error: any) {
      toast({
        title: "Erro no preview",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [uploadData, mapping, toast]);

  const executeImport = useCallback(async () => {
    if (!uploadData) return;

    setIsLoading(true);
    try {
      // Filter out unmapped fields
      const filteredMapping = Object.fromEntries(
        Object.entries(mapping).filter(([_, value]) => value && value !== 'unmapped')
      );

      const response = await fetch('/api/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: uploadData.fileId,
          mapping: filteredMapping,
          options: {
            skipInvalidRows: true,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao iniciar importação');
      }

      const data = await response.json();
      // Ensure results object is always defined
      if (!data.results) {
        data.results = {
          created: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
          errors: []
        };
      }
      setImportStatus(data);
      setStep('progress');

      // Poll for status updates
      pollImportStatus(data.importId);
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [uploadData, mapping, toast]);

  const pollImportStatus = useCallback(async (importId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/import/status/${importId}`);
        if (response.ok) {
          const status: ImportStatus = await response.json();
          setImportStatus(status);

          if (status.status === 'completed') {
            const created = status.results?.created || 0;
            toast({
              title: "Importação concluída",
              description: `${created} registros importados com sucesso`,
            });
            // Invalidate cache to refresh opportunities data
            invalidateOpportunities();
            onImportComplete?.();
          } else if (status.status === 'failed') {
            toast({
              title: "Importação falhou",
              description: status.error || 'Erro durante a importação',
              variant: "destructive",
            });
          }

          if (status.status === 'processing') {
            setTimeout(poll, 2000); // Poll every 2 seconds
          }
        }
      } catch (error) {
        console.error('Error polling import status:', error);
      }
    };

    poll();
  }, [toast, onImportComplete, invalidateOpportunities]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const getStepStatus = (stepName: ImportStep) => {
    const stepOrder: ImportStep[] = ['upload', 'mapping', 'preview', 'progress'];
    const currentIndex = stepOrder.indexOf(step);
    const stepIndex = stepOrder.indexOf(stepName);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="import-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            Importar Dados CSV/Excel
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded-lg mb-4">
          {[
            { step: 'upload', label: 'Upload', icon: Upload },
            { step: 'mapping', label: 'Mapeamento', icon: FileText },
            { step: 'preview', label: 'Preview', icon: BarChart3 },
            { step: 'progress', label: 'Importação', icon: Play },
          ].map(({ step: stepName, label, icon: Icon }, index) => {
            const status = getStepStatus(stepName as ImportStep);
            return (
              <div key={stepName} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2",
                    status === 'completed' && "bg-green-500 border-green-500 text-white",
                    status === 'current' && "bg-primary border-primary text-white",
                    status === 'pending' && "bg-muted border-muted-foreground text-muted-foreground"
                  )}
                >
                  {status === 'completed' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span className={cn("text-sm font-medium", status === 'current' && "text-primary")}>
                  {label}
                </span>
                {index < 3 && (
                  <div
                    className={cn(
                      "w-8 h-0.5 ml-2",
                      status === 'completed' ? "bg-green-500" : "bg-muted"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto">
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Selecionar Arquivo</CardTitle>
                  <CardDescription>
                    Faça upload de um arquivo CSV ou Excel (.xlsx, .xls) com os dados a serem importados.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="file-upload-area"
                  >
                    <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Arraste e solte o arquivo aqui</h3>
                    <p className="text-muted-foreground mb-4">ou clique para selecionar</p>
                    <Button variant="outline" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Selecionar Arquivo
                        </>
                      )}
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="file-input"
                  />
                </CardContent>
              </Card>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Formatos suportados:</strong> CSV, Excel (.xlsx, .xls)<br />
                  <strong>Tamanho máximo:</strong> 50MB<br />
                  <strong>Campos obrigatórios:</strong> Nome do Contato, Empresa, Telefone, Categoria da Necessidade, Necessidades do Cliente
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Mapping Step */}
          {step === 'mapping' && uploadData && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Mapeamento de Colunas</CardTitle>
                  <CardDescription>
                  Mapeie as colunas do seu arquivo para os campos do sistema.
                  Todos os campos são opcionais.
                </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {uploadData.columns.map((column) => (
                      <div key={column} className="grid grid-cols-3 gap-4 items-center">
                        <div className="font-medium">{column}</div>
                        <div>
                          <Select
                            value={mapping[column] || 'unmapped'}
                            onValueChange={(value) => {
                              setMapping(prev => ({ ...prev, [column]: value }));
                            }}
                          >
                            <SelectTrigger data-testid={`mapping-select-${column}`}>
                              <SelectValue placeholder="Selecione um campo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unmapped">Não mapear</SelectItem>
                              {Object.entries(FIELD_MAPPINGS).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                  {config.displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {uploadData.preview[0]?.[column] && (
                            <span>Ex: {String(uploadData.preview[0][column]).substring(0, 30)}...</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {validationResult && !validationResult.isValid && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {validationResult.errors.join('; ')}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Voltar
                </Button>
                <Button onClick={validateMapping} disabled={isLoading} data-testid="validate-mapping-btn">
                  {isLoading ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    'Continuar'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && previewData && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preview dos Dados</CardTitle>
                  <CardDescription>
                    Visualize como os dados serão importados. Verifique se as informações estão corretas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {previewData.validationSummary.validRows}
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">Registros Válidos</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {previewData.validationSummary.invalidRows}
                      </div>
                      <div className="text-sm text-red-600 dark:text-red-400">Registros Inválidos</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {previewData.validationSummary.totalRows}
                      </div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">Total de Registros</div>
                    </div>
                  </div>

                  <ScrollArea className="h-96 w-full border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Contato</TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.previewData.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {item.isValid ? (
                                <Badge variant="secondary" className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Válido
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Erro
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{item.transformed.contact || '-'}</TableCell>
                            <TableCell>{item.transformed.company || '-'}</TableCell>
                            <TableCell>{item.transformed.phone || '-'}</TableCell>
                            <TableCell>{item.transformed.needCategory || '-'}</TableCell>
                            <TableCell>
                              {!item.isValid && item.errors.length > 0 && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleShowErrors(item.errors)}
                                  data-testid={`view-errors-btn-${index}`}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Ver Erros ({item.errors.length})
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  {previewData.errors.length > 0 && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {previewData.errors.length} erros encontrados. Os registros com erro serão ignorados durante a importação.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  Voltar
                </Button>
                <Button onClick={executeImport} disabled={isLoading} data-testid="execute-import-btn">
                  {isLoading ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    'Importar Dados'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Progress Step */}
          {step === 'progress' && importStatus && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Progresso da Importação</CardTitle>
                  <CardDescription>
                    Acompanhe o progresso da importação dos seus dados.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progresso</span>
                        <span>{importStatus.progress}%</span>
                      </div>
                      <Progress value={importStatus.progress} className="w-full" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-xl font-bold text-green-600 dark:text-green-400">
                          {importStatus.results?.created || 0}
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">Criados</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                          {importStatus.results?.updated || 0}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">Atualizados</div>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                          {importStatus.results?.skipped || 0}
                        </div>
                        <div className="text-xs text-yellow-600 dark:text-yellow-400">Ignorados</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-xl font-bold text-red-600 dark:text-red-400">
                          {importStatus.results?.failed || 0}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400">Falharam</div>
                      </div>
                    </div>

                    {importStatus.status === 'completed' && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          Importação concluída com sucesso! {importStatus.results?.created || 0} registros foram importados.
                        </AlertDescription>
                      </Alert>
                    )}

                    {importStatus.status === 'failed' && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Falha na importação: {importStatus.error}
                        </AlertDescription>
                      </Alert>
                    )}

                    {importStatus.status === 'processing' && (
                      <div className="flex items-center justify-center py-4">
                        <Clock className="h-6 w-6 mr-2 animate-spin" />
                        <span>Processando registros...</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {importStatus.status === 'completed' && (
                <div className="flex justify-end">
                  <Button onClick={handleClose} data-testid="close-import-btn">
                    Fechar
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      {/* Modal de Erros */}
      <Dialog open={showErrorsModal} onOpenChange={setShowErrorsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Detalhes dos Erros de Validação
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-96">
            <div className="space-y-4">
              {selectedRowErrors.map((error, index) => (
                <Card key={index} className="border-red-200 dark:border-red-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      Linha {error.row}
                      <Badge variant="destructive" className="ml-auto">
                        {error.severity === 'error' ? 'Erro' : 'Aviso'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <strong>Campo:</strong> {error.field}
                      </div>
                      <div>
                        <strong>Coluna:</strong> {error.column}
                      </div>
                      <div>
                        <strong>Valor encontrado:</strong> 
                        <code className="ml-2 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                          {error.value || '(vazio)'}
                        </code>
                      </div>
                      <div>
                        <strong>Problema:</strong> {error.message}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <strong>Tipo de erro:</strong> {error.errorType === 'required' ? 'Campo obrigatório' : 'Formato inválido'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {selectedRowErrors.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum erro encontrado
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setShowErrorsModal(false)} data-testid="close-errors-modal">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}