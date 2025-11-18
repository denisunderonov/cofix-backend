const User = require("../models/User");
const jwt = require("jsonwebtoken"); // jwt-токен, который используется как "пропуск чтобы постоянно не показывать паспорт(важно не кодировать важную информацию)"

console.log(' User model тип:', typeof User);
console.log(' User.findOne тип:', typeof User.findOne);
console.log(' User model ключи:', Object.keys(User));
//генерация токена
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

exports.register = async (req, res) => {
  try {

    console.log('📨 Запрос на регистрацию, тело запроса: ', req.body);

    const { username, email, password } = req.body;

    const existingUser = await User.findOne({
      where: { email, username },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Такая почта или имя пользователя",
      });
    }

    const user = await User.create({
      username,
      email,
      password,
    });

    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: "Успешная регистрация",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
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
    const { username, password } = req.body;

    const user = await User.findOne({ where: { username } });

    if (!user || !(await user.validatePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
      });
    }

    const token = generateToken(user.id);

    res.json({
      success: true,
      message: "Вход выполнен",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Ошибка сервера",
    });
  }
};
