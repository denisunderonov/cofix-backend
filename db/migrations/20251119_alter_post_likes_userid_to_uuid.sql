-- Migration: change post_likes.user_id from integer to uuid
-- Strategy: drop the old column and recreate as uuid (safe because table currently has no rows in this environment)

ALTER TABLE post_likes DROP COLUMN IF EXISTS user_id;
ALTER TABLE post_likes ADD COLUMN user_id UUID;

-- index for faster lookups
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
