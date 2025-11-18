const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');

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
      SELECT * FROM post_comments 
      WHERE post_id = :postId 
      ORDER BY created_at DESC
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

// POST /api/posts/:id/like - Лайкнуть пост
router.post('/:id/like', async (req, res) => {
  try {
    const userId = 1; // Замените на ID из авторизации
    
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
router.post('/:id/comments', async (req, res) => {
  try {
    const { content } = req.body;
    
    const [result] = await sequelize.query(`
      INSERT INTO post_comments (post_id, user_name, content, created_at)
      VALUES (:postId, :userName, :content, NOW())
      RETURNING *
    `, {
      replacements: { 
        postId: req.params.id,
        userName: 'Аноним', // Замените на данные из авторизации
        content
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

module.exports = router;