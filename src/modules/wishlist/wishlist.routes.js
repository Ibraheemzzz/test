const express = require('express');
const router = express.Router();
const wishlistController = require('./wishlist.controller');
const { authenticate, requireUser } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { param } = require('express-validator');

/**
 * Wishlist Routes
 */

/**
 * Wishlist param validation
 */
const productIdParam = [
  param('productId')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer')
];

/**
 * @route   GET /api/wishlist
 * @desc    Get user's wishlist
 * @access  Private (registered users only)
 */
router.get('/', authenticate, requireUser, wishlistController.getWishlist);

/**
 * @route   GET /api/wishlist/:productId
 * @desc    Check if product is in wishlist
 * @access  Private (registered users only)
 */
router.get('/:productId', authenticate, requireUser, productIdParam, validate, wishlistController.checkWishlist);

/**
 * @route   POST /api/wishlist/:productId
 * @desc    Add product to wishlist
 * @access  Private (registered users only)
 */
router.post('/:productId', authenticate, requireUser, productIdParam, validate, wishlistController.addToWishlist);

/**
 * @route   DELETE /api/wishlist/:productId
 * @desc    Remove product from wishlist
 * @access  Private (registered users only)
 */
router.delete('/:productId', authenticate, requireUser, productIdParam, validate, wishlistController.removeFromWishlist);

module.exports = router;
