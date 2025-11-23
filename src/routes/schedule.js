const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const { protect } = require('../middleware/auth');

// Get schedule for date range
router.get('/', scheduleController.getSchedule);

// Get employees list
router.get('/employees', protect, scheduleController.getEmployees);

// Get shift templates
router.get('/templates', protect, scheduleController.getTemplates);

// Create shift (worker, manager, creator only)
router.post('/', protect, scheduleController.createShift);

// Update shift
router.patch('/:id', protect, scheduleController.updateShift);

// Delete shift
router.delete('/:id', protect, scheduleController.deleteShift);

module.exports = router;
