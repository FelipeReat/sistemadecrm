// Configurações do ambiente
// Seguindo o mesmo padrão usado no servidor para detectar ambiente e configurações

export const config = {
  // Detectar ambiente baseado na URL ou outras características
  isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  
  // Configurações de WebSocket
  websocket: {
    getUrl(): string {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Usar a mesma lógica do servidor para determinar a porta
      // Desenvolvimento: PORT=5000 (padrão do .env.development)
      // Produção: PORT=5501 (definido no .env)
      const port = config.isDevelopment ? 5000 : 5501;
      const host = `${window.location.hostname}:${port}`;
      
      return `${protocol}//${host}/ws`;
    }
  },
  
  // Configurações da API
  api: {
    baseUrl: window.location.origin
  }
};