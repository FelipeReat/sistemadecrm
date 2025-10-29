// Usar fetch nativo do Node.js (versão 18+)
const BASE_URL = 'http://localhost:5501';

async function testAPIs() {
  console.log('🧪 Testando APIs problemáticas...\n');

  try {
    // Primeiro, fazer login para obter token de sessão
    console.log('1. Fazendo login...');
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@admin.com',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login falhou: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login realizado com sucesso');

    // Extrair cookies de sessão
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('🍪 Cookies de sessão obtidos');

    // Testar as APIs problemáticas
    const problematicAPIs = [
      '/api/users/salespeople',
      '/api/user/profile'
    ];

    for (const apiPath of problematicAPIs) {
      console.log(`\n2. Testando ${apiPath}...`);
      
      try {
        const method = 'GET';
        const testResponse = await fetch(`${BASE_URL}${apiPath}`, {
          method: method,
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies || ''
          }
        });

        console.log(`   Status: ${testResponse.status} ${testResponse.statusText}`);
        
        if (testResponse.ok) {
          const data = await testResponse.text();
          console.log(`   ✅ Resposta: ${data.substring(0, 200)}${data.length > 200 ? '...' : ''}`);
        } else {
          const errorText = await testResponse.text();
          console.log(`   ❌ Erro: ${errorText}`);
        }
      } catch (error) {
        console.log(`   ❌ Erro de conexão: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testAPIs();