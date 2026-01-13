const { Client } = require('pg');

const databaseUrl = "postgres://locador:Blomaq2025$@locador.cvoqwvkez1a3.sa-east-1.rds.amazonaws.com:5432/crm";

async function addPriorityColumn() {
  console.log('🔌 Conectando ao banco de dados...');
  
  // Configuração SSL permissiva para garantir conexão
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Conectado!');

    // Verificar se a coluna existe
    console.log('🔍 Verificando tabela opportunities...');
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'opportunities' AND column_name = 'priority';
    `;
    
    const checkResult = await client.query(checkQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('ℹ️ A coluna "priority" JÁ EXISTE na tabela "opportunities".');
    } else {
      console.log('⚠️ A coluna "priority" NÃO EXISTE. Adicionando...');
      
      const alterQuery = `
        ALTER TABLE opportunities 
        ADD COLUMN priority VARCHAR(20) DEFAULT 'medium' NOT NULL;
      `;
      
      await client.query(alterQuery);
      console.log('✅ Coluna "priority" adicionada com sucesso!');
    }

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await client.end();
    console.log('🔌 Desconectado.');
  }
}

addPriorityColumn();
