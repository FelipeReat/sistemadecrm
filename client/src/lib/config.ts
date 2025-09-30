// Configurações do ambiente
// Seguindo o mesmo padrão usado no servidor para detectar ambiente e configurações

export const config = {
  // Detectar ambiente baseado na URL ou outras características
  // Desenvolvimento: localhost, 127.0.0.1, ou replit.dev
  // Produção: qualquer outro hostname (incluindo IPs de servidor)
  isDevelopment: window.location.hostname === 'localhost' || 
                 window.location.hostname === '127.0.0.1' || 
                 window.location.hostname.includes('replit.dev'),
  
  // Configurações de WebSocket
  websocket: {
    getUrl(): string {
      // Em produção, sempre usar wss:// se a página foi carregada via HTTPS
      // Em desenvolvimento, usar ws:// para localhost
      const isSecure = window.location.protocol === 'https:' || !config.isDevelopment;
      const protocol = isSecure ? 'wss:' : 'ws:';
      
      // CORREÇÃO: Usar a mesma porta que o servidor está rodando
      // Se estamos em localhost:5000, usar 5000 para WebSocket também
      const currentPort = window.location.port;
      const port = currentPort || 5000;
      const host = `${window.location.hostname}:${port}`;
      
      console.log('🔧 Configuração WebSocket:', {
        protocol,
        hostname: window.location.hostname,
        currentPort,
        port,
        host,
        isDevelopment: config.isDevelopment,
        isSecure,
        pageProtocol: window.location.protocol,
        finalUrl: `${protocol}//${host}/ws`,
        userAgent: navigator.userAgent,
        location: window.location.href
      });
      
      return `${protocol}//${host}/ws`;
    }
  },
  
  // Configurações da API
  api: {
    baseUrl: window.location.origin
  }
};