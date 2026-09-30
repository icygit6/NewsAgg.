// Read-only storage, duplicate and model evidence; never print credentials.
import 'dotenv/config';
import pg from 'pg';
const url = new URL(process.env.NEONDB_URL || process.env.DATABASE_URL || process.env.NEON_DSN);
url.searchParams.delete('sslmode'); url.searchParams.delete('sslrootcert');
const db = new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000,query_timeout:30000});
try {
  await db.connect();
  const storage = await db.query(`SELECT pg_database_size(current_database())::bigint AS database_bytes,
    pg_total_relation_size('articles')::bigint AS article_bytes, (SELECT count(*) FROM articles)::int AS articles`);
  const duplicates = await db.query(`SELECT lower(regexp_replace(title, '\\s+', ' ', 'g')) AS title,
    array_agg(id) AS ids, count(*)::int AS copies FROM articles WHERE feed_eligible = true
    AND extraction_version = 'structured-v3' AND published_at > now() - interval '30 days'
    GROUP BY 1 HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 12`);
  const models = await db.query(`SELECT sentiment_model, summary_method, quality_metadata FROM articles
    WHERE feed_eligible = true ORDER BY scraped_at DESC LIMIT 3`);
  const capacity = await db.query(`SELECT topic,count(*)::int FROM articles WHERE feed_eligible = true
    AND extraction_version='structured-v3' AND published_at > now()-interval '48 hours' GROUP BY topic ORDER BY topic`);
  console.log(JSON.stringify({storage:storage.rows[0],duplicates:duplicates.rows,models:models.rows,categories:capacity.rows},null,2));
} finally { await db.end(); }
