const opportunityData = {
  contact: 'João Silva',
  company: 'Empresa Teste',
  phone: '11999999999',
  email: 'joao@teste.com',
  value: 5000,
  description: 'Teste após limpeza de logs'
};

fetch('http://localhost:3000/api/opportunities', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': 'auth-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwidXNlcm5hbWUiOiJhZG1pbiIsImlhdCI6MTczNzU2NzI5MywiZXhwIjoxNzM3NjUzNjkzfQ.123'
  },
  body: JSON.stringify(opportunityData)
})
.then(response => response.json())
.then(data => {
  console.log('✅ Resposta da API:', JSON.stringify(data, null, 2));
  if (data.createdByName) {
    console.log('✅ SUCCESS: createdByName definido como:', data.createdByName);
  } else {
    console.log('❌ ERROR: createdByName ainda está undefined/null');
  }
})
.catch(error => {
  console.error('❌ Erro na requisição:', error.message);
});