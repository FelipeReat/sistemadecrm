import postgres from 'postgres';
import { EventEmitter } from 'events';

export interface OpportunityChangeNotification {
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  data: any;
  old_data?: any;
  timestamp: string;
  user_id?: string;
  phase_changed?: boolean;
}

export class PostgreSQLListener extends EventEmitter {
  private sql: postgres.Sql | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 segundos

  constructor(private connectionString: string) {
    super();
  }

  async connect(): Promise<void> {
    try {
      console.log('🔗 Conectando ao PostgreSQL para LISTEN...');
      
      // Configurar conexão SSL mais permissiva
      let cleanDbUrl = this.connectionString.replace(/[?&]ssl(mode)?=[^&]*/g, '');
      cleanDbUrl += cleanDbUrl.includes('?') ? '&sslmode=prefer' : '?sslmode=prefer';
      
      this.sql = postgres(cleanDbUrl, {
        max: 1, // Uma conexão dedicada para LISTEN
        ssl: 'prefer', // Usar SSL se disponível, mas não obrigatório
        connect_timeout: 60,
        idle_timeout: 0, // Manter conexão ativa para LISTEN
        max_lifetime: 0, // Não fechar conexão automaticamente
        onnotice: (notice) => {
          // Processar notificações NOTIFY
          if (notice.severity === 'NOTICE') {
            console.log('📢 PostgreSQL NOTICE:', notice.message);
          }
        }
      });

      // Testar conexão
      await this.sql`SELECT 1`;
      
      // Configurar LISTEN para o canal de oportunidades
      await this.sql`LISTEN opportunity_changes`;
      
      console.log('✅ PostgreSQL Listener conectado e escutando canal "opportunity_changes"');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Configurar handler para notificações
      this.setupNotificationHandler();
      
    } catch (error) {
      console.error('❌ Erro ao conectar PostgreSQL Listener:', error);
      this.isConnected = false;
      
      // Tentar reconectar
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${this.reconnectDelay}ms...`);
        setTimeout(() => this.connect(), this.reconnectDelay);
      } else {
        console.error('❌ Máximo de tentativas de reconexão atingido');
        this.emit('error', error);
      }
    }
  }

  private setupNotificationHandler() {
    if (!this.sql) return;

    // PostgreSQL NOTIFY handler
    this.sql.listen('opportunity_changes', (payload) => {
      try {
        console.log('📢 Notificação PostgreSQL recebida:', payload);
        
        // Parse do payload JSON
        const notification: OpportunityChangeNotification = JSON.parse(payload);
        
        console.log('📋 Dados da notificação:', {
          operation: notification.operation,
          table: notification.table,
          hasData: !!notification.data,
          phaseChanged: notification.phase_changed,
          timestamp: notification.timestamp
        });
        
        // Emitir evento para o WebSocket Manager
        this.emit('opportunity:change', notification);
        
      } catch (error) {
        console.error('❌ Erro ao processar notificação PostgreSQL:', error);
        console.error('📋 Payload recebido:', payload);
      }
    });

    (this.sql as any).on?.('error', (error: any) => {
      console.error('❌ Erro na conexão PostgreSQL:', error);
      this.isConnected = false;
      setTimeout(() => this.connect(), this.reconnectDelay);
    });
  }

  async disconnect(): Promise<void> {
    if (this.sql && this.isConnected) {
      try {
        console.log('🔌 Desconectando PostgreSQL Listener...');
        await this.sql`UNLISTEN opportunity_changes`;
        await this.sql.end();
        this.isConnected = false;
        console.log('✅ PostgreSQL Listener desconectado');
      } catch (error) {
        console.error('❌ Erro ao desconectar PostgreSQL Listener:', error);
      }
    }
  }

  getStatus() {
    try {
      console.log('🔍 PostgreSQLListener.getStatus() - Iniciando...');
      
      console.log('🔍 Coletando status de conexão...');
      const connected = this.isConnected;
      
      console.log('🔍 Coletando tentativas de reconexão...');
      const attempts = this.reconnectAttempts;
      
      console.log('🔍 Coletando máximo de tentativas...');
      const maxAttempts = this.maxReconnectAttempts;
      
      const status = {
        connected,
        reconnectAttempts: attempts,
        maxReconnectAttempts: maxAttempts
      };
      
      console.log('🔍 PostgreSQLListener.getStatus() - Concluído com sucesso');
      return status;
    } catch (error) {
      console.error('❌ Erro ao obter status do PostgreSQL Listener:', error);
      return {
        connected: false,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5
      };
    }
  }

  // Método para testar a conexão
  async testConnection(): Promise<boolean> {
    if (!this.sql || !this.isConnected) {
      return false;
    }

    try {
      await this.sql`SELECT 1`;
      return true;
    } catch (error) {
      console.error('❌ Teste de conexão falhou:', error);
      this.isConnected = false;
      return false;
    }
  }

  // Método para forçar reconexão
  async forceReconnect(): Promise<void> {
    console.log('🔄 Forçando reconexão...');
    await this.disconnect();
    this.reconnectAttempts = 0;
    await this.connect();
  }
}
