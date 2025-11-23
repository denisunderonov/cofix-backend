const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => { 
    try {
        let token;

        if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')) { // извлечение токена из заголовков
            token = req.headers.authorization.split(' ')[1];
        }

        if(!token) {
            return res.status(401).json({
                success: false,
                message: 'Доступ запрещен'
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET); // функция проверяет корректность токена и не был ли он изменен и его срок действия
        // Поддерживаем разные форматы полезной нагрузки токена: { userId } или { user: { id } }
        const userId = decoded?.userId || decoded?.user?.id || decoded?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Невалидный токен (нет идентификатора пользователя)' });
        }
        req.user = await User.findByPk(userId);
        
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Пользователь не найден' });
        }

        next() // функция для перехода к следующей функции
    } catch(e) {
        res.status(401).json({
            status: false,
            message: 'Невалидный токен'
        }) 
    }
}