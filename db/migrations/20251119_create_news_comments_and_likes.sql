-- Migration: create news_comments and news_likes tables
-- Создаёт таблицы для комментариев и лайков, аналогично post_comments/post_likes

CREATE TABLE IF NOT EXISTS news_comments (
  id SERIAL PRIMARY KEY,
  news_id INTEGER NOT NULL,
  user_id UUID,
  user_name TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_comments_news_id ON news_comments(news_id);
CREATE INDEX IF NOT EXISTS idx_news_comments_user_id ON news_comments(user_id);

CREATE TABLE IF NOT EXISTS news_likes (
  id SERIAL PRIMARY KEY,
  news_id INTEGER NOT NULL,
  user_id UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_likes_news_id ON news_likes(news_id);
CREATE INDEX IF NOT EXISTS idx_news_likes_user_id ON news_likes(user_id);
