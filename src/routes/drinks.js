const express = require('express');
const router = express.Router();
const drinksController = require('../controllers/drinksController');
const drinkInteractions = require('../controllers/drinkInteractionsController');
const { protect } = require('../middleware/auth');

// Debug: log all routes being registered
console.log('🔍 Registering drinks routes...');

// GET /api/drinks - list drinks
router.get('/', drinksController.getAllDrinks);

// POST /api/drinks - create drink (protected, used by admins)
router.post('/', protect, drinksController.createDrink);

// POST /api/drinks/upload - create drink with image upload (protected)
const { upload } = require('../middleware/upload');
router.post('/upload', protect, upload.single('image'), drinksController.createDrinkWithUpload);

// Reviews routes - must come BEFORE /:id routes to avoid route collision
// GET /api/drinks/:id/reviews
router.get('/:id/reviews', drinkInteractions.getReviews);

// POST /api/drinks/:id/reviews - add a review (requires auth)
router.post('/:id/reviews', drinkInteractions.addReview);

// DELETE /api/drinks/:drinkId/reviews/:reviewId - delete a review (protected)
router.delete('/:drinkId/reviews/:reviewId', protect, drinkInteractions.deleteReview);

// GET /api/drinks/:id - get single drink
router.get('/:id', drinksController.getDrinkById);

// PATCH /api/drinks/:id - update drink (protected)
router.patch('/:id', protect, drinksController.updateDrink);

// DELETE /api/drinks/:id - delete drink (protected, creator only)
router.delete('/:id', protect, drinksController.deleteDrink);
console.log('✅ DELETE /:id route registered');

console.log('📋 All routes on drinks router:');
router.stack.forEach((r) => {
  if (r.route) {
    console.log(`  ${Object.keys(r.route.methods).join(', ').toUpperCase()} ${r.route.path}`);
  }
});

module.exports = router;
