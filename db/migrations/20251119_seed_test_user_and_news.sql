-- Seed: insert test user and one test news
-- Idempotent: uses ON CONFLICT DO NOTHING/UPDATE

BEGIN;

-- Insert test user with known UUID (used in earlier tests)
INSERT INTO users (id, username, email, password, role, created_at)
VALUES (
  '8e52c08d-8525-4b24-b410-6d1f49475eef',
  'testuser_bot',
  'testbot@example.com',
  'seeded-password',
  'user',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, email = EXCLUDED.email;

-- Insert a sample news item
INSERT INTO news (id, title, content, author, created_at)
VALUES (
  1,
  'Тестовая новость',
  'Это автоматически созданная тестовая новость для проверки комментариев и лайков.',
  'Система',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
