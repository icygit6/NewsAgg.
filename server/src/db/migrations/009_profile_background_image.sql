ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_background_image TEXT
  CHECK (profile_background_image IS NULL OR length(profile_background_image) <= 150000);
