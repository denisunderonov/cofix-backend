-- Добавление поля reputation к таблице users
ALTER TABLE users
ADD COLUMN reputation INTEGER DEFAULT 0;

-- Установка репутации 0 для существующих пользователей
UPDATE users SET reputation = 0 WHERE reputation IS NULL;
