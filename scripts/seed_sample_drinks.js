const sequelize = require('../src/config/database');

async function seed() {
  try {
    // Insert sample drink with explicit id 999 (id is SERIAL but explicit insert is allowed)
    const drinkSql = `
      INSERT INTO drinks (id, name, description, price, category, image_url, ingredients, created_at)
      VALUES (:id, :name, :description, :price, :category, :imageUrl, :ingredients::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price, category = EXCLUDED.category, image_url = EXCLUDED.image_url, ingredients = EXCLUDED.ingredients
      RETURNING *;
    `;

    const [drinkRes] = await sequelize.query(drinkSql, {
      replacements: {
        id: 999,
        name: 'Signature Latte',
        description: 'Наш флагманский латте с насыщенным эспрессо, шелковистой молочной пеной и легкой карамельной ноткой.',
        price: 240,
        category: 'coffee',
        imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?q=80&w=1600&auto=format&fit=crop&ixlib=rb-4.0.3&s=7b3d6f3c0a1f4c1c6c8d0a4b5f3e3a1a',
        ingredients: JSON.stringify(['Эспрессо','Молоко','Карамельный сироп'])
      }
    });

    const inserted = drinkRes[0] || drinkRes;
    console.log('Inserted drink:', inserted.id || inserted[0]?.id || 999);

    // Seed two reviews. Use existing seeded test user UUID if present, else use NULL user_id but set user_name
    const testUserId = '8e52c08d-8525-4b24-b410-6d1f49475eef';
    const reviews = [
      { rating: 5, content: 'Потрясающий латте, очень нежный вкус.', user_id: testUserId, user_name: 'testuser_bot' },
      { rating: 4, content: 'Хорошо сбалансированно, немного сладковато для меня.', user_id: testUserId, user_name: 'testuser_bot' }
    ];

    for (const r of reviews) {
      const [res] = await sequelize.query(
        `INSERT INTO drink_reviews (drink_id, user_id, user_name, rating, content, created_at) VALUES (:drinkId, :userId, :userName, :rating, :content, NOW()) ON CONFLICT DO NOTHING RETURNING *`,
        { replacements: { drinkId: 999, userId: r.user_id, userName: r.user_name, rating: r.rating, content: r.content } }
      );
      console.log('Inserted review:', res[0] || res);
    }

    // show aggregate
    const [[agg]] = await sequelize.query(`SELECT COALESCE(ROUND(AVG(rating)::numeric,2),0) AS rating, COUNT(*)::int AS reviews_count FROM drink_reviews WHERE drink_id = :id`, { replacements: { id: 999 } });
    console.log('Aggregated for drink 999:', agg);

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
