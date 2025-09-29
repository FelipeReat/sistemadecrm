import React from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Opportunity } from '@shared/schema';
import { config } from '@/lib/config';

// Tipos para o WebSocket
export interface OpportunityChangeNotification {
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  data?: Opportunity;
  old_data?: Opportunity;
  timestamp: string;
  user_id?: string;
  phase_changed?: boolean;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: string;
}

export interface SyncStatus {
  connected: boolean;
  lastSync: Date | null;
  error: string | null;
  reconnectAttempts: number;
}

interface KanbanStore {
  // Estado das oportunidades
  opportunities: Opportunity[];
  isLoading: boolean;
  error: string | null;
  
  // Estado do WebSocket
  ws: WebSocket | null;
  syncStatus: SyncStatus;
  
  // Ações para oportunidades
  setOpportunities: (opportunities: Opportunity[]) => void;
  addOpportunity: (opportunity: Opportunity) => void;
  updateOpportunity: (id: string, updates: Partial<Opportunity>) => void;
  removeOpportunity: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Ações para WebSocket
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  sendMessage: (message: WebSocketMessage) => void;
  handleWebSocketMessage: (notification: OpportunityChangeNotification) => void;
  
  // Ações para sincronização
  setSyncStatus: (status: Partial<SyncStatus>) => void;
  resetSyncStatus: () => void;
}

const initialSyncStatus: SyncStatus = {
  connected: false,
  lastSync: null,
  error: null,
  reconnectAttempts: 0,
};

