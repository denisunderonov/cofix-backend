const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const path = require('path');
const sequelize = require('./config/database')
const authRouter = require('./routes/auth')
const postRouter = require('./routes/post')
const newsRouter = require('./routes/news')
const drinksRouter = require('./routes/drinks')
const uploadsRouter = require('./routes/uploads')
const adminRouter = require('./routes/admin')
const userRouter = require('./routes/user')
const scheduleRouter = require('./routes/schedule')
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 4500;

// Если приложение стоит за reverse proxy (nginx, load balancer) — включаем trust proxy
app.set('trust proxy', 1);

// Лимитер общих запросов — базовая защита от DDOS/брата
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // в разработке — 1000 запросов
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// Настраиваем helmet с разрешением загрузки изображений
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "http://localhost:3000", "http://localhost:4500"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS: в продакшне указываем конкретный origin через CLIENT_URL в .env
const clientOrigin = process.env.CLIENT_URL || 'http://localhost:3000';
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow server-to-server / curl
    if (process.env.NODE_ENV === 'production') {
      if (origin === clientOrigin) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    }
    // dev: allow all
    callback(null, true);
  },
  credentials: true,
}));

// парсинг JSON с ограничением размера (защита от больших полезных нагрузок)
app.use(express.json({ limit: '50kb' }));

// Применяем rate limiter к API
app.use('/api/', apiLimiter);

// Статическая раздача загруженных файлов


app.use('/api/auth', authRouter); // подключение роутов авторизации и регистрации на данный путь
app.use('/api/posts', postRouter); // роуты для постов
app.use('/api/news', newsRouter); // роуты для новостей
app.use('/api/drinks', drinksRouter); // роуты для меню/напитков
app.use('/api/admin', adminRouter); // роуты для админки (управление ролями/users)
app.use('/api/user', userRouter); // роуты для профиля пользователя
app.use('/api/schedule', scheduleRouter); // роуты для расписания

// Статическая раздача загруженных файлов с кешированием
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), { maxAge: '30d' }));
app.use('/api/uploads', uploadsRouter); // загрузка изображений

sequelize.sync({ force: false }).then(() => {

  console.log('✅ База данных подключена и синхронизирована');
  console.log('🔍 User после синхронизации - findOne:', typeof User.findOne);
  console.log('🔍 User после синхронизации - ключи:', Object.keys(User));

}).catch(e => {
  console.log('❌ Ошибка базы данных: ', e)
})  

// Ensure the designated site creator exists and has the 'creator' role.
// This runs after initial sync; it's idempotent and safe to keep in startup.
sequelize.sync({ force: false }).then(async () => {
  try {
    const username = 'denisunderonov';
    // Assign creator role to the user with this username, if present
    const [res] = await sequelize.query(`SELECT id, username, role FROM users WHERE username = :username LIMIT 1`, { replacements: { username } });
    if (res && res.length > 0) {
      const user = res[0];
      if (user.role !== 'creator') {
        console.log(`🔧 Назначаю роль 'creator' пользователю ${username}`);
        await sequelize.query(`UPDATE users SET role = 'creator', updated_at = NOW() WHERE id = :id`, { replacements: { id: user.id } });
        // Demote any other creators to manager to keep creator unique
        await sequelize.query(`UPDATE users SET role = 'manager' WHERE role = 'creator' AND username != :username`, { replacements: { username } });
      } else {
        console.log(`ℹ️ Пользователь ${username} уже имеет роль 'creator'`);
      }
    } else {
      console.log(`⚠️ Пользователь ${username} не найден в БД. Роль не назначена автоматом.`);
    }
  } catch (err) {
    console.error('Ошибка при назначении роли creator:', err);
  }
}).catch((e) => {
  console.error('Ошибка при повторном sync при назначении creator:', e);
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порте ${PORT}`);
});

module.exports = app;