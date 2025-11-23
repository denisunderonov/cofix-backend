const sequelize = require('../config/database');
const jwt = require('jsonwebtoken');

// GET /api/drinks/:id/reviews
exports.getReviews = async (req, res) => {
  try {
    const drinkId = req.params.id;
    const [reviews] = await sequelize.query(
      `SELECT 
        dr.*, 
        u.avatar,
        u.role,
        u.reputation
       FROM drink_reviews dr
       LEFT JOIN users u ON dr.user_id = u.id
       WHERE dr.drink_id = :drinkId 
       ORDER BY dr.created_at DESC`,
      { replacements: { drinkId } }
    );
    res.json({ success: true, reviews });
  } catch (error) {
    console.error('Ошибка загрузки отзывов (drinks):', error);
    res.status(500).json({ success: false, error: 'Ошибка загрузки отзывов' });
  }
};

// POST /api/drinks/:id/reviews
exports.addReview = async (req, res) => {
  try {
    const { content, rating } = req.body;
    if (!rating) return res.status(400).json({ success: false, error: 'rating обязательен' });

    let userId = null;
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

    if (!userId) return res.status(401).json({ success: false, error: 'Требуется авторизация для создания отзыва' });

    // attempt to get username from DB if missing
    if (!userName) {
      try {
        const [rows] = await sequelize.query(`SELECT username FROM users WHERE id = :id`, { replacements: { id: userId } });
        if (rows && rows.length > 0 && rows[0].username) userName = rows[0].username;
      } catch (e) { }
    }

    if (!userName) userName = 'Аноним';

    const [result] = await sequelize.query(
      `INSERT INTO drink_reviews (drink_id, user_id, user_name, rating, content, created_at) VALUES (:drinkId, :userId, :userName, :rating, :content, NOW()) RETURNING *`,
      {
        replacements: {
          drinkId: req.params.id,
          userId,
          userName,
          rating: parseInt(rating, 10),
          content: content || null
        }
      }
    );

    // recompute aggregated rating and reviews_count
    const [[agg]] = await sequelize.query(
      `SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) as rating, COUNT(*)::int as reviews_count FROM drink_reviews WHERE drink_id = :drinkId`,
      { replacements: { drinkId: req.params.id } }
    );

    res.status(201).json({ success: true, review: result[0], rating: parseFloat(agg.rating), reviews_count: agg.reviews_count });
  } catch (error) {
    console.error('Ошибка добавления отзыва (drinks):', error);
    res.status(500).json({ success: false, error: 'Ошибка добавления отзыва' });
  }
};

// DELETE /api/drinks/:drinkId/reviews/:reviewId
exports.deleteReview = async (req, res) => {
  try {
    const { drinkId, reviewId } = { drinkId: req.params.drinkId || req.params.id, reviewId: req.params.reviewId };

    const [[reviewRows]] = await sequelize.query(`SELECT id, drink_id, user_id, user_name FROM drink_reviews WHERE id = :reviewId AND drink_id = :drinkId`, { replacements: { reviewId, drinkId } });
    const review = reviewRows;
    if (!review) return res.status(404).json({ success: false, error: 'Отзыв не найден' });

  const isOwner = review.user_id && req.user && String(review.user_id) === String(req.user.id);
  const isNameMatch = review.user_name && req.user && review.user_name === req.user.username;
  const privilegedRoles = ['worker', 'manager', 'creator', 'admin'];
  const isPrivileged = req.user && privilegedRoles.includes(req.user.role);

  if (!isOwner && !isNameMatch && !isPrivileged) return res.status(403).json({ success: false, error: 'Нет прав на удаление' });

    await sequelize.query(`DELETE FROM drink_reviews WHERE id = :reviewId`, { replacements: { reviewId } });
    res.json({ success: true, message: 'Отзыв удалён' });
  } catch (error) {
    console.error('Ошибка удаления отзыва (drinks):', error);
    res.status(500).json({ success: false, error: 'Ошибка удаления отзыва' });
  }
};
