// Configurações do ambiente
// Seguindo o mesmo padrão usado no servidor para detectar ambiente e configurações

export const config = {
  // Detectar ambiente baseado na URL ou outras características
  // Em Replit, sempre usar configuração de desenvolvimento para usar porta 5000
  isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('replit.dev'),
  
  // Configurações de WebSocket
  websocket: {
    getUrl(): string {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Sempre usar porta 5000 em Replit, que é a porta padrão para webview
      const port = 5000;
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