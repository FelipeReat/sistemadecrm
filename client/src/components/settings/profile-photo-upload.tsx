import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, X, Loader2, User } from 'lucide-react';

interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string;
  userName: string;
  onPhotoUpdate?: (newPhotoUrl: string) => void;
}

export function ProfilePhotoUpload({ 
  currentPhotoUrl, 
  userName, 
  onPhotoUpdate 
}: ProfilePhotoUploadProps) {
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Erro",
        description: "Tipo de arquivo não permitido. Use JPG, PNG ou GIF.",
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho do arquivo (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: "Erro",
        description: "Arquivo muito grande. Tamanho máximo: 5MB.",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);

    // Criar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Erro",
        description: "Selecione uma foto primeiro.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', selectedFile);

      const response = await fetch('/api/user/profile/photo', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Sucesso",
          description: "Foto de perfil atualizada com sucesso!"
        });
        
        // Atualizar a URL da foto
        if (onPhotoUpdate) {
          onPhotoUpdate(data.photoUrl);
        }
        
        // Limpar arquivo selecionado
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const error = await response.json();
        toast({
          title: "Erro",
          description: error.message || "Erro ao fazer upload da foto",
          variant: "destructive"
        });
        
        // Reverter preview em caso de erro
        setPreviewUrl(currentPhotoUrl || null);
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload da foto de perfil",
        variant: "destructive"
      });
      
      // Reverter preview em caso de erro
      setPreviewUrl(currentPhotoUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setUploading(true);
    try {
      const response = await fetch('/api/user/profile/photo', {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Foto de perfil removida com sucesso!"
        });
        setPreviewUrl(null);
        setSelectedFile(null);
        
        if (onPhotoUpdate) {
          onPhotoUpdate('');
        }
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const error = await response.json();
        toast({
          title: "Erro",
          description: error.message || "Erro ao remover foto",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover foto de perfil",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCancelPreview = () => {
    setPreviewUrl(currentPhotoUrl || null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Foto de Perfil
        </CardTitle>
        <CardDescription>
          Atualize sua foto de perfil. Formatos aceitos: JPG, PNG, GIF (máx. 5MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview da Foto */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Avatar className="h-32 w-32">
              <AvatarImage src={previewUrl || undefined} alt={userName} />
              <AvatarFallback className="text-2xl">
                {previewUrl ? <User className="h-12 w-12" /> : getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            
            {/* Indicador de mudança */}
            {selectedFile && (
              <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
                <Upload className="h-4 w-4" />
              </div>
            )}
          </div>

          {/* Nome do usuário */}
          <div className="text-center">
            <p className="font-medium">{userName}</p>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Nova foto selecionada: {selectedFile.name}
              </p>
            )}
          </div>
        </div>

        {/* Input de arquivo (oculto) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!selectedFile ? (
            <>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Selecionar Foto
              </Button>
              
              {previewUrl && (
                <Button
                  variant="destructive"
                  onClick={handleRemovePhoto}
                  disabled={uploading}
                  className="flex items-center gap-2"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  Remover Foto
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-2"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Salvar Foto
              </Button>
              
              <Button
                variant="outline"
                onClick={handleCancelPreview}
                disabled={uploading}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Escolher Outra
              </Button>
            </>
          )}
        </div>

        {/* Informações sobre limites */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>Formatos aceitos: JPG, PNG, GIF</p>
          <p>Tamanho máximo: 5MB</p>
          <p>Recomendado: imagem quadrada (ex: 400x400px)</p>
        </div>
      </CardContent>
    </Card>
  );
}