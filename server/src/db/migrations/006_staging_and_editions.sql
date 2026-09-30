BEGIN;
CREATE SCHEMA IF NOT EXISTS staging;
REVOKE ALL ON SCHEMA staging FROM PUBLIC;
CREATE TABLE IF NOT EXISTS staging.articles (
  candidate_key TEXT PRIMARY KEY,
  run_key TEXT NOT NULL,
  source_id TEXT NOT NULL,
  candidate_url TEXT NOT NULL,
  article_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','ready','published','rejected')),
  payload JSONB NOT NULL DEFAULT '{}',
  validation JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_staging_status ON staging.articles(status, updated_at);
CREATE TABLE IF NOT EXISTS public.article_publications (
  article_id TEXT PRIMARY KEY REFERENCES public.articles(id),
  run_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_article_publications_approved ON public.article_publications(approved_at);
CREATE TABLE IF NOT EXISTS public.publication_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  revision BIGINT NOT NULL DEFAULT 0
);
INSERT INTO public.publication_state(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.bump_article_revision() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.publication_state SET revision=revision+1 WHERE singleton;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS article_publication_revision ON public.articles;
CREATE TRIGGER article_publication_revision AFTER INSERT OR UPDATE OR DELETE ON public.articles
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_article_revision();

CREATE TABLE IF NOT EXISTS public.newsletter_editions (
  edition_day DATE PRIMARY KEY,
  frozen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_cutoff TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('complete','partial','failed')),
  selected_ids JSONB NOT NULL,
  details JSONB NOT NULL,
  message JSONB NOT NULL
);
CREATE OR REPLACE FUNCTION public.keep_newsletter_immutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Newsletter editions are immutable; use a separately authorized revision';
END;
$$;
DROP TRIGGER IF EXISTS immutable_newsletter ON public.newsletter_editions;
CREATE TRIGGER immutable_newsletter BEFORE UPDATE OR DELETE ON public.newsletter_editions
  FOR EACH ROW EXECUTE FUNCTION public.keep_newsletter_immutable();
COMMIT;
