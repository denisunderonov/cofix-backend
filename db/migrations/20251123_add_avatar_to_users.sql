-- Add avatar column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);

-- Create index for faster avatar lookups
CREATE INDEX IF NOT EXISTS idx_users_avatar ON users(avatar);
