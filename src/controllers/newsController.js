const sequelize = require('../config/database');

// Получить все новости
exports.getAllNews = async (req, res) => {
  try {
    // Попробуем извлечь userId из Authorization (если передан), чтобы вернуть флаг user_has_liked
    let userId = null;
    try {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.split(' ')[1];
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        userId = decoded?.userId || decoded?.user?.id || decoded?.id || null;
      }
    } catch (e) {
      // ignore token errors — вернём данные без флага
      userId = null;
    }

    // Подтягиваем имя автора (если есть author_id) из таблицы users
    // и считаем лайки/комментарии; также возвращаем, лайкнул ли текущий пользователь
    const [news] = await sequelize.query(`
      SELECT
        n.id, n.title, n.content, n.author, n.author_id, 
        n.image_url as image, n.created_at, n.updated_at,
        u.username as author_username,
  CAST(COUNT(DISTINCT l.id) AS INTEGER) as likes_count,
  CAST(COUNT(DISTINCT c.id) AS INTEGER) as comments_count,
        EXISTS(
          SELECT 1 FROM news_likes nl WHERE nl.news_id = n.id ${userId ? 'AND nl.user_id = :userId' : 'AND false'}
        ) as user_has_liked
      FROM news n
      LEFT JOIN users u ON n.author_id = u.id
      LEFT JOIN news_likes l ON n.id = l.news_id
      LEFT JOIN news_comments c ON n.id = c.news_id
      GROUP BY n.id, u.username
      ORDER BY n.created_at DESC
    `, {
      replacements: { userId }
    });

    // Если в таблице news пока нет записей (dev-режим), возвращаем пару примеров
    if (!news || news.length === 0) {
      const sample = [
        {
          id: 1,
          title: 'Открытие новой чашки латте',
          content: 'Приходите на бесплатную дегустацию латте в эту субботу — приглашаем всех! Подробнее на стойке.',
          author: 'Кофейня',
          author_username: 'Кофейня',
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          title: 'Скидка на круассаны по утрам',
          content: 'Каждое утро с 8:00 до 10:00 — 20% скидка на круассаны при покупке кофе.',
          author: 'Кофейня',
          author_username: 'Кофейня',
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        },
      ];

      return res.json({ success: true, news: sample });
    }

    res.json({ success: true, news });
  } catch (error) {
    console.error('Ошибка загрузки новостей:', error);
    res.status(500).json({ success: false, error: 'Ошибка загрузки новостей' });
  }
};

// Получить новость по id
exports.getNewsById = async (req, res) => {
  try {
    // Получаем пост с агрегированными счетчиками и флагом лайка текущего пользователя (если есть)
    let userId = null;
    try {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.split(' ')[1];
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        userId = decoded?.userId || decoded?.user?.id || decoded?.id || null;
      }
    } catch (e) {
      userId = null;
    }

    const [rows] = await sequelize.query(`
      SELECT
        n.id, n.title, n.content, n.author, n.author_id,
        n.image_url as image, n.created_at, n.updated_at,
        u.username as author_username,
  CAST(COUNT(DISTINCT l.id) AS INTEGER) as likes_count,
  CAST(COUNT(DISTINCT c.id) AS INTEGER) as comments_count,
        EXISTS(SELECT 1 FROM news_likes nl WHERE nl.news_id = n.id ${userId ? 'AND nl.user_id = :userId' : 'AND false'}) as user_has_liked
      FROM news n
      LEFT JOIN users u ON n.author_id = u.id
      LEFT JOIN news_likes l ON n.id = l.news_id
      LEFT JOIN news_comments c ON n.id = c.news_id
      WHERE n.id = :id
      GROUP BY n.id, u.username
      LIMIT 1
    `, { replacements: { id: req.params.id, userId } });

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Новость не найдена' });
    }

    res.json({ success: true, news: rows[0] });
  } catch (error) {
    console.error('Ошибка получения новости:', error);
    res.status(500).json({ success: false, error: 'Ошибка получения новости' });
  }
};

