import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mail, 
  Save, 
  Plus, 
  Trash2, 
  Eye, 
  Code, 
  FileText,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'welcome' | 'password_reset' | 'notification' | 'custom';
  variables: string[];
  created_at: string;
  updated_at: string;
}

const EMAIL_TEMPLATE_TYPES = [
  { value: 'welcome', label: 'Boas-vindas' },
  { value: 'password_reset', label: 'Redefinição de Senha' },
  { value: 'notification', label: 'Notificação' },
  { value: 'custom', label: 'Personalizado' }
];

const AVAILABLE_VARIABLES = [
  '{{user_name}}',
  '{{user_email}}',
  '{{company_name}}',
  '{{reset_link}}',
  '{{login_url}}',
  '{{current_date}}',
  '{{support_email}}'
];

export function EmailTemplateEditor() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    type: 'custom' as EmailTemplate['type']
  });

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/email/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      } else {
        toast({
          title: "Erro",
          description: "Erro ao carregar templates de email",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar templates de email",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      type: template.type
    });
    setIsEditing(false);
    setPreviewMode('edit');
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setFormData({
      name: '',
      subject: '',
      body: '',
      type: 'custom'
    });
    setIsEditing(true);
    setPreviewMode('edit');
  };

  const handleEditTemplate = () => {
    setIsEditing(true);
  };

  const handleSaveTemplate = async () => {
    if (!formData.name.trim() || !formData.subject.trim() || !formData.body.trim()) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const url = selectedTemplate 
        ? `/api/email/templates/${selectedTemplate.id}`
        : '/api/email/templates';
      
      const method = selectedTemplate ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const savedTemplate = await response.json();
        
        if (selectedTemplate) {
          setTemplates(prev => prev.map(t => 
            t.id === selectedTemplate.id ? savedTemplate : t
          ));
          setSelectedTemplate(savedTemplate);
        } else {
          setTemplates(prev => [...prev, savedTemplate]);
          setSelectedTemplate(savedTemplate);
        }
        
        setIsEditing(false);
        toast({
          title: "Sucesso",
          description: "Template salvo com sucesso!"
        });
      } else {
        toast({
          title: "Erro",
          description: "Erro ao salvar template",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar template",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) {
      return;
    }

    try {
      const response = await fetch(`/api/email/templates/${templateId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setTemplates(prev => prev.filter(t => t.id !== templateId));
        if (selectedTemplate?.id === templateId) {
          setSelectedTemplate(null);
          setFormData({ name: '', subject: '', body: '', type: 'custom' });
        }
        toast({
          title: "Sucesso",
          description: "Template excluído com sucesso!"
        });
      } else {
        toast({
          title: "Erro",
          description: "Erro ao excluir template",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir template",
        variant: "destructive"
      });
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = formData.body.substring(0, start) + variable + formData.body.substring(end);
      setFormData(prev => ({ ...prev, body: newBody }));
      
      // Restore cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();
      }, 0);
    }
  };

  const renderPreview = () => {
    let previewBody = formData.body;
    
    // Replace variables with sample data for preview
    const sampleData: Record<string, string> = {
      '{{user_name}}': 'João Silva',
      '{{user_email}}': 'joao@exemplo.com',
      '{{company_name}}': 'Minha Empresa',
      '{{reset_link}}': 'https://exemplo.com/reset/123',
      '{{login_url}}': 'https://exemplo.com/login',
      '{{current_date}}': new Date().toLocaleDateString('pt-BR'),
      '{{support_email}}': 'suporte@exemplo.com'
    };

    Object.entries(sampleData).forEach(([variable, value]) => {
      previewBody = previewBody.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Assunto:</Label>
          <div className="mt-1 p-3 bg-muted rounded-md">
            {formData.subject || 'Sem assunto'}
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium">Corpo do Email:</Label>
          <div className="mt-1 p-4 bg-muted rounded-md min-h-[300px] whitespace-pre-wrap">
            {previewBody || 'Corpo do email vazio'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Templates de Email</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os templates de email do sistema
          </p>
        </div>
        <Button onClick={handleNewTemplate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum template encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{template.name}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {template.subject}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {EMAIL_TEMPLATE_TYPES.find(t => t.value === template.type)?.label}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(template.id);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Editor/Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Code className="h-4 w-4" />
                      {selectedTemplate ? 'Editar Template' : 'Novo Template'}
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Visualizar Template
                    </>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {selectedTemplate && !isEditing && (
                    <Button variant="outline" onClick={handleEditTemplate}>
                      Editar
                    </Button>
                  )}
                  {isEditing && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        disabled={isSaving}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleSaveTemplate}
                        disabled={isSaving}
                        className="flex items-center gap-2"
                      >
                        {isSaving ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Salvar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedTemplate && !isEditing ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione um template para visualizar ou criar um novo</p>
                </div>
              ) : (
                <Tabs value={previewMode} onValueChange={(value) => setPreviewMode(value as 'edit' | 'preview')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="edit">Editor</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="edit" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="template-name">Nome do Template</Label>
                        <Input
                          id="template-name"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: Email de Boas-vindas"
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <Label htmlFor="template-type">Tipo</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as EmailTemplate['type'] }))}
                          disabled={!isEditing}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EMAIL_TEMPLATE_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="template-subject">Assunto</Label>
                      <Input
                        id="template-subject"
                        value={formData.subject}
                        onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                        placeholder="Assunto do email"
                        disabled={!isEditing}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="template-body">Corpo do Email</Label>
                        {isEditing && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Variáveis:</span>
                            {AVAILABLE_VARIABLES.map((variable) => (
                              <Button
                                key={variable}
                                variant="outline"
                                size="sm"
                                onClick={() => insertVariable(variable)}
                                className="text-xs h-6 px-2"
                              >
                                {variable}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Textarea
                        id="template-body"
                        value={formData.body}
                        onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                        placeholder="Corpo do email..."
                        className="min-h-[300px] font-mono text-sm"
                        disabled={!isEditing}
                      />
                    </div>

                    {isEditing && (
                      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium">Dicas para usar variáveis:</p>
                          <ul className="mt-1 space-y-1 text-xs">
                            <li>• Use as variáveis disponíveis para personalizar o conteúdo</li>
                            <li>• As variáveis serão substituídas pelos valores reais no envio</li>
                            <li>• Clique nas variáveis acima para inseri-las no cursor</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="preview">
                    {renderPreview()}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}