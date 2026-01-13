
const axios = require('axios');

async function testLogin() {
  try {
    console.log('🧪 Testando login...');
    
    const loginData = {
      email: 'admin@crm.com', // Usar 'email' conforme loginSchema
      password: 'admin123'
    };
    
    console.log('📤 Enviando credenciais:', loginData);
    
    const response = await axios.post('http://localhost:5501/api/auth/login', loginData, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: false // Permitir capturar qualquer status code
    });
    
    console.log('📥 Status:', response.status);
    console.log('📥 Dados:', response.data);
    console.log('📥 Headers:', response.headers);
    
    if (response.status === 200) {
      console.log('✅ Login bem sucedido!');
      
      // Tentar acessar uma rota protegida
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        console.log('🍪 Cookies recebidos:', cookies);
        
        console.log('🧪 Testando acesso autenticado (/api/auth/me)...');
        const userResponse = await axios.get('http://localhost:5501/api/auth/me', {
          headers: {
            'Cookie': cookies
          },
          validateStatus: false
        });
        
        console.log('📥 Status User:', userResponse.status);
        console.log('📥 Dados User:', userResponse.data);
      } else {
        console.log('⚠️ Nenhum cookie recebido!');
      }
      
    } else {
      console.log('❌ Falha no login');
    }
    
  } catch (error) {
    console.error('❌ Erro na requisição:', error.message);
  }
}

testLogin();
