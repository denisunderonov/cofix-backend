-- Migration: create drinks and drink_reviews tables
-- Creates a drinks table and a drink_reviews table for storing ratings and comments

CREATE TABLE IF NOT EXISTS drinks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(8,2),
  category TEXT,
  image_url TEXT,
  ingredients JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_drinks_created_at ON drinks(created_at DESC);

CREATE TABLE IF NOT EXISTS drink_reviews (
  id SERIAL PRIMARY KEY,
  drink_id INTEGER NOT NULL,
  user_id UUID,
  user_name TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drink_reviews_drink_id ON drink_reviews(drink_id);
CREATE INDEX IF NOT EXISTS idx_drink_reviews_user_id ON drink_reviews(user_id);
