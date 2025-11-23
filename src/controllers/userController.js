const sequelize = require('../config/database');
const path = require('path');
const fs = require('fs');

// GET /api/user/profile - get current user profile
exports.getProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const userId = req.user.id || req.user.userId;
    const [rows] = await sequelize.query(
      `SELECT id, username, email, role, avatar, reputation, created_at FROM users WHERE id = :id`,
      { replacements: { id: userId } }
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    res.json({ success: true, user: rows[0] });
  } catch (e) {
    console.error('userController.getProfile error', e);
    res.status(500).json({ success: false, error: 'Ошибка получения профиля' });
  }
};

// POST /api/user/avatar - upload avatar
exports.uploadAvatar = async (req, res) => {
  try {
    console.log('uploadAvatar called');
    console.log('req.user:', req.user);
    console.log('req.file:', req.file);
    
    if (!req.user) {
      console.log('No req.user found');
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ success: false, error: 'Файл не загружен' });
    }

    const avatarPath = `/uploads/${req.file.filename}`;
    const userId = req.user.id || req.user.userId;

    // Get old avatar to delete it
    const [oldUser] = await sequelize.query(
      `SELECT avatar FROM users WHERE id = :id`,
      { replacements: { id: userId } }
    );

    // Update avatar in database
    const [result] = await sequelize.query(
      `UPDATE users SET avatar = :avatar, updated_at = NOW() WHERE id = :id RETURNING id, username, email, role, avatar, reputation`,
      { replacements: { avatar: avatarPath, id: userId } }
    );

    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    // Delete old avatar file if exists
    if (oldUser && oldUser[0] && oldUser[0].avatar) {
      const oldFilePath = path.join(__dirname, '..', '..', 'uploads', path.basename(oldUser[0].avatar));
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    res.json({ success: true, user: result[0] });
  } catch (e) {
    console.error('userController.uploadAvatar error', e);
    res.status(500).json({ success: false, error: 'Ошибка загрузки аватара' });
  }
};

// DELETE /api/user/avatar - delete avatar
exports.deleteAvatar = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const userId = req.user.id || req.user.userId;

    // Get current avatar
    const [oldUser] = await sequelize.query(
      `SELECT avatar FROM users WHERE id = :id`,
      { replacements: { id: userId } }
    );

    // Remove avatar from database
    const [result] = await sequelize.query(
      `UPDATE users SET avatar = NULL, updated_at = NOW() WHERE id = :id RETURNING id, username, email, role, avatar, reputation`,
      { replacements: { id: userId } }
    );

    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    // Delete avatar file if exists
    if (oldUser && oldUser[0] && oldUser[0].avatar) {
      const oldFilePath = path.join(__dirname, '..', '..', 'uploads', path.basename(oldUser[0].avatar));
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    res.json({ success: true, user: result[0] });
  } catch (e) {
    console.error('userController.deleteAvatar error', e);
    res.status(500).json({ success: false, error: 'Ошибка удаления аватара' });
  }
};

// GET /api/user/:userId - get user profile by ID
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [rows] = await sequelize.query(
      `SELECT id, username, role, avatar, reputation, created_at FROM users WHERE id = :id`,
      { replacements: { id: userId } }
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    res.json({ success: true, user: rows[0] });
  } catch (e) {
    console.error('userController.getUserById error', e);
    res.status(500).json({ success: false, error: 'Ошибка получения профиля' });
  }
};

// GET /api/user/:userId/reputation-status - check if current user voted for target user
exports.getReputationStatus = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const currentUserId = req.user.id || req.user.userId;
    const { userId: targetUserId } = req.params;

    // Check if user voted
    const [rows] = await sequelize.query(
      `SELECT vote_type FROM user_reputation_votes WHERE user_id = :currentUserId AND target_user_id = :targetUserId`,
      { replacements: { currentUserId, targetUserId } }
    );

    const hasVoted = rows && rows.length > 0;
    const voteType = hasVoted ? rows[0].vote_type : null;

    res.json({ success: true, hasVoted, voteType });
  } catch (e) {
    console.error('userController.getReputationStatus error', e);
    res.status(500).json({ success: false, error: 'Ошибка получения статуса' });
  }
};

// POST /api/user/:userId/reputation - vote for user reputation
exports.voteReputation = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }

    const currentUserId = req.user.id || req.user.userId;
    const { userId: targetUserId } = req.params;
    const { voteType } = req.body; // 'up' or 'down'

    // Can't vote for yourself
    if (currentUserId === targetUserId) {
      return res.status(400).json({ success: false, error: 'Нельзя голосовать за себя' });
    }

    if (!['up', 'down'].includes(voteType)) {
      return res.status(400).json({ success: false, error: 'Неверный тип голоса' });
    }

    // Check existing vote
    const [existingVote] = await sequelize.query(
      `SELECT vote_type FROM user_reputation_votes WHERE user_id = :currentUserId AND target_user_id = :targetUserId`,
      { replacements: { currentUserId, targetUserId } }
    );

    let reputationChange = 0;

    if (existingVote && existingVote.length > 0) {
      const oldVote = existingVote[0].vote_type;
      
      if (oldVote === voteType) {
        // Remove vote (toggle off)
        await sequelize.query(
          `DELETE FROM user_reputation_votes WHERE user_id = :currentUserId AND target_user_id = :targetUserId`,
          { replacements: { currentUserId, targetUserId } }
        );
        reputationChange = voteType === 'up' ? -1 : 1;
      } else {
        // Change vote
        await sequelize.query(
          `UPDATE user_reputation_votes SET vote_type = :voteType, updated_at = NOW() WHERE user_id = :currentUserId AND target_user_id = :targetUserId`,
          { replacements: { voteType, currentUserId, targetUserId } }
        );
        reputationChange = voteType === 'up' ? 2 : -2;
      }
    } else {
      // New vote
      await sequelize.query(
        `INSERT INTO user_reputation_votes (user_id, target_user_id, vote_type, created_at, updated_at) VALUES (:currentUserId, :targetUserId, :voteType, NOW(), NOW())`,
        { replacements: { currentUserId, targetUserId, voteType } }
      );
      reputationChange = voteType === 'up' ? 1 : -1;
    }

    // Update target user reputation
    await sequelize.query(
      `UPDATE users SET reputation = reputation + :change WHERE id = :targetUserId`,
      { replacements: { change: reputationChange, targetUserId } }
    );

    // Get updated reputation
    const [updatedUser] = await sequelize.query(
      `SELECT reputation FROM users WHERE id = :targetUserId`,
      { replacements: { targetUserId } }
    );

    const newReputation = updatedUser && updatedUser[0] ? updatedUser[0].reputation : 0;

    // Get new vote status
    const [newVote] = await sequelize.query(
      `SELECT vote_type FROM user_reputation_votes WHERE user_id = :currentUserId AND target_user_id = :targetUserId`,
      { replacements: { currentUserId, targetUserId } }
    );

    const hasVoted = newVote && newVote.length > 0;
    const currentVoteType = hasVoted ? newVote[0].vote_type : null;

    res.json({ 
      success: true, 
      reputation: newReputation,
      hasVoted,
      voteType: currentVoteType
    });
  } catch (e) {
    console.error('userController.voteReputation error', e);
    res.status(500).json({ success: false, error: 'Ошибка голосования' });
  }
};
