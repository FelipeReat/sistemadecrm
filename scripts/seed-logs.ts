import 'dotenv/config';
import { createDirectConnection } from '../server/pg-pool';
import { randomUUID } from 'crypto';

async function seed() {
  const client = createDirectConnection();
  await client.connect();

  try {
    // Buscar um usuário existente para vincular registros
    const userRes = await client.query(`SELECT id, email, name FROM users ORDER BY created_at ASC LIMIT 1`);
    const user = userRes.rows[0];
    if (!user) {
      console.log('❌ Nenhum usuário encontrado. Crie um usuário primeiro (seed:admin).');
      return;
    }

    const now = new Date();
    const earlier = new Date(Date.now() - 1000 * 60 * 60 * 24);

    // Seed login_history
    const loginSeeds = [
      {
        user_id: user.id,
        ip_address: '192.168.0.10',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        login_time: earlier,
        success: true,
        location: 'São Paulo, BR',
        failure_reason: null,
      },
      {
        user_id: user.id,
        ip_address: '189.23.45.67',
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        login_time: now,
        success: false,
        location: 'Rio de Janeiro, BR',
        failure_reason: 'Senha incorreta',
      }
    ];

    // Detectar dinamicamente a coluna de timestamp (login_at vs login_time)
    const colRes = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'login_history' AND column_name IN ('login_at','login_time') 
       ORDER BY column_name LIMIT 1`
    );
    const tsCol = colRes.rows[0]?.column_name || 'login_at';

    for (const seed of loginSeeds) {
      const query = `INSERT INTO login_history (user_id, ip_address, user_agent, ${tsCol}, success, location, failure_reason)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`;
      await client.query(query, [
        seed.user_id, seed.ip_address, seed.user_agent, seed.login_time, seed.success, seed.location, seed.failure_reason
      ]);
    }

    // Seed system_logs
    const logsSeeds = [
      {
        level: 'info',
        category: 'auth',
        message: 'Login realizado com sucesso',
        user_id: user.id,
        ip_address: '192.168.0.10',
        user_agent: 'Chrome/124 Windows',
      },
      {
        level: 'error',
        category: 'security',
        message: 'Tentativa de login falhou',
        user_id: user.id,
        ip_address: '189.23.45.67',
        user_agent: 'Safari iOS',
      },
      {
        level: 'warning',
        category: 'system',
        message: 'Uso elevado de memória detectado',
        user_id: user.id,
        ip_address: null,
        user_agent: null,
      },
    ];

    for (const log of logsSeeds) {
      await client.query(
        `INSERT INTO system_logs (level, category, message, user_id, ip_address, user_agent, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [log.level, log.category, log.message, log.user_id, log.ip_address, log.user_agent, JSON.stringify({ seed: true })]
      );
    }

    console.log('✅ Seed de login_history e system_logs concluído com sucesso.');
  } catch (err: any) {
    console.error('❌ Erro ao executar seed:', err.message);
  } finally {
    await client.end();
  }
}

seed();