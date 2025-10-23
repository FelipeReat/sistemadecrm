// Configurações do ambiente
// Seguindo o mesmo padrão usado no servidor para detectar ambiente e configurações

// Detectar ambiente baseado na URL ou outras características
// Desenvolvimento: localhost, 127.0.0.1, ou replit.dev
// Produção: qualquer outro hostname (incluindo IPs de servidor)
const isDevelopment = window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('replit.dev');
const isReplit = window.location.hostname.includes('replit.dev');

export const config = {
  isDevelopment,
  isReplit,

  // Configurações de WebSocket
  websocket: {
    getUrl(): string {
      // Detectar se estamos em desenvolvimento ou produção
      const isDev = import.meta.env.DEV;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

      // Para desenvolvimento local, conectar ao backend na porta 3000
      // Para Replit, usar porta 5000
      const backendPort = isReplit ? 5000 : 3000;
      const host = `${window.location.hostname}:${backendPort}`;
      const wsUrl = `${protocol}//${host}/ws`;
     
      console.log('🔧 Configuração WebSocket:', {
        protocol,
        host,
        isDevelopment: isDev,
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
    baseUrl: isReplit ? window.location.origin : `http://localhost:3000`
  }
};