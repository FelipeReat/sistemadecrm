import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { EventEmitter } from 'events';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export class WebSocketManager extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(server: Server) {
    super();
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔌 Nova conexão WebSocket estabelecida');
      }
      
      // Adicionar cliente à lista
      this.clients.add(ws);

      // Enviar mensagem de boas-vindas
      this.sendToClient(ws, {
        type: 'connection:established',
        data: { message: 'Conectado ao servidor de tempo real' },
        timestamp: new Date().toISOString()
      });

      // Configurar handlers para mensagens do cliente
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('❌ Erro ao processar mensagem do cliente:', error);
          this.sendToClient(ws, {
            type: 'error',
            data: { message: 'Formato de mensagem inválido' },
            timestamp: new Date().toISOString()
          });
        }
      });

      // Remover cliente quando desconectar
      ws.on('close', () => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔌 Conexão WebSocket fechada');
        }
        this.clients.delete(ws);
      });

      // Tratar erros
      ws.on('error', (error) => {
        console.error('❌ Erro na conexão WebSocket:', error);
        this.clients.delete(ws);
      });
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('🚀 WebSocket Server configurado em /ws');
    }
  }

  private handleClientMessage(ws: WebSocket, message: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('📨 Mensagem recebida do cliente:', message);
    }
    
    switch (message.type) {
      case 'ping':
        this.sendToClient(ws, {
          type: 'pong',
          data: { timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString()
        });
        break;
        
      case 'subscribe:opportunities':
        // Cliente quer se inscrever para atualizações de oportunidades
        this.sendToClient(ws, {
          type: 'subscription:confirmed',
          data: { channel: 'opportunities' },
          timestamp: new Date().toISOString()
        });
        break;
        
      default:
        if (process.env.NODE_ENV !== 'production') {
          console.log('⚠️ Tipo de mensagem não reconhecido:', message.type);
        }
    }
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Método público para broadcast de mensagens
  public broadcast(message: WebSocketMessage) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📡 Broadcasting para ${this.clients.size} clientes:`, message.type);
    }
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      } else {
        // Remove clientes desconectados
        this.clients.delete(client);
      }
    });
  }

  // Método para enviar mensagem para clientes específicos (futuro uso)
  public sendToClients(clientIds: string[], message: WebSocketMessage) {
    // Implementação futura para envio direcionado
    this.broadcast(message);
  }

  // Obter estatísticas
  public getStats() {
    return {
      connectedClients: this.clients.size,
      serverRunning: this.wss.clients.size > 0
    };
  }

  // Fechar todas as conexões
  public close() {
    console.log('🔌 Fechando WebSocket Server...');
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    this.wss.close();
  }
}