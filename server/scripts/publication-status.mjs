// Read-only operational counters. No article bodies, keys, or mail credentials.
import 'dotenv/config';
import pg from 'pg';
const dsn=new URL(process.env.NEONDB_URL||process.env.DATABASE_URL||process.env.NEON_DSN);
dsn.searchParams.delete('sslmode');dsn.searchParams.delete('sslrootcert');
const client=new pg.Client({connectionString:dsn.toString(),ssl:['localhost','127.0.0.1','db'].includes(dsn.hostname)?false:{rejectUnauthorized:true},connectionTimeoutMillis:15000,query_timeout:30000});
try {
  await client.connect();
  const staging=await client.query('SELECT status,count(*)::int FROM staging.articles GROUP BY status ORDER BY status');
  const publications=await client.query('SELECT count(*)::int,max(approved_at) AS latest FROM public.article_publications');
  const editions=await client.query('SELECT edition_day,frozen_at,scheduled_cutoff,status,details FROM public.newsletter_editions ORDER BY edition_day DESC LIMIT 3');
  console.log(JSON.stringify({staging:staging.rows,publications:publications.rows[0],editions:editions.rows},null,2));
} finally {await client.end();}
