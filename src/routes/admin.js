const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/auth');

// All admin routes are protected and only accessible to the site creator (role 'creator')
router.get('/users', protect, adminController.listUsers);
router.patch('/users/:id/role', protect, adminController.updateUserRole);
router.patch('/users/:id/reputation', protect, adminController.updateUserReputation);
router.delete('/users/:id', protect, adminController.deleteUser);

module.exports = router;