// Создать новость
exports.createNews = async (req, res) => {
  try {
    const { title, content, author, image_url } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, error: 'title и content обязательны' });

    // Только роль 'creator' может создавать новости
    if (!req.user || req.user.role !== 'creator') return res.status(403).json({ success: false, error: 'Нет прав для создания новости' });

    const authorId = req.user.id;
    const authorName = req.user.username;

    const [result] = await sequelize.query(`
      INSERT INTO news (title, content, author, author_id, image_url, created_at)
      VALUES (:title, :content, :author, :authorId, :imageUrl, NOW())
      RETURNING *
    `, {
      replacements: { title, content, author: authorName, authorId, imageUrl: image_url || null }
    });

    res.status(201).json({ success: true, news: result[0] });
  } catch (error) {
    console.error('Ошибка создания новости:', error);
    res.status(500).json({ success: false, error: 'Ошибка создания новости' });
  }
};

// Создать новость вместе с загрузкой изображения (multipart/form-data с полем 'image')
exports.createNewsWithUpload = async (req, res) => {
  try {
    const { title, content, author } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, error: 'title и content обязательны' });

    // Только роль 'creator' может создавать новости
    if (!req.user || req.user.role !== 'creator') return res.status(403).json({ success: false, error: 'Нет прав для создания новости' });

    // Если файл передан — сохраняем относительный путь
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const authorId = req.user ? req.user.id : null;
    const authorName = req.user ? req.user.username : (author || 'Аноним');

    const [result] = await sequelize.query(`
      INSERT INTO news (title, content, author, author_id, image_url, created_at)
      VALUES (:title, :content, :author, :authorId, :imageUrl, NOW())
      RETURNING *
    `, {
      replacements: { title, content, author: authorName, authorId, imageUrl }
    });

    res.status(201).json({ success: true, news: result[0] });
  } catch (error) {
    console.error('Ошибка создания новости с загрузкой:', error);
    res.status(500).json({ success: false, error: 'Ошибка создания новости' });
  }
};

// Обновить новость
exports.updateNews = async (req, res) => {
  try {
    const { title, content, image_url } = req.body;
    const id = req.params.id;

    // Получаем существующую новость чтобы проверить права
    const [rows] = await sequelize.query(`SELECT * FROM news WHERE id = :id`, { replacements: { id } });
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: 'Новость не найдена' });
    const existing = rows[0];

    // Проверка прав: только admin или автор (author_id)
    if (!(req.user && (['admin','creator'].includes(req.user.role) || (existing.author_id && String(existing.author_id) === String(req.user.id))))) {
      return res.status(403).json({ success: false, error: 'Нет прав для обновления новости' });
    }

    const [result] = await sequelize.query(`
      UPDATE news SET
        title = COALESCE(:title, title),
        content = COALESCE(:content, content),
        image_url = COALESCE(:image_url, image_url),
        updated_at = NOW()
      WHERE id = :id
      RETURNING *
    `, {
      replacements: { id, title, content, image_url }
    });

    res.json({ success: true, news: result[0] });
  } catch (error) {
    console.error('Ошибка обновления новости:', error);
    res.status(500).json({ success: false, error: 'Ошибка обновления новости' });
  }
};

// Удалить новость
exports.deleteNews = async (req, res) => {
  try {
    const id = req.params.id;

    // Получаем запись, чтобы проверить права
    const [rows] = await sequelize.query(`SELECT * FROM news WHERE id = :id`, { replacements: { id } });
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: 'Новость не найдена' });
    const existing = rows[0];

    if (!(req.user && (['admin','creator'].includes(req.user.role) || (existing.author_id && String(existing.author_id) === String(req.user.id))))) {
      return res.status(403).json({ success: false, error: 'Нет прав для удаления новости' });
    }

    await sequelize.query(`DELETE FROM news WHERE id = :id`, { replacements: { id } });
    res.json({ success: true, message: 'Новость удалена' });
  } catch (error) {
    console.error('Ошибка удаления новости:', error);
    res.status(500).json({ success: false, error: 'Ошибка удаления новости' });
  }
};
