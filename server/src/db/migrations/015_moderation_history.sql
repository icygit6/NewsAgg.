BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_roles boolean NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_by integer;
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS deleted_by integer;
CREATE TABLE IF NOT EXISTS moderation_history (
 id bigserial PRIMARY KEY, kind text NOT NULL, target_id integer NOT NULL,
 post_id integer, actor_id integer, author_id integer, content text NOT NULL,
 context jsonb NOT NULL, deleted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_history_post_idx ON moderation_history(post_id, id DESC);
CREATE OR REPLACE FUNCTION record_content_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
   INSERT INTO moderation_history(kind,target_id,post_id,actor_id,author_id,content,context)
   VALUES (CASE WHEN TG_TABLE_NAME='posts' THEN CASE WHEN to_jsonb(NEW)->>'article_id' IS NULL THEN 'post' ELSE 'quote' END ELSE 'reply' END,
     NEW.id, CASE WHEN TG_TABLE_NAME='posts' THEN NEW.id ELSE (to_jsonb(NEW)->>'post_id')::integer END,
     NEW.deleted_by, NEW.user_id, NEW.content, to_jsonb(OLD));
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS posts_deletion_history ON posts;
CREATE TRIGGER posts_deletion_history AFTER UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION record_content_deletion();
DROP TRIGGER IF EXISTS comments_deletion_history ON post_comments;
CREATE TRIGGER comments_deletion_history AFTER UPDATE ON post_comments FOR EACH ROW EXECUTE FUNCTION record_content_deletion();
COMMIT;
