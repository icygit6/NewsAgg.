-- General feedback from any reader, signed in or not: bug reports, suggestions
-- and anything else. Unlike article_reports it is not tied to an article; the
-- page it was sent from is kept so a bug can be reproduced. The admin page
-- lists it and admins are emailed on arrival (services/adminNotify.ts).
CREATE TABLE IF NOT EXISTS feedback (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('bug', 'suggestion', 'other')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  page TEXT CHECK (page IS NULL OR char_length(page) <= 300),
  -- Only asked of guests, so the team can reply; signed-in users are reached through their account.
  contact_email TEXT CHECK (contact_email IS NULL OR char_length(contact_email) <= 254),
  user_agent TEXT CHECK (user_agent IS NULL OR char_length(user_agent) <= 400),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_status_created ON feedback (status, created_at DESC);
