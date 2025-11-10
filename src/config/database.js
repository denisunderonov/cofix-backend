const { Sequelize } = require('sequelize'); // подключаем модуль PostgresSQL;
require('dotenv').config(); // подключает переменные из env окружения;

const sequelize = new Sequelize(
  process.env.DB_NAME, 
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false 
  }
);

module.exports = sequelize;