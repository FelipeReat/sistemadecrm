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
  
  addOpportunity: (opportunity) => set((state) => {
    console.log('🔄 Store: Adicionando oportunidade:', opportunity.id, opportunity.title);
    console.log('📊 Store: Estado antes da adição:', state.opportunities.length, 'oportunidades');
    const newState = [...state.opportunities, opportunity];
    console.log('📊 Store: Estado após adição:', newState.length, 'oportunidades');
    return { opportunities: newState };
  }),
  
  updateOpportunity: (id, updates) => set((state) => {
    const newState = state.opportunities.map(opp => 
      opp.id === id ? { ...opp, ...updates } : opp
    );
    return { opportunities: newState };
  }),
  
  removeOpportunity: (id) => set((state) => {
    console.log('🔄 Store: Removendo oportunidade:', id);
    console.log('📊 Store: Estado antes da remoção:', state.opportunities.length, 'oportunidades');
    const newState = state.opportunities.filter(opp => opp.id !== id);
    console.log('📊 Store: Estado após remoção:', newState.length, 'oportunidades');
    return { opportunities: newState };
  }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  // Ações para WebSocket
  connectWebSocket: () => {
    const { ws, syncStatus } = get();
    
    // Evitar múltiplas conexões
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('🔌 WebSocket já conectado, ignorando nova conexão');
      return;
    }
    
    try {
      // Usar configuração centralizada para WebSocket
      const wsUrl = config.websocket.getUrl();
      
      console.log('🔌 Conectando ao WebSocket:', wsUrl);
      
      const newWs = new WebSocket(wsUrl);
      
      newWs.onopen = () => {
        console.log('✅ WebSocket conectado com sucesso');
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
        const subscribeMessage = {
          type: 'subscribe:opportunities',
          timestamp: new Date().toISOString(),
        };
        console.log('📡 Enviando subscrição:', subscribeMessage);
        newWs.send(JSON.stringify(subscribeMessage));
      };
      
      newWs.onmessage = (event) => {
        console.log('📨 Mensagem WebSocket recebida:', event.data);
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📋 Mensagem parseada:', message);
          
          if (message.type === 'opportunity:change' && message.data) {
            console.log('🔄 Processando mudança de oportunidade:', message.data);
            get().handleWebSocketMessage(message.data);
          } else if (message.type === 'pong') {
            console.log('🏓 Pong recebido');
            // Resposta ao ping - atualizar lastSync
            set((state) => ({
              syncStatus: {
                ...state.syncStatus,
                lastSync: new Date(),
              }
            }));
          } else if (message.type === 'connection:established') {
            console.log('✅ Conexão estabelecida:', message.data?.message);
          } else if (message.type === 'subscription:confirmed') {
            console.log('✅ Subscrição confirmada para canal:', message.data?.channel);
          } else {
            console.log('📨 Tipo de mensagem não reconhecido:', message.type);
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
    console.log('📋 Detalhes da notificação:', {
      operation: notification.operation,
      table: notification.table,
      hasData: !!notification.data,
      hasOldData: !!notification.old_data,
      phaseChanged: notification.phase_changed,
      timestamp: notification.timestamp
    });
    
    const { operation, data, old_data } = notification;
    
    switch (operation) {
      case 'INSERT':
        if (data) {
          console.log('➕ Adicionando oportunidade ao store:', data.id);
          get().addOpportunity(data);
          console.log('✅ Oportunidade adicionada com sucesso');
        } else {
          console.warn('⚠️ INSERT sem dados');
        }
        break;
        
      case 'UPDATE':
        if (data) {
          console.log('✏️ Atualizando oportunidade no store:', data.id);
          get().updateOpportunity(data.id, data);
          console.log('✅ Oportunidade atualizada com sucesso');
          
          // Log especial para mudanças de fase
          if (notification.phase_changed && old_data) {
            console.log(`🔄 Fase alterada: ${old_data.phase} → ${data.phase}`);
          }
        } else {
          console.warn('⚠️ UPDATE sem dados');
        }
        break;
        
      case 'DELETE':
        if (old_data) {
          console.log('🗑️ Removendo oportunidade do store:', old_data.id);
          get().removeOpportunity(old_data.id);
          console.log('✅ Oportunidade removida com sucesso');
        } else {
          console.warn('⚠️ DELETE sem old_data');
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
    
    // Log do estado atual do store após a atualização
    const currentOpportunities = get().opportunities;
    console.log(`📊 Estado atual do store: ${currentOpportunities.length} oportunidades`);
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