// Quick DB check: users and login_history
require('dotenv').config({ path: '.env.development' });
const { Client } = require('pg');

async function main() {
  const url = process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL/DEV_DATABASE_URL not set.');
    process.exit(1);
  }
  const masked = url.replace(/:[^@]*@/, '://****@');
  console.log('Connecting to:', masked);

  const client = new Client({ connectionString: url, ssl: false });
  await client.connect();

  const admin = await client.query(
    'SELECT id, email, name FROM users WHERE email=$1 LIMIT 1',
    ['admin@crm.com']
  );
  console.log('Admin user:', admin.rows[0] || null);

  const totalAll = await client.query(
    'SELECT COUNT(*)::int AS c FROM login_history'
  );
  console.log('Total login_history (all users):', totalAll.rows[0].c);

  if (admin.rows[0]) {
    const adminId = admin.rows[0].id;
    const totalAdmin = await client.query(
      'SELECT COUNT(*)::int AS c FROM login_history WHERE user_id=$1',
      [adminId]
    );
    console.log('Total login_history (admin):', totalAdmin.rows[0].c);

    // Detect available timestamp columns
    const colsRes = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'login_history' AND column_name IN ('login_time','login_at','created_at')`
    );
    const availableCols = colsRes.rows.map(r => r.column_name);
    const ordered = ['login_time','login_at','created_at'].filter(c => availableCols.includes(c));
    const tsExpr = ordered.length === 0
      ? 'created_at'
      : (ordered.length === 1 ? ordered[0] : `COALESCE(${ordered.join(', ')})`);

    const sample = await client.query(
      `SELECT id, user_id, ${tsExpr} AS ts, success FROM login_history WHERE user_id=$1 ORDER BY ${tsExpr} DESC LIMIT 5`,
      [adminId]
    );
    console.log('Sample admin rows:', sample.rows);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});