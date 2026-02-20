const express = require('express');
const router = express.Router();
const reviewsController = require('./reviews.controller');
const { authenticate, requireAdmin, requireUser } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const reviewsValidators = require('./reviews.validators');

/**
 * Reviews Routes
 * 
 * Note: Product reviews routes are under /api/products/:productId/reviews
 * Review management routes are under /api/reviews
 */

/**
 * @route   POST /api/products/:productId/reviews
 * @desc    Create review for product (one per user per product)
 * @access  Private (registered users only)
 */
router.post('/products/:productId/reviews', authenticate, requireUser, reviewsValidators.create, validate, reviewsController.createReview);

/**
 * @route   GET /api/products/:productId/reviews
 * @desc    Get product reviews (paginated)
 * @access  Public
 */
router.get('/products/:productId/reviews', reviewsController.getProductReviews);

/**
 * @route   PUT /api/reviews/:id
 * @desc    Edit my review
 * @access  Private (owner only)
 */
router.put('/reviews/:id', authenticate, requireUser, reviewsValidators.update, validate, reviewsController.updateReview);

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Delete my review
 * @access  Private (owner only)
 */
router.delete('/reviews/:id', authenticate, requireUser, reviewsController.deleteReview);

/**
 * Admin Routes
 */

/**
 * @route   GET /api/admin/reviews
 * @desc    Get all reviews
 * @access  Private (admin only)
 */
router.get('/admin/reviews', authenticate, requireAdmin, reviewsController.getAllReviews);

/**
 * @route   PUT /api/admin/reviews/:id/hide
 * @desc    Toggle review visibility
 * @access  Private (admin only)
 */
router.put('/admin/reviews/:id/hide', authenticate, requireAdmin, reviewsValidators.toggleVisibility, validate, reviewsController.toggleReviewVisibility);

module.exports = router;
