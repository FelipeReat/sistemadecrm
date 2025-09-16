
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
      const formData = new FormData();
      formData.append('document', file);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin', // Include session cookies
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro no servidor' }));
        throw new Error(errorData.message || 'Erro ao fazer upload');
      }

      const uploadedFile: UploadedFile = await response.json();
      
      // Ensure all required fields are present
      if (!uploadedFile.url) {
        uploadedFile.url = `/uploads/documents/${uploadedFile.filename || uploadedFile.name}`;
      }
      if (!uploadedFile.size) {
        uploadedFile.size = file.size;
      }
      if (!uploadedFile.type) {
        uploadedFile.type = file.type;
      }

      toast({
        title: "Sucesso",
        description: `Arquivo "${file.name}" enviado com sucesso!`,
      });

      return uploadedFile;
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao fazer upload do arquivo.",
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
