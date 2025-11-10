const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const sequelize = require('./config/database')
const authRouter = require('./routes/auth')
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 4500;


app.use(morgan('dev')); // логирование HTTP-запросов в консоль
app.use(helmet()); // защита приложения с помощью заголовков HTTP
app.use(cors()); // включение CORS для всех маршрутов (без него нельзя передавать с localhost на другой localhost)
app.use(express.json()); // парсинг JSON-тел запросов

app.use('/api/auth', authRouter); // подключение роутов авторизации и регистрации на данный путь

sequelize.sync({ force: false }).then(() => {

  console.log('✅ База данных подключена и синхронизирована');
  console.log('🔍 User после синхронизации - findOne:', typeof User.findOne);
  console.log('🔍 User после синхронизации - ключи:', Object.keys(User));

}).catch(e => {
  console.log('❌ Ошибка базы данных: ', e)
})

app.listen(PORT, () => {
  console.log(`Сервер запущен на порте ${PORT}`);
});

module.exports = app;