import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useKanbanStore } from '@/hooks/useKanbanStore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SyncStatusProps {
  className?: string;
}

export default function SyncStatus({ className = '' }: SyncStatusProps) {
  const { syncStatus, connectWebSocket, disconnectWebSocket } = useKanbanStore();
  
  const getStatusIcon = () => {
    if (syncStatus.connected) {
      return <Wifi className="h-4 w-4 text-green-600" />;
    } else if (syncStatus.error) {
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    } else {
      return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };
  
  const getStatusBadge = () => {
    if (syncStatus.connected) {
      return (
        <Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
          Conectado
        </Badge>
      );
    } else if (syncStatus.error) {
      return (
        <Badge variant="outline" className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
          Erro
        </Badge>
      );
    } else if (syncStatus.reconnectAttempts > 0) {
      return (
        <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">
          Reconectando...
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800">
          Desconectado
        </Badge>
      );
    }
  };
  
  const getTooltipContent = () => {
    const parts = [];
    
    if (syncStatus.connected) {
      parts.push('✅ Sincronização em tempo real ativa');
    } else {
      parts.push('❌ Sincronização em tempo real inativa');
    }
    
    if (syncStatus.lastSync) {
      parts.push(`🕒 Última sincronização: ${format(syncStatus.lastSync, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}`);
    }
    
    if (syncStatus.error) {
      parts.push(`⚠️ Erro: ${syncStatus.error}`);
    }
    
    if (syncStatus.reconnectAttempts > 0) {
      parts.push(`🔄 Tentativas de reconexão: ${syncStatus.reconnectAttempts}/5`);
    }
    
    return parts.join('\n');
  };
  
  const handleReconnect = () => {
    if (syncStatus.connected) {
      disconnectWebSocket();
      setTimeout(() => connectWebSocket(), 500);
    } else {
      connectWebSocket();
    }
  };
  
  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 ${className}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              {getStatusBadge()}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <pre className="text-xs whitespace-pre-wrap">{getTooltipContent()}</pre>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReconnect}
              className="h-8 w-8 p-0"
              disabled={syncStatus.reconnectAttempts > 0}
            >
              <RefreshCw className={`h-3 w-3 ${
                syncStatus.reconnectAttempts > 0 ? 'animate-spin' : ''
              }`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {syncStatus.connected ? 'Reconectar' : 'Tentar conectar'}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// Componente compacto para uso em headers
export function CompactSyncStatus({ className = '' }: SyncStatusProps) {
  const { syncStatus } = useKanbanStore();
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 ${className}`}>
            {syncStatus.connected ? (
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            ) : (
              <div className="h-2 w-2 bg-red-500 rounded-full" />
            )}
            <span className="text-xs text-muted-foreground">
              {syncStatus.connected ? 'Sync' : 'Offline'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-xs">
            {syncStatus.connected ? (
              <span className="text-green-600">Sincronização ativa</span>
            ) : (
              <span className="text-red-600">Sincronização inativa</span>
            )}
            {syncStatus.lastSync && (
              <div className="mt-1 text-muted-foreground">
                Última: {format(syncStatus.lastSync, 'HH:mm:ss')}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}