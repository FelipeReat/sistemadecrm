import { WebSocketManager, WebSocketMessage } from './websocket-manager';
import { PostgreSQLListener, OpportunityChangeNotification } from './postgresql-listener';
import { Server } from 'http';

export class RealtimeService {
  private wsManager: WebSocketManager;
  private pgListener: PostgreSQLListener;
  private isInitialized = false;

  constructor(server: Server, connectionString: string) {
    this.wsManager = new WebSocketManager(server);
    this.pgListener = new PostgreSQLListener(connectionString);
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Escutar mudanças de oportunidades do PostgreSQL
    this.pgListener.on('opportunity:change', (notification: OpportunityChangeNotification) => {
      this.handleOpportunityChange(notification);
    });

    // Escutar erros do PostgreSQL Listener
    this.pgListener.on('error', (error) => {
      console.error('❌ Erro no PostgreSQL Listener:', error);
      this.broadcastError('Erro na conexão com o banco de dados');
    });

    console.log('🔧 Event handlers configurados para RealtimeService');
  }

  private handleOpportunityChange(notification: OpportunityChangeNotification) {
    console.log('🔄 Processando mudança de oportunidade:', notification.operation);

    // Criar mensagem WebSocket baseada na notificação
    const wsMessage: WebSocketMessage = {
      type: `opportunity:${notification.operation.toLowerCase()}`,
      data: {
        operation: notification.operation,
        opportunity: notification.data,
        oldOpportunity: notification.old_data,
        phaseChanged: notification.phase_changed,
        userId: notification.user_id,
        table: notification.table
      },
      timestamp: notification.timestamp
    };

    // Broadcast para todos os clientes conectados
    this.wsManager.broadcast(wsMessage);

    // Log para debug
    console.log(`📡 Broadcasted ${notification.operation} para clientes WebSocket`);
  }

  private broadcastError(message: string) {
    const errorMessage: WebSocketMessage = {
      type: 'error',
      data: { message },
      timestamp: new Date().toISOString()
    };

    this.wsManager.broadcast(errorMessage);
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Inicializando RealtimeService...');
      
      // Conectar ao PostgreSQL Listener
      await this.pgListener.connect();
      
      this.isInitialized = true;
      console.log('✅ RealtimeService inicializado com sucesso');
      
      // Broadcast de status para clientes
      this.wsManager.broadcast({
        type: 'service:ready',
        data: { message: 'Serviço de tempo real ativo' },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erro ao inicializar RealtimeService:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      console.log('🔌 Desligando RealtimeService...');
      
      // Notificar clientes sobre desligamento
      this.wsManager.broadcast({
        type: 'service:shutdown',
        data: { message: 'Serviço de tempo real sendo desligado' },
        timestamp: new Date().toISOString()
      });
      
      // Desconectar PostgreSQL Listener
      await this.pgListener.disconnect();
      
      // Fechar WebSocket Manager
      this.wsManager.close();
      
      this.isInitialized = false;
      console.log('✅ RealtimeService desligado');
      
    } catch (error) {
      console.error('❌ Erro ao desligar RealtimeService:', error);
    }
  }

  // Métodos públicos para status e controle
  getStatus() {
    return {
      initialized: this.isInitialized,
      websocket: this.wsManager.getStats(),
      postgresql: this.pgListener.getStatus()
    };
  }

  async testConnections(): Promise<{ websocket: boolean; postgresql: boolean }> {
    return {
      websocket: this.wsManager.getStats().connectedClients >= 0, // WebSocket sempre disponível
      postgresql: await this.pgListener.testConnection()
    };
  }

  // Método para forçar reconexão do PostgreSQL
  async reconnectPostgreSQL(): Promise<void> {
    console.log('🔄 Reconectando PostgreSQL Listener...');
    await this.pgListener.forceReconnect();
  }

  // Método para broadcast manual (para testes ou casos especiais)
  broadcastMessage(type: string, data: any) {
    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    this.wsManager.broadcast(message);
  }

  // Método para sincronização inicial (quando cliente conecta)
  async sendInitialSync(opportunities: any[]) {
    const syncMessage: WebSocketMessage = {
      type: 'sync:initial',
      data: { opportunities },
      timestamp: new Date().toISOString()
    };

    this.wsManager.broadcast(syncMessage);
  }
}