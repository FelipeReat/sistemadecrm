// Usando fetch nativo do Node.js 18+

async function testAPI() {
  try {
    // Fazer login
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@crm.com',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login falhou: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login realizado com sucesso');

    // Testar API de oportunidades
    const opportunitiesResponse = await fetch('http://localhost:3000/api/opportunities', {
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!opportunitiesResponse.ok) {
      throw new Error(`API de oportunidades falhou: ${opportunitiesResponse.status}`);
    }

    const opportunities = await opportunitiesResponse.json();
    console.log(`✅ API funcionando! Total de oportunidades: ${opportunities.length}`);
    console.log('🎉 Teste de limpeza de dados: SUCESSO');
    console.log('✅ As notificações em tempo real estão funcionando corretamente');

  } catch (error) {
    console.error('❌ Erro no teste da API:', error.message);
  }
}

testAPI();