export const useKanbanStore = create<KanbanStore>()(subscribeWithSelector((set, get) => ({
  // Estado inicial
  opportunities: [],
  isLoading: false,
  error: null,
  ws: null,
  syncStatus: initialSyncStatus,
  
  // Ações para oportunidades
  setOpportunities: (opportunities) => set({ opportunities }),
  
  addOpportunity: (opportunity) => set((state) => ({
    opportunities: [...state.opportunities, opportunity],
  })),
  
  updateOpportunity: (id, updates) => set((state) => ({
    opportunities: state.opportunities.map(opp => 
      opp.id === id ? { ...opp, ...updates } : opp
    ),
  })),
  
  removeOpportunity: (id) => set((state) => ({
    opportunities: state.opportunities.filter(opp => opp.id !== id),
  })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  // Ações para WebSocket
  connectWebSocket: () => {
    const { ws, syncStatus } = get();
    
    // Evitar múltiplas conexões
    if (ws && ws.readyState === WebSocket.OPEN) {
      return;
    }
    
    try {
      // Usar configuração centralizada para WebSocket
      const wsUrl = config.websocket.getUrl();
      
      console.log('🔌 Conectando ao WebSocket:', wsUrl);
      
      const newWs = new WebSocket(wsUrl);
      
      newWs.onopen = () => {
        console.log('✅ WebSocket conectado');
        set({ 
          ws: newWs,
          syncStatus: {
            ...syncStatus,
            connected: true,
            error: null,
            lastSync: new Date(),
            reconnectAttempts: 0,
          }
        });
        
        // Subscrever às atualizações de oportunidades
        newWs.send(JSON.stringify({
          type: 'subscribe:opportunities',
          timestamp: new Date().toISOString(),
        }));
      };
      
      newWs.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'opportunity:change' && message.data) {
            get().handleWebSocketMessage(message.data);
          } else if (message.type === 'pong') {
            // Resposta ao ping - atualizar lastSync
            set((state) => ({
              syncStatus: {
                ...state.syncStatus,
                lastSync: new Date(),
              }
            }));
          }
        } catch (error) {
          console.error('❌ Erro ao processar mensagem WebSocket:', error);
        }
      };
      
      newWs.onclose = (event) => {
        console.log('🔌 WebSocket desconectado:', event.code, event.reason);
        
        set((state) => ({
          ws: null,
          syncStatus: {
            ...state.syncStatus,
            connected: false,
            error: event.code !== 1000 ? `Conexão perdida (${event.code})` : null,
          }
        }));
        
        // Tentar reconectar automaticamente (máximo 5 tentativas)
        const currentAttempts = get().syncStatus.reconnectAttempts;
        if (currentAttempts < 5 && event.code !== 1000) {
          setTimeout(() => {
            console.log(`🔄 Tentativa de reconexão ${currentAttempts + 1}/5`);
            set((state) => ({
              syncStatus: {
                ...state.syncStatus,
                reconnectAttempts: currentAttempts + 1,
              }
            }));
            get().connectWebSocket();
          }, Math.pow(2, currentAttempts) * 1000); // Backoff exponencial
        }
      };
      
      newWs.onerror = (error) => {
        console.error('❌ Erro no WebSocket:', error);
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            error: 'Erro de conexão WebSocket',
          }
        }));
      };
      
    } catch (error) {
      console.error('❌ Erro ao criar WebSocket:', error);
      set((state) => ({
        syncStatus: {
          ...state.syncStatus,
          error: 'Falha ao inicializar WebSocket',
        }
      }));
    }
  },
  
  disconnectWebSocket: () => {
    const { ws } = get();
    if (ws) {
      ws.close(1000, 'Desconexão manual');
      set({ 
        ws: null,
        syncStatus: initialSyncStatus,
      });
    }
  },
  
  sendMessage: (message) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket não conectado, não é possível enviar mensagem');
    }
  },
  
  handleWebSocketMessage: (notification) => {
    console.log('📨 Notificação recebida:', notification);
    
    const { operation, data, old_data } = notification;
    
    switch (operation) {
      case 'INSERT':
        if (data) {
          get().addOpportunity(data);
          console.log('➕ Oportunidade adicionada:', data.id);
        }
        break;
        
      case 'UPDATE':
        if (data) {
          get().updateOpportunity(data.id, data);
          console.log('✏️ Oportunidade atualizada:', data.id);
          
          // Log especial para mudanças de fase
          if (notification.phase_changed && old_data) {
            console.log(`🔄 Fase alterada: ${old_data.phase} → ${data.phase}`);
          }
        }
        break;
        
      case 'DELETE':
        if (old_data) {
          get().removeOpportunity(old_data.id);
          console.log('🗑️ Oportunidade removida:', old_data.id);
        }
        break;
        
      default:
        console.warn('⚠️ Operação desconhecida:', operation);
    }
    
    // Atualizar timestamp da última sincronização
    set((state) => ({
      syncStatus: {
        ...state.syncStatus,
        lastSync: new Date(),
      }
    }));
  },
  
  setSyncStatus: (status) => set((state) => ({
    syncStatus: { ...state.syncStatus, ...status },
  })),
  
  resetSyncStatus: () => set({ syncStatus: initialSyncStatus }),
})));

// Hook para monitorar mudanças de conexão
export const useWebSocketConnection = () => {
  const { connectWebSocket, disconnectWebSocket, syncStatus } = useKanbanStore();
  
  // Conectar automaticamente quando o componente monta
  React.useEffect(() => {
    connectWebSocket();
    
    // Cleanup na desmontagem
    return () => {
      disconnectWebSocket();
    };
  }, [connectWebSocket, disconnectWebSocket]);
  
  return syncStatus;
};

// Hook para ping periódico (manter conexão viva)
export const useWebSocketHeartbeat = () => {
  const { sendMessage, syncStatus } = useKanbanStore();
  
  React.useEffect(() => {
    if (!syncStatus.connected) return;
    
    const interval = setInterval(() => {
      sendMessage({
        type: 'ping',
        timestamp: new Date().toISOString(),
      });
    }, 30000); // Ping a cada 30 segundos
    
    return () => clearInterval(interval);
  }, [sendMessage, syncStatus.connected]);
};