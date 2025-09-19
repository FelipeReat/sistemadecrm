const fetch = require('node-fetch');

async function checkRateLimit() {
  try {
    console.log('🔍 Verificando status do rate limiter...');
    
    // Primeiro, vamos tentar fazer login algumas vezes para ver o comportamento
    for (let i = 1; i <= 3; i++) {
      console.log(`\n--- Tentativa ${i} ---`);
      
      const response = await fetch('http://localhost:5501/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'admin@crm.com',
          password: 'admin123'
        })
      });
      
      const data = await response.json();
      console.log(`Status: ${response.status}`);
      console.log(`Response:`, data);
      
      if (response.status === 429) {
        console.log('❌ Rate limit atingido!');
        break;
      }
      
      if (response.ok) {
        console.log('✅ Login bem-sucedido!');
        break;
      }
      
      // Aguarda um pouco entre tentativas
      if (i < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
  } catch (error) {
    console.error('Erro na verificação:', error.message);
  }
}

checkRateLimit();