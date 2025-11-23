-- Migration: add user_id and image_url to post_comments and image_url to posts
-- Run this SQL against your PostgreSQL database used by the app.

-- Add user_id (UUID) and image_url to comments
ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Optionally add image_url to posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON post_comments(user_id);
