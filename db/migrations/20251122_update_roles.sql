-- Migration: normalize roles and assign creator to denisunderonov

-- 1) Replace legacy 'user' role with 'guest'
UPDATE users SET role = 'guest' WHERE role = 'user' OR role IS NULL;

-- 2) Ensure the site creator user (by username) has role 'creator'
UPDATE users SET role = 'creator' WHERE username = 'denisunderonov';

-- 3) Ensure uniqueness: demote any other creators to 'manager' (except the correct one)
UPDATE users SET role = 'manager' WHERE role = 'creator' AND username != 'denisunderonov';

-- 4) Add index on role for quick lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
