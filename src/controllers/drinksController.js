const sequelize = require('../config/database');

// GET /api/drinks - list drinks with aggregated rating and reviews_count
exports.getAllDrinks = async (req, res) => {
  try {
    const [drinks] = await sequelize.query(`
      SELECT
        d.id, d.name, d.description, d.price, d.category,
        d.image_url as image, d.ingredients, d.created_at, d.updated_at,
        COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0) as rating,
        CAST(COUNT(r.id) AS INTEGER) as reviews_count
      FROM drinks d
      LEFT JOIN drink_reviews r ON d.id = r.drink_id
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `);

    // if empty in dev, return small sample to help frontend
    if (!drinks || drinks.length === 0) {
      const sample = [
        {
          id: 999,
          name: 'Signature Latte',
          description: 'Кремовый латте на основе корицы и карамели',
          price: 4.50,
          category: 'latte',
          image_url: null,
          ingredients: JSON.stringify(['espresso', 'milk', 'cinnamon', 'caramel']),
          rating: 4.5,
          reviews_count: 2,
          created_at: new Date().toISOString(),
        }
      ];
      return res.json({ success: true, drinks: sample });
    }

    res.json({ success: true, drinks });
  } catch (error) {
    console.error('Ошибка загрузки напитков:', error);
    res.status(500).json({ success: false, error: 'Ошибка загрузки напитков' });
  }
};

// GET /api/drinks/:id - get single drink with aggregated rating and reviews_count
exports.getDrinkById = async (req, res) => {
  try {
    const [rows] = await sequelize.query(`
      SELECT
        d.id, d.name, d.description, d.price, d.category,
        d.image_url as image, d.ingredients, d.created_at, d.updated_at,
        COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0) as rating,
        CAST(COUNT(r.id) AS INTEGER) as reviews_count
      FROM drinks d
      LEFT JOIN drink_reviews r ON d.id = r.drink_id
      WHERE d.id = :id
      GROUP BY d.id
      LIMIT 1
    `, { replacements: { id: req.params.id } });

    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: 'Напиток не найден' });

    res.json({ success: true, drink: rows[0] });
  } catch (error) {
    console.error('Ошибка получения напитка:', error);
    res.status(500).json({ success: false, error: 'Ошибка получения напитка' });
  }
};

// POST /api/drinks - create a new drink (protected)
exports.createDrink = async (req, res) => {
  try {
    const { name, description, price, category, image_url, ingredients } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    // Only 'creator' role can create new drinks
    if (!req.user || req.user.role !== 'creator') return res.status(403).json({ success: false, error: 'Нет прав для создания напитка' });

    const [result] = await sequelize.query(`
      INSERT INTO drinks (name, description, price, category, image_url, ingredients, created_at)
      VALUES (:name, :description, :price, :category, :imageUrl, :ingredients, NOW())
      RETURNING *
    `, {
      replacements: { name, description, price: price || null, category: category || null, imageUrl: image_url || null, ingredients: ingredients ? JSON.stringify(ingredients) : null }
    });

    res.status(201).json({ success: true, drink: result[0] });
  } catch (error) {
    console.error('Ошибка создания напитка:', error);
    res.status(500).json({ success: false, error: 'Ошибка создания напитка' });
  }
};

// POST /api/drinks/upload - create drink with image upload (multipart/form-data with 'image' field)
exports.createDrinkWithUpload = async (req, res) => {
  try {
    const { name, description, price, category } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    
    // Only 'creator' role can create new drinks
    if (!req.user || req.user.role !== 'creator') return res.status(403).json({ success: false, error: 'Нет прав для создания напитка' });

    // Save relative path for uploaded image
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const [result] = await sequelize.query(`
      INSERT INTO drinks (name, description, price, category, image_url, created_at)
      VALUES (:name, :description, :price, :category, :imageUrl, NOW())
      RETURNING *
    `, {
      replacements: {
        name,
        description: description || null,
        price: price ? parseFloat(price) : null,
        category: category || null,
        imageUrl
      }
    });

    res.status(201).json({ success: true, drink: result[0] });
  } catch (error) {
    console.error('Ошибка создания напитка с загрузкой:', error);
    res.status(500).json({ success: false, error: 'Ошибка создания напитка' });
  }
};

// PATCH /api/drinks/:id - update an existing drink (protected, creator only)
exports.updateDrink = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description, price, category, image_url, ingredients } = req.body;

    if (!req.user || req.user.role !== 'creator') return res.status(403).json({ success: false, error: 'Нет прав для редактирования напитка' });

    // Build SET clause dynamically
    const fields = [];
    const replacements = { id };
    if (name !== undefined) { fields.push('name = :name'); replacements.name = name; }
    if (description !== undefined) { fields.push('description = :description'); replacements.description = description; }
    if (price !== undefined) { fields.push('price = :price'); replacements.price = price; }
    if (category !== undefined) { fields.push('category = :category'); replacements.category = category; }
    if (image_url !== undefined) { fields.push('image_url = :image_url'); replacements.image_url = image_url; }
    if (ingredients !== undefined) { fields.push('ingredients = :ingredients'); replacements.ingredients = JSON.stringify(ingredients); }

    if (fields.length === 0) return res.status(400).json({ success: false, error: 'Нет полей для обновления' });

    const setClause = fields.join(', ');
    const [result] = await sequelize.query(`
      UPDATE drinks SET ${setClause}, updated_at = NOW() WHERE id = :id RETURNING *
    `, { replacements });

    if (!result || result.length === 0) return res.status(404).json({ success: false, error: 'Напиток не найден' });

    res.json({ success: true, drink: result[0] });
  } catch (error) {
    console.error('Ошибка обновления напитка:', error);
    res.status(500).json({ success: false, error: 'Ошибка обновления напитка' });
  }
};

// DELETE /api/drinks/:id - delete drink (creator only)
exports.deleteDrink = async (req, res) => {
  try {
    const id = req.params.id;

    // Only creator can delete drinks
    if (!req.user || req.user.role !== 'creator') {
      return res.status(403).json({ success: false, error: 'Нет прав для удаления напитка' });
    }

    // Check if drink exists
    const [existing] = await sequelize.query(`SELECT id FROM drinks WHERE id = :id`, { replacements: { id } });
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Напиток не найден' });
    }

    // Delete drink (reviews will be deleted via CASCADE if FK is set, or separately)
    await sequelize.query(`DELETE FROM drinks WHERE id = :id`, { replacements: { id } });

    res.json({ success: true, message: 'Напиток удалён' });
  } catch (error) {
    console.error('Ошибка удаления напитка:', error);
    res.status(500).json({ success: false, error: 'Ошибка удаления напитка' });
  }
};
