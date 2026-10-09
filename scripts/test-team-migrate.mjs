import { Client } from 'pg';
import { readFileSync } from 'fs';
const sql = readFileSync('db/migrations/013_team_members.sql', 'utf8');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try { await client.query(sql); console.log('ok'); } catch (e) { console.error('err', e.message); process.exit(1); }
  finally { await client.end(); }
});

