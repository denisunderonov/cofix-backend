const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => { 
    try {
        let token;

        if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')) { // извлечение токена из заголовков
            token = req.headers.authorization.split(' ')[1];
        }

        if(!token) {
            res.status(401).json({
                success: false,
                message: 'Доступ запрещен'
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET); // функция проверяет корректность токена и не был ли он изменен и его срок действия
        req.user = await User.findByPk(decoded.user.id);

        next() // функция для перехода к следующей функции
    } catch(e) {
        res.status(401).json({
            status: false,
            message: 'Невалидный токен'
        }) 
    }
}