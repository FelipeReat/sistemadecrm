
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    setUploading(true);
    
    try {
      // Simular upload - em produção seria para um serviço real
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const uploadedFile: UploadedFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file) // Em produção seria a URL real do arquivo
      };

      toast({
        title: "Sucesso",
        description: `Arquivo "${file.name}" enviado com sucesso!`,
      });

      return uploadedFile;
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao fazer upload do arquivo.",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const uploadMultipleFiles = async (files: FileList): Promise<UploadedFile[]> => {
    const uploadedFiles: UploadedFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const uploadedFile = await uploadFile(files[i]);
      if (uploadedFile) {
        uploadedFiles.push(uploadedFile);
      }
    }
    
    return uploadedFiles;
  };

  return {
    uploading,
    uploadFile,
    uploadMultipleFiles
  };
}
