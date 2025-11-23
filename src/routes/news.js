const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const newsInteractions = require('../controllers/newsInteractionsController');

// GET /api/news - все новости
router.get('/', newsController.getAllNews);

// GET /api/news/:id - получить одну новость
router.get('/:id', newsController.getNewsById);

// POST /api/news - создать новость (требуется авторизация)
router.post('/', protect, newsController.createNews);

// POST /api/news/upload - создать новость и загрузить картинку в одном запросе
router.post('/upload', protect, upload.single('image'), newsController.createNewsWithUpload);

// POST /api/news/with-image - создать новость и загрузить картинку в одном запросе (legacy)
router.post('/with-image', protect, upload.single('image'), newsController.createNewsWithUpload);

// PUT /api/news/:id - обновить (требуется авторизация; только admin или автор)
router.put('/:id', protect, newsController.updateNews);

// DELETE /api/news/:id - удалить (требуется авторизация; только admin или автор)
router.delete('/:id', protect, newsController.deleteNews);

// --- interactions: comments & likes for news
// GET /api/news/:id/comments
router.get('/:id/comments', newsInteractions.getComments);

// POST /api/news/:id/comments - добавить комментарий (авторизация требуется)
router.post('/:id/comments', newsInteractions.addComment);

// DELETE /api/news/:newsId/comments/:commentId - удалить комментарий (protect middleware will provide req.user)
router.delete('/:newsId/comments/:commentId', protect, newsInteractions.deleteComment);

// POST /api/news/:id/like - лайк/анлайк
router.post('/:id/like', newsInteractions.toggleLike);

module.exports = router;
