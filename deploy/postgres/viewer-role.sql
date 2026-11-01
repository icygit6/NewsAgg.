-- Read-only login for the pgweb database viewer (compose service dbviewer).
-- Run with:  psql -U newsagg -d newsagg -v viewer_password=... -f viewer-role.sql
-- It can read every table except login secrets: no auth_tokens or
-- account_sessions, and users without the password hash or Google subject id.
-- Re-running is safe; tables added later need a matching GRANT here.
SELECT format('CREATE ROLE newsagg_viewer LOGIN PASSWORD %L', :'viewer_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'newsagg_viewer') \gexec
ALTER ROLE newsagg_viewer PASSWORD :'viewer_password';
ALTER ROLE newsagg_viewer SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE newsagg TO newsagg_viewer;
GRANT USAGE ON SCHEMA public TO newsagg_viewer;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM newsagg_viewer;
GRANT SELECT ON
  article_chunks, article_preview_translations, article_publications, article_reports,
  articles, authors, bookmarks, newsletter_editions, post_comments, post_likes,
  post_reports, posts, publication_state, scraper_runs, sources, translations, user_blocks,
  feedback, moderation_history
  TO newsagg_viewer;

-- Browsable stand-in for users (pgweb's row view selects every column).
-- New columns go at the end: CREATE OR REPLACE VIEW cannot reorder existing ones.
CREATE OR REPLACE VIEW users_overview AS
  SELECT id, email, username, display_name, role, email_verified, created_at, last_login,
         preferred_language, email_updates, personalization_enabled, terms_accepted_at,
         avatar, bio, profile_background, profile_background_image, can_manage_roles,
         bookmark_collections
  FROM users;
GRANT SELECT ON users_overview TO newsagg_viewer;
