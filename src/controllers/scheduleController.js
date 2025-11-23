const sequelize = require('../config/database');

// GET /api/schedule?startDate=2025-11-24&endDate=2025-11-30
exports.getSchedule = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'startDate и endDate обязательны' });
    }

    const [shifts] = await sequelize.query(
      `SELECT 
        ws.id,
        ws.user_id,
        ws.shift_date,
        ws.start_time,
        ws.end_time,
        ws.hours,
        ws.notes,
        u.username,
        u.avatar,
        u.role
       FROM work_shifts ws
       LEFT JOIN users u ON ws.user_id = u.id
       WHERE ws.shift_date >= :startDate AND ws.shift_date <= :endDate
       ORDER BY ws.shift_date, ws.start_time, u.username`,
      { replacements: { startDate, endDate } }
    );

    res.json({ success: true, shifts });
  } catch (e) {
    console.error('scheduleController.getSchedule error', e);
    res.status(500).json({ success: false, error: 'Ошибка получения графика' });
  }
};

// POST /api/schedule - create shift
exports.createShift = async (req, res) => {
  try {
    // Only worker, manager, creator can create shifts
    if (!req.user || !['worker', 'manager', 'creator'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Нет прав' });
    }

    const { userId, shiftDate, startTime, endTime, hours, notes } = req.body;

    if (!userId || !shiftDate || !startTime || !endTime || !hours) {
      return res.status(400).json({ success: false, error: 'Все поля обязательны' });
    }

    const createdBy = req.user.id || req.user.userId;

    const [result] = await sequelize.query(
      `INSERT INTO work_shifts (user_id, shift_date, start_time, end_time, hours, notes, created_by, created_at, updated_at)
       VALUES (:userId, :shiftDate, :startTime, :endTime, :hours, :notes, :createdBy, NOW(), NOW())
       RETURNING *`,
      { replacements: { userId, shiftDate, startTime, endTime, hours, notes: notes || null, createdBy } }
    );

    res.status(201).json({ success: true, shift: result[0] });
  } catch (e) {
    console.error('scheduleController.createShift error', e);
    res.status(500).json({ success: false, error: 'Ошибка создания смены' });
  }
};

// PATCH /api/schedule/:id - update shift
exports.updateShift = async (req, res) => {
  try {
    if (!req.user || !['worker', 'manager', 'creator'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Нет прав' });
    }

    const { id } = req.params;
    const { userId, shiftDate, startTime, endTime, hours, notes } = req.body;

    const [result] = await sequelize.query(
      `UPDATE work_shifts
       SET user_id = :userId, shift_date = :shiftDate, start_time = :startTime, 
           end_time = :endTime, hours = :hours, notes = :notes, updated_at = NOW()
       WHERE id = :id
       RETURNING *`,
      { replacements: { id, userId, shiftDate, startTime, endTime, hours, notes: notes || null } }
    );

    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, error: 'Смена не найдена' });
    }

    res.json({ success: true, shift: result[0] });
  } catch (e) {
    console.error('scheduleController.updateShift error', e);
    res.status(500).json({ success: false, error: 'Ошибка обновления смены' });
  }
};

// DELETE /api/schedule/:id - delete shift
exports.deleteShift = async (req, res) => {
  try {
    if (!req.user || !['worker', 'manager', 'creator'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Нет прав' });
    }

    const { id } = req.params;

    await sequelize.query(`DELETE FROM work_shifts WHERE id = :id`, { replacements: { id } });

    res.json({ success: true, message: 'Смена удалена' });
  } catch (e) {
    console.error('scheduleController.deleteShift error', e);
    res.status(500).json({ success: false, error: 'Ошибка удаления смены' });
  }
};

// GET /api/schedule/templates - get shift templates
exports.getTemplates = async (req, res) => {
  try {
    const [templates] = await sequelize.query(
      `SELECT * FROM shift_templates ORDER BY name`
    );

    res.json({ success: true, templates });
  } catch (e) {
    console.error('scheduleController.getTemplates error', e);
    res.status(500).json({ success: false, error: 'Ошибка получения шаблонов' });
  }
};

// GET /api/schedule/employees - get users who can work (worker, manager, creator roles)
exports.getEmployees = async (req, res) => {
  try {
    console.log('getEmployees called');
    const [employees] = await sequelize.query(
      `SELECT id, username, avatar, role, reputation
       FROM users
       WHERE role IN ('worker', 'manager', 'creator')
       ORDER BY username`
    );

    console.log('Found employees:', employees.length);
    res.json({ success: true, employees });
  } catch (e) {
    console.error('scheduleController.getEmployees error', e);
    res.status(500).json({ success: false, error: 'Ошибка получения сотрудников' });
  }
};
