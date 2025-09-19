const fetch = require('node-fetch');

async function testLogin() {
  try {
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
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    if (response.ok) {
      console.log('✅ Login realizado com sucesso!');
    } else {
      console.log('❌ Falha no login:', data.message);
    }
  } catch (error) {
    console.error('Erro na requisição:', error.message);
  }
}

testLogin();