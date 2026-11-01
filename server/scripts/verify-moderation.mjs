// Rollback-only integration check: temporary fixtures never become live content.
import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
const client=new pg.Client({connectionString:process.env.NEONDB_URL||process.env.DATABASE_URL||process.env.NEON_DSN});
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(`CREATE TEMP TABLE moderation_history (LIKE public.moderation_history INCLUDING DEFAULTS) ON COMMIT DROP;
    CREATE TEMP TABLE posts(id integer, article_id text, user_id integer, content text, deleted_by integer, deleted_at timestamptz) ON COMMIT DROP;
    CREATE TEMP TABLE post_comments(id integer, post_id integer, parent_id integer, user_id integer, content text, deleted_by integer, deleted_at timestamptz) ON COMMIT DROP;
    CREATE TRIGGER test_post AFTER UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION public.record_content_deletion();
    CREATE TRIGGER test_comment AFTER UPDATE ON post_comments FOR EACH ROW EXECUTE FUNCTION public.record_content_deletion();
    INSERT INTO posts VALUES(1,'article',2,'quote',NULL,NULL);
    INSERT INTO post_comments VALUES(3,1,NULL,2,'reply',NULL,NULL);
    UPDATE posts SET deleted_at=now(),deleted_by=9;
    UPDATE post_comments SET deleted_at=now(),deleted_by=9;`);
  const {rows}=await client.query('SELECT kind,post_id,actor_id,content FROM pg_temp.moderation_history ORDER BY id');
  assert.deepEqual(rows,[{kind:'quote',post_id:1,actor_id:9,content:'quote'},{kind:'reply',post_id:1,actor_id:9,content:'reply'}]);
  await client.query('UPDATE post_comments SET deleted_at=now()');
  assert.equal((await client.query('SELECT count(*)::integer AS n FROM pg_temp.moderation_history')).rows[0].n,2);
  console.log('Quote/reply snapshots, context, attribution and duplicate prevention passed; rolled back.');
} finally {await client.query('ROLLBACK');await client.end();}
