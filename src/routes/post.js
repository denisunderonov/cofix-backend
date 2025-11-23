const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');
const { protect } = require('../middleware/auth');

// GET /api/posts - Получить все посты
router.get('/', async (req, res) => {
  try {
    const [posts] = await sequelize.query(`
      SELECT 
        p.*,
        COUNT(DISTINCT l.id) as likes_count,
        COUNT(DISTINCT c.id) as comments_count,
        EXISTS(
          SELECT 1 FROM post_likes 
          WHERE post_id = p.id AND user_id = :userId
        ) as user_has_liked
      FROM posts p
      LEFT JOIN post_likes l ON p.id = l.post_id
      LEFT JOIN post_comments c ON p.id = c.post_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, {
      replacements: { userId: 1 } // Замените на ID из авторизации
    });

    res.json({
      success: true,
      posts
    });
  } catch (error) {
    console.error('Ошибка загрузки постов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка загрузки постов'
    });
  }
});

// GET /api/posts/:id/comments - Получить комментарии поста
router.get('/:id/comments', async (req, res) => {
  try {
    const [comments] = await sequelize.query(`
      SELECT 
        pc.*, 
        u.avatar,
        u.role
      FROM post_comments pc
      LEFT JOIN users u ON pc.user_id = u.id
      WHERE pc.post_id = :postId 
      ORDER BY pc.created_at DESC
    `, {
      replacements: { postId: req.params.id }
    });

    res.json({
      success: true,
      comments
    });
  } catch (error) {
    console.error('Ошибка загрузки комментариев:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка загрузки комментариев'
    });
  }
});

const jwt = require('jsonwebtoken');

// POST /api/posts/:id/like - Лайкнуть пост (только для авторизованных пользователей)
router.post('/:id/like', async (req, res) => {
  try {
    // пытаемся извлечь userId из заголовка Authorization
    let userId = null;
    try {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded?.userId || decoded?.user?.id || decoded?.id;
      }
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Требуется авторизация' });
    }
    if (!userId) return res.status(401).json({ success: false, error: 'Требуется авторизация' });
    
    // Проверяем, есть ли уже лайк
    const [existingLike] = await sequelize.query(`
      SELECT * FROM post_likes 
      WHERE post_id = :postId AND user_id = :userId
    `, {
      replacements: { postId: req.params.id, userId }
    });

    if (existingLike.length > 0) {
      // Убираем лайк
      await sequelize.query(`
        DELETE FROM post_likes 
        WHERE post_id = :postId AND user_id = :userId
      `, {
        replacements: { postId: req.params.id, userId }
      });
    } else {
      // Добавляем лайк
      await sequelize.query(`
        INSERT INTO post_likes (post_id, user_id, created_at)
        VALUES (:postId, :userId, NOW())
      `, {
        replacements: { postId: req.params.id, userId }
      });
    }

    // Получаем обновленное количество лайков
    const [[{ likes_count }]] = await sequelize.query(`
      SELECT COUNT(*) as likes_count FROM post_likes 
      WHERE post_id = :postId
    `, {
      replacements: { postId: req.params.id }
    });

    res.json({
      success: true,
      likes_count: parseInt(likes_count),
      user_has_liked: existingLike.length === 0
    });
  } catch (error) {
    console.error('Ошибка лайка:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка лайка'
    });
  }
});

// POST /api/posts/:id/comments - Добавить комментарий
// Допускается авторизация: если клиент передаст Bearer токен, имя пользователя возьмётся из токена.
// Создание комментария — рекомендуем требовать авторизацию в проде.
router.post('/:id/comments', async (req, res) => {
  try {
    const { content, image_url } = req.body;

    // извлекаем пользователя из токена (обязателен)
    let userId = null;
    let userName = req.body.user_name || 'Аноним';
    try {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded?.userId || decoded?.user?.id || decoded?.id;
      }
    } catch (e) {
      // ignore here — will check below
    }

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Требуется авторизация для создания комментария' });
    }

    // Если пользователь найден в JWT, попробуем подтянуть username из БД
    let dbUserName = userName;
    try {
      const [rows] = await sequelize.query(`SELECT username FROM users WHERE id = :id`, { replacements: { id: userId } });
      if (rows && rows.length > 0 && rows[0].username) dbUserName = rows[0].username;
    } catch (e) {
      // ignore
    }

    const [result] = await sequelize.query(`
      INSERT INTO post_comments (post_id, user_id, user_name, content, image_url, created_at)
      VALUES (:postId, :userId, :userName, :content, :imageUrl, NOW())
      RETURNING *
    `, {
      replacements: { 
        postId: req.params.id,
        userId,
        userName: dbUserName,
        content,
        imageUrl: image_url || null
      }
    });

    res.json({
      success: true,
      comment: result[0]
    });
  } catch (error) {
    console.error('Ошибка добавления комментария:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка добавления комментария'
    });
  }
});

// DELETE /api/posts/:postId/comments/:commentId - удалить комментарий (только автор или админ)
router.delete('/:postId/comments/:commentId', protect, async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    const [[commentRows]] = await sequelize.query(`
      SELECT id, post_id, user_id, user_name FROM post_comments WHERE id = :commentId AND post_id = :postId
    `, { replacements: { commentId, postId } });

    const comment = commentRows;

    if (!comment) {
      return res.status(404).json({ success: false, error: 'Комментарий не найден' });
    }

    // Разрешаем удалять, если совпадает user_id или user_name (на случай старых записей), либо роль admin
    const isOwner = comment.user_id && req.user && String(comment.user_id) === String(req.user.id);
    const isNameMatch = comment.user_name && req.user && comment.user_name === req.user.username;
    const privilegedRoles = ['worker', 'manager', 'creator', 'admin'];
    const isPrivileged = req.user && privilegedRoles.includes(req.user.role);

    if (!isOwner && !isNameMatch && !isPrivileged) {
      return res.status(403).json({ success: false, error: 'Нет прав на удаление' });
    }

    await sequelize.query(`DELETE FROM post_comments WHERE id = :commentId`, { replacements: { commentId } });

    res.json({ success: true, message: 'Комментарий удалён' });
  } catch (error) {
    console.error('Ошибка удаления комментария:', error);
    res.status(500).json({ success: false, error: 'Ошибка удаления комментария' });
  }
});

module.exports = router;