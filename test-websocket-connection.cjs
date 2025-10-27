const WebSocket = require('ws');

async function testWebSocketConnection() {
  console.log('🔧 Testando conexão WebSocket...');
  
  try {
    const ws = new WebSocket('ws://localhost:3000/ws');
    
    ws.on('open', () => {
      console.log('✅ WebSocket conectado com sucesso!');
      
      // Enviar mensagem de teste
      const testMessage = {
        type: 'ping',
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 Enviando ping:', testMessage);
      ws.send(JSON.stringify(testMessage));
    });
    
    ws.on('message', (data) => {
      console.log('📨 Mensagem recebida:', data.toString());
      try {
        const message = JSON.parse(data.toString());
        console.log('📋 Mensagem parseada:', message);
        
        if (message.type === 'pong') {
          console.log('🏓 Pong recebido - conexão funcionando!');
          ws.close();
        }
      } catch (error) {
        console.error('❌ Erro ao parsear mensagem:', error);
      }
    });
    
    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket desconectado: ${code} - ${reason}`);
    });
    
    ws.on('error', (error) => {
      console.error('❌ Erro no WebSocket:', error);
    });
    
    // Timeout para evitar que o script fique rodando indefinidamente
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log('⏰ Timeout - fechando conexão');
        ws.close();
      }
    }, 10000);
    
  } catch (error) {
    console.error('❌ Erro ao criar WebSocket:', error);
  }
}

testWebSocketConnection();