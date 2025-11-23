const sequelize = require('../config/database');

// GET /api/admin/users?search=...
exports.listUsers = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    let rows;
    if (search.length > 0) {
      const [result] = await sequelize.query(`SELECT id, username, email, role, reputation, created_at FROM users WHERE username ILIKE :search ORDER BY created_at DESC LIMIT 200`, { replacements: { search: `%${search}%` } });
      rows = result;
    } else {
      const [result] = await sequelize.query(`SELECT id, username, email, role, reputation, created_at FROM users ORDER BY created_at DESC LIMIT 200`);
      rows = result;
    }
    res.json({ success: true, users: rows });
  } catch (e) {
    console.error('admin.listUsers error', e);
    res.status(500).json({ success: false, error: 'Ошибка при получении списка пользователей' });
  }
};

// PATCH /api/admin/users/:id/role
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = ['guest', 'worker', 'manager', 'creator'];
    if (!allowedRoles.includes(role)) return res.status(400).json({ success: false, error: 'Неверная роль' });

    // Only site creator may assign roles
    if (!req.user || req.user.role !== 'creator') return res.status(403).json({ success: false, error: 'Нет прав' });

    // Prevent assigning creator role to arbitrary user; creator role reserved for username 'denisunderonov'
    if (role === 'creator') {
      const [rows] = await sequelize.query(`SELECT username FROM users WHERE id = :id`, { replacements: { id } });
      if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: 'Пользователь не найден' });
      if (rows[0].username !== 'denisunderonov') return res.status(400).json({ success: false, error: 'Роль creator можно назначить только пользователю denisunderonov' });
      // Optionally demote other creators — enforce uniqueness
      await sequelize.query(`UPDATE users SET role = 'manager' WHERE role = 'creator' AND id != :id`, { replacements: { id } });
    }

    const [result] = await sequelize.query(`UPDATE users SET role = :role, updated_at = NOW() WHERE id = :id RETURNING id, username, email, role`, { replacements: { role, id } });
    if (!result || result.length === 0) return res.status(404).json({ success: false, error: 'Пользователь не найден' });

    res.json({ success: true, user: result[0] });
  } catch (e) {
    console.error('admin.updateUserRole error', e);
    res.status(500).json({ success: false, error: 'Ошибка обновления роли' });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Only site creator may delete users
    if (!req.user || req.user.role !== 'creator') {
      return res.status(403).json({ success: false, error: 'Нет прав' });
    }

    // Prevent deleting yourself
    if (String(req.user.userId) === String(id)) {
      return res.status(400).json({ success: false, error: 'Нельзя удалить самого себя' });
    }

    // Check if user exists and get their username
    const [rows] = await sequelize.query(`SELECT id, username FROM users WHERE id = :id`, { replacements: { id } });
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    // Prevent deleting the main creator (denisunderonov) by another creator
    if (rows[0].username === 'denisunderonov') {
      return res.status(400).json({ success: false, error: 'Нельзя удалить главного создателя сайта' });
    }

    // Delete the user (CASCADE will handle related records if configured in DB)
    await sequelize.query(`DELETE FROM users WHERE id = :id`, { replacements: { id } });

    res.json({ success: true, message: 'Пользователь удалён' });
  } catch (e) {
    console.error('admin.deleteUser error', e);
    res.status(500).json({ success: false, error: 'Ошибка удаления пользователя' });
  }
};

// PATCH /api/admin/users/:id/reputation
exports.updateUserReputation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reputation } = req.body;

    // Only site creator may update reputation
    if (!req.user || req.user.role !== 'creator') {
      return res.status(403).json({ success: false, error: 'Нет прав' });
    }

    if (typeof reputation !== 'number') {
      return res.status(400).json({ success: false, error: 'Неверное значение репутации' });
    }

    const [result] = await sequelize.query(
      `UPDATE users SET reputation = :reputation, updated_at = NOW() WHERE id = :id RETURNING id, username, email, role, reputation`,
      { replacements: { reputation, id } }
    );

    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    res.json({ success: true, user: result[0] });
  } catch (e) {
    console.error('admin.updateUserReputation error', e);
    res.status(500).json({ success: false, error: 'Ошибка обновления репутации' });
  }
};
