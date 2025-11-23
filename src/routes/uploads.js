const express = require('express');
const path = require('path');
const fs = require('fs');
const { upload } = require('../middleware/upload');

const router = express.Router();

// POST /api/uploads - загрузить изображение
router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'Файл не передан' });

  // Строим абсолютный URL безопасно
  const host = req.get('host');
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const url = `${protocol}://${host}/uploads/${req.file.filename}`;

  res.status(201).json({ success: true, url, filename: req.file.filename });
});

module.exports = router;
