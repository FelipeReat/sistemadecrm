// Configurações do ambiente
// Seguindo o mesmo padrão usado no servidor para detectar ambiente e configurações

export const config = {
  // Detectar ambiente baseado na URL ou outras características
  isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  
  // Configurações de WebSocket
  websocket: {
    getUrl(): string {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Usar a mesma porta que o servidor está rodando
      const port = window.location.port || (config.isDevelopment ? '5501' : '5501');
      const host = `${window.location.hostname}:${port}`;
      
      console.log('🔧 Configuração WebSocket:', {
        protocol,
        hostname: window.location.hostname,
        port,
        host,
        isDevelopment: config.isDevelopment
      });
      
      return `${protocol}//${host}/ws`;
    }
  },
  
  // Configurações da API
  api: {
    baseUrl: window.location.origin
  }
};