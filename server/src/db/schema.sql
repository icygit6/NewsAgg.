CREATE TABLE IF NOT EXISTS sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,
  country VARCHAR(10),
  language VARCHAR(10) DEFAULT 'en',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_url TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  source_id INTEGER REFERENCES sources(id),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  ai_summary TEXT,
  author VARCHAR(255),
  published_at TIMESTAMPTZ,
  modified_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),

  -- Sentiment
  sentiment_type VARCHAR(20) CHECK (sentiment_type IN ('positive','neutral','negative')),
  sentiment_score FLOAT,
  sentiment_comparative FLOAT,
  sentiment_prob_positive FLOAT,
  sentiment_prob_neutral FLOAT,
  sentiment_prob_negative FLOAT,
  sentiment_model VARCHAR(255),

  -- Toxicity
  toxicity_label VARCHAR(50),
  toxicity_score FLOAT,

  -- Topic / AI
  topic VARCHAR(100),
  section VARCHAR(100),
  ai_top_label VARCHAR(255),
  ai_relevance FLOAT,
  ai_label_scores JSONB,

  -- Readability
  word_count INTEGER,
  reading_time_min INTEGER,
  flesch_score FLOAT,
  flesch_kincaid FLOAT,
  smog_index FLOAT,

  -- Media
  url_to_image TEXT,
  video_url TEXT,
  images JSONB DEFAULT '[]',
  related_urls JSONB DEFAULT '[]',

  -- Metadata
  keywords TEXT[] DEFAULT '{}',
  meta_tags TEXT[] DEFAULT '{}',
  entities JSONB DEFAULT '{"persons":[],"organizations":[],"locations":[],"misc":[]}',
  is_premium BOOLEAN DEFAULT FALSE,
  is_accessible_free BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT,
  google_id TEXT UNIQUE,
  avatar TEXT,
  profile_background smallint NOT NULL DEFAULT 0 CHECK (profile_background BETWEEN 0 AND 5),
  profile_background_image TEXT CHECK (profile_background_image IS NULL OR length(profile_background_image) <= 150000),
  display_name TEXT,
  bio TEXT,
  role TEXT DEFAULT 'user',
  email_verified BOOLEAN NOT NULL DEFAULT false,
  personalization_enabled BOOLEAN NOT NULL DEFAULT true,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'zhTW')),
  email_updates BOOLEAN NOT NULL DEFAULT false,
  terms_accepted_at TIMESTAMPTZ,
  bookmark_collections TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  article_title TEXT,
  article_url TEXT,
  url_to_image TEXT,
  source_name TEXT,
  topic TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collection_name TEXT NOT NULL DEFAULT 'Read later',
  notes TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, article_id)
);

CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_topic ON articles(topic);
CREATE INDEX IF NOT EXISTS idx_articles_sentiment ON articles(sentiment_type);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_keywords ON articles USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
