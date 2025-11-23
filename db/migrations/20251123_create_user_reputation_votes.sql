-- Таблица для отслеживания голосов за репутацию
CREATE TABLE IF NOT EXISTS user_reputation_votes (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, target_user_id)
);

CREATE INDEX idx_reputation_votes_user ON user_reputation_votes(user_id);
CREATE INDEX idx_reputation_votes_target ON user_reputation_votes(target_user_id);
