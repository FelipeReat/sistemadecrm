// Configurações do ambiente
// Seguindo o mesmo padrão usado no servidor para detectar ambiente e configurações

export const config = {
  // Detectar ambiente baseado na URL ou outras características
  // Desenvolvimento: localhost, 127.0.0.1, ou replit.dev
  // Produção: qualquer outro hostname (incluindo IPs de servidor)
  isDevelopment: window.location.hostname === 'localhost' ||
                 window.location.hostname === '127.0.0.1' ||
                 window.location.hostname.includes('replit.dev'),
  isReplit: window.location.hostname.includes('replit.dev'),

  // Configurações de WebSocket
  websocket: {
    getUrl(): string {
      // Detectar se estamos em desenvolvimento ou produção
      const isDevelopment = import.meta.env.DEV;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

      // Para Replit, sempre usar o host atual da página
     /* const host = window.location.host;*/
     const currentPort = import.meta.env.PORT ?? window.location.port;
     const port = config.isReplit ? 5000 : 3000;
     const host = `${window.location.hostname}:${port}`;
     const wsUrl = `${protocol}//${host}/ws`;
     
      console.log('🔧 Configuração WebSocket:', {
        protocol,
        host,
        isDevelopment,
        isSecure: protocol === 'wss:',
        pageProtocol: window.location.protocol,
        finalUrl: wsUrl,
        userAgent: navigator.userAgent,
        location: window.location.href
      });

      return wsUrl;
    }
  },

  // Configurações da API
  api: {
    baseUrl: window.location.origin
  }
};