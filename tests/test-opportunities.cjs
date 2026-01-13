const axios = require('axios');

async function testOpportunities() {
  console.log('🚀 Iniciando teste de Oportunidades...');

  try {
    // 1. Login como admin
    console.log('🔑 Tentando login como admin...');
    const loginResponse = await axios.post('http://localhost:5501/api/auth/login', {
      email: 'admin@crm.com',
      password: 'admin123'
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: false
    });

    if (loginResponse.status !== 200) {
      console.error('❌ Falha no login:', loginResponse.status, loginResponse.data);
      return;
    }
    console.log('✅ Login realizado com sucesso!');
    
    const cookies = loginResponse.headers['set-cookie'];
    
    // 2. Listar oportunidades
    console.log('📋 Buscando oportunidades...');
    const oppResponse = await axios.get('http://localhost:5501/api/opportunities', {
      headers: {
        'Cookie': cookies
      },
      validateStatus: false
    });

    if (oppResponse.status === 200) {
      console.log('✅ Oportunidades listadas com sucesso!');
      console.log(`📊 Total de oportunidades encontradas: ${oppResponse.data.length}`);
      if (oppResponse.data.length > 0) {
        console.log('ℹ️ Exemplo de oportunidade (primeira):', JSON.stringify(oppResponse.data[0], null, 2));
      }
    } else {
      console.error('❌ Erro ao listar oportunidades:', oppResponse.status, oppResponse.data);
    }

  } catch (error) {
    console.error('❌ Erro inesperado:', error.message);
    if (error.response) {
      console.error('Detalhes:', error.response.data);
    }
  }
}

testOpportunities();
