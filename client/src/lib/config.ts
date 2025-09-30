// Configurações do ambiente
// Seguindo o mesmo padrão usado no servidor para detectar ambiente e configurações

export const config = {
  // Detectar ambiente baseado na URL ou outras características
  // Em desenvolvimento local, usar a mesma porta do servidor
  isDevelopment: window.location.hostname.includes('replit.dev'),
  
  // Configurações de WebSocket
  websocket: {
    getUrl(): string {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // CORREÇÃO: Usar a mesma porta que o servidor está rodando
      // Se estamos em localhost:5501, usar 5501 para WebSocket também
      const currentPort = window.location.port;
      const port = currentPort || (config.isDevelopment ? 5000 : 5501);
      const host = `${window.location.hostname}:${port}`;
      
      console.log('🔧 Configuração WebSocket:', {
        protocol,
        hostname: window.location.hostname,
        currentPort,
        port,
        host,
        isDevelopment: config.isDevelopment,
        finalUrl: `${protocol}//${host}/ws`
      });
      
      return `${protocol}//${host}/ws`;
    }
  },
  
  // Configurações da API
  api: {
    baseUrl: window.location.origin
  }
};