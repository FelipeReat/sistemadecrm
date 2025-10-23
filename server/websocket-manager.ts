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
    console.log('🔌 Iniciando WebSocket Server no path /ws');
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupWebSocketServer();
    
    // Log quando o servidor WebSocket estiver pronto
    this.wss.on('listening', () => {
      console.log('✅ WebSocket Server está escutando');
    });
    
    this.wss.on('error', (error) => {
      console.error('❌ Erro no WebSocket Server:', error);
    });
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log('🔗 Nova conexão WebSocket estabelecida');
      console.log(`📍 Cliente conectado de: ${req.socket.remoteAddress}`);
      console.log(`📋 Headers: ${JSON.stringify(req.headers, null, 2)}`);
      
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
        this.clients.delete(ws);
      });

      // Tratar erros
      ws.on('error', (error) => {
        console.error('❌ Erro na conexão WebSocket:', error);
        this.clients.delete(ws);
      });
    });
  }

  private handleClientMessage(ws: WebSocket, message: any) {
    
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
        // Tipo de mensagem não reconhecido - ignorar silenciosamente
    }
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Método público para broadcast de mensagens
  public broadcast(message: WebSocketMessage) {
    
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
    try {
      return {
        connectedClients: this.clients.size,
        serverRunning: false // Simplificado para evitar problemas de serialização
      };
    } catch (error) {
      console.error('❌ Erro ao obter stats do WebSocket:', error);
      return {
        connectedClients: 0,
        serverRunning: false
      };
    }
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