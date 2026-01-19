import { useState, useRef, useEffect } from 'react';
import { CloudUpload, X, FileText, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFileUpload, type UploadedFile } from '@/hooks/useFileUpload';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  onFilesChange?: (files: UploadedFile[]) => void;
  value?: UploadedFile[];
  className?: string;
  placeholder?: string;
  'data-testid'?: string;
  enableGlobalPaste?: boolean;
}

export function FileUpload({
  accept = "image/*,.pdf,.doc,.docx",
  multiple = false,
  maxFiles = 5,
  onFilesChange,
  value = [],
  className,
  placeholder = "Clique para fazer upload ou arraste arquivos aqui (ou cole com Ctrl+V)",
  'data-testid': testId,
  enableGlobalPaste = false,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploading, uploadMultipleFiles } = useFileUpload();

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const remainingSlots = multiple ? maxFiles - value.length : 1;
    const filesToUpload = fileArray.slice(0, remainingSlots);

    if (filesToUpload.length < fileArray.length) {
      // Toast warning about file limit
    }

    try {
      const uploadedFiles = await uploadMultipleFiles(filesToUpload as unknown as FileList);

      if (multiple) {
        const currentFiles = [...value];
        // Ensure each uploaded file has the correct format for the schema
        const formattedFiles = uploadedFiles.map(uploadedFile => ({
          id: uploadedFile.id,
          name: uploadedFile.name,
          size: uploadedFile.size || 0,
          type: uploadedFile.type || 'application/octet-stream',
          url: uploadedFile.url || `/uploads/documents/${uploadedFile.filename || uploadedFile.name}`
        }));
        onFilesChange?.([...currentFiles, ...formattedFiles]);
      } else {
        // Ensure the uploaded file has the correct format for the schema
        if (uploadedFiles.length > 0) {
          const uploadedFile = uploadedFiles[0];
          const formattedFile = {
            id: uploadedFile.id,
            name: uploadedFile.name,
            size: uploadedFile.size || 0,
            type: uploadedFile.type || 'application/octet-stream',
            url: uploadedFile.url || `/uploads/documents/${uploadedFile.filename || uploadedFile.name}`
          };
          onFilesChange?.([formattedFile]);
        }
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  // Handle global paste events
  useEffect(() => {
    if (!enableGlobalPaste) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (uploading) return;
      
      // Check if the paste event contains files
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        e.preventDefault();
        handleFileSelect(e.clipboardData.files);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [enableGlobalPaste, uploading, multiple, maxFiles, value, onFilesChange]); // Dependencies for the effect

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (fileId: string) => {
    const updatedFiles = value.filter(file => file.id !== fileId);
    onFilesChange?.(updatedFiles);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
          isDragOver ? "border-primary bg-primary/10" : "border-gray-300 hover:border-gray-400",
          uploading && "opacity-50 cursor-not-allowed"
        )}
        onClick={!uploading ? handleClick : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid={testId}
      >
        <CloudUpload className={cn(
          "mx-auto mb-2",
          isDragOver ? "text-primary" : "text-gray-400",
          uploading ? "animate-pulse" : ""
        )} size={32} />
        <p className="text-sm text-gray-500">
          {uploading ? "Enviando arquivos..." : placeholder}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {/* Lista de arquivos enviados */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
            >
              <div className="flex items-center space-x-2">
                {getFileIcon(file.type)}
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(file.id)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}