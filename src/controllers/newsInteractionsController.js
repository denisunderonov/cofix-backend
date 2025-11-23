const sequelize = require('../config/database');
const jwt = require('jsonwebtoken');

// POST /api/news/:id/like
exports.toggleLike = async (req, res) => {
  try {
    // извлекаем userId из заголовка Authorization
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

    const newsId = req.params.id;

    const [existingLike] = await sequelize.query(
      `SELECT * FROM news_likes WHERE news_id = :newsId AND user_id = :userId`,
      { replacements: { newsId, userId } }
    );

    if (existingLike.length > 0) {
      await sequelize.query(
        `DELETE FROM news_likes WHERE news_id = :newsId AND user_id = :userId`,
        { replacements: { newsId, userId } }
      );
    } else {
      await sequelize.query(
        `INSERT INTO news_likes (news_id, user_id, created_at) VALUES (:newsId, :userId, NOW())`,
        { replacements: { newsId, userId } }
      );
    }

    const [[{ likes_count }]] = await sequelize.query(
      `SELECT COUNT(*) as likes_count FROM news_likes WHERE news_id = :newsId`,
      { replacements: { newsId } }
    );

    res.json({ success: true, likes_count: parseInt(likes_count), user_has_liked: existingLike.length === 0 });
  } catch (error) {
    console.error('Ошибка лайка (news):', error);
    res.status(500).json({ success: false, error: 'Ошибка лайка' });
  }
};

// GET /api/news/:id/comments
exports.getComments = async (req, res) => {
  try {
    const newsId = req.params.id;
    const [comments] = await sequelize.query(
      `SELECT 
        nc.*, 
        u.avatar,
        u.role,
        u.reputation
       FROM news_comments nc
       LEFT JOIN users u ON nc.user_id = u.id
       WHERE nc.news_id = :newsId 
       ORDER BY nc.created_at DESC`,
      { replacements: { newsId } }
    );
    res.json({ success: true, comments });
  } catch (error) {
    console.error('Ошибка загрузки комментариев (news):', error);
    res.status(500).json({ success: false, error: 'Ошибка загрузки комментариев' });
  }
};

// POST /api/news/:id/comments
exports.addComment = async (req, res) => {
  try {
    const { content, image_url } = req.body;
    let userId = null;
    // prefer username from request body, fallback to token username, fallback to DB, else 'Аноним'
    let userName = req.body.user_name || null;
    try {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded?.userId || decoded?.user?.id || decoded?.id || null;
        if (!userName && decoded && (decoded.username || (decoded.user && decoded.user.username))) {
          userName = decoded.username || decoded.user.username;
        }
      }
    } catch (e) {
      // ignore
    }

    if (!userId) return res.status(401).json({ success: false, error: 'Требуется авторизация для создания комментария' });

    // попытка получить username из БД, если ещё не определено
    if (!userName) {
      try {
        const [rows] = await sequelize.query(`SELECT username FROM users WHERE id = :id`, { replacements: { id: userId } });
        if (rows && rows.length > 0 && rows[0].username) userName = rows[0].username;
      } catch (e) {
        // ignore
      }
    }

    if (!userName) userName = 'Аноним';

    const [result] = await sequelize.query(
      `INSERT INTO news_comments (news_id, user_id, user_name, content, image_url, created_at) VALUES (:newsId, :userId, :userName, :content, :imageUrl, NOW()) RETURNING *`,
      {
        replacements: {
          newsId: req.params.id,
          userId,
          userName,
          content,
          imageUrl: image_url || null
        }
      }
    );

    res.json({ success: true, comment: result[0] });
  } catch (error) {
    console.error('Ошибка добавления комментария (news):', error);
    res.status(500).json({ success: false, error: 'Ошибка добавления комментария' });
  }
};

// DELETE /api/news/:newsId/comments/:commentId
exports.deleteComment = async (req, res) => {
  try {
    const { newsId, commentId } = { newsId: req.params.newsId || req.params.id, commentId: req.params.commentId };

    const [[commentRows]] = await sequelize.query(
      `SELECT id, news_id, user_id, user_name FROM news_comments WHERE id = :commentId AND news_id = :newsId`,
      { replacements: { commentId, newsId } }
    );

    const comment = commentRows;
    if (!comment) return res.status(404).json({ success: false, error: 'Комментарий не найден' });

  const isOwner = comment.user_id && req.user && String(comment.user_id) === String(req.user.id);
  const isNameMatch = comment.user_name && req.user && comment.user_name === req.user.username;
  // Privileged roles that can delete any comment (worker, manager, creator, admin)
  const privilegedRoles = ['worker', 'manager', 'creator', 'admin'];
  const isPrivileged = req.user && privilegedRoles.includes(req.user.role);

  if (!isOwner && !isNameMatch && !isPrivileged) return res.status(403).json({ success: false, error: 'Нет прав на удаление' });

    await sequelize.query(`DELETE FROM news_comments WHERE id = :commentId`, { replacements: { commentId } });
    res.json({ success: true, message: 'Комментарий удалён' });
  } catch (error) {
    console.error('Ошибка удаления комментария (news):', error);
    res.status(500).json({ success: false, error: 'Ошибка удаления комментария' });
  }
};
