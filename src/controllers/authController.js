const User = require("../models/User");
const jwt = require("jsonwebtoken"); // jwt-токен, который используется как "пропуск чтобы постоянно не показывать паспорт(важно не кодировать важную информацию)"

console.log(' User model тип:', typeof User);
console.log(' User.findOne тип:', typeof User.findOne);
console.log(' User model ключи:', Object.keys(User));
// генерация токена — включаем userId, username и role чтобы клиенты и контроллеры могли использовать эти данные
const generateToken = (user) => {
  const payload = {
    userId: user.id || user.userId || user,
  };
  if (user.username) payload.username = user.username;
  if (user.role) payload.role = user.role;
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

exports.register = async (req, res) => {
  try {

    console.log('📨 Запрос на регистрацию, тело запроса: ', req.body);

    const { username, email, password } = req.body;

    // Check if a user with the same username OR email already exists
    const { Op } = require('sequelize');
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Пользователь с таким email или username уже существует",
      });
    }

    // If username is the designated site owner, give them the 'creator' role.
    const roleToAssign = username === 'denisunderonov' ? 'creator' : undefined;

    const user = await User.create({
      username,
      email,
      password,
      ...(roleToAssign ? { role: roleToAssign } : {}),
    });

  const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "Успешная регистрация",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        reputation: user.reputation || 0,
      },
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Ошибка сервера",
      error: e.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // allow login by username OR email
    const { Op } = require('sequelize');
    const conditions = [];
    if (username) conditions.push({ username });
    if (email) conditions.push({ email });

    if (conditions.length === 0) {
      return res.status(400).json({ success: false, message: 'username или email обязателен' });
    }

    const user = await User.findOne({ where: { [Op.or]: conditions } });

    if (!user || !(await user.validatePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
      });
    }

  const token = generateToken(user);

    res.json({
      success: true,
      message: "Вход выполнен",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        reputation: user.reputation || 0,
      },
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Ошибка сервера",
    });
  }
};
