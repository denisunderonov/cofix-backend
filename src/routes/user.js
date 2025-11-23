const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// GET /api/user/profile - get current user profile
router.get('/profile', protect, userController.getProfile);

// POST /api/user/avatar - upload avatar
router.post('/avatar', protect, upload.single('avatar'), userController.uploadAvatar);

// DELETE /api/user/avatar - delete avatar
router.delete('/avatar', protect, userController.deleteAvatar);

// GET /api/user/:userId - get user profile by ID (public)
router.get('/:userId', userController.getUserById);

// GET /api/user/:userId/reputation-status - check reputation vote status
router.get('/:userId/reputation-status', protect, userController.getReputationStatus);

// POST /api/user/:userId/reputation - vote for user reputation
router.post('/:userId/reputation', protect, userController.voteReputation);

module.exports = router;
