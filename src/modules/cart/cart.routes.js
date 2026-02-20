const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const { authenticate, requireUser } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const cartValidators = require('./cart.validators');

/**
 * Cart Routes
 * Note: Guests do not have a cart in the database - guest cart lives in the browser
 */

/**
 * @route   GET /api/cart
 * @desc    Get user's cart with items and totals
 * @access  Private (registered users only)
 */
router.get('/', authenticate, requireUser, cartController.getCart);

/**
 * @route   GET /api/cart/validate
 * @desc    Validate cart items against stock
 * @access  Private (registered users only)
 */
router.get('/validate', authenticate, requireUser, cartController.validateCart);

/**
 * @route   POST /api/cart/items
 * @desc    Add item to cart
 * @access  Private (registered users only)
 */
router.post('/items', authenticate, requireUser, cartValidators.addToCart, validate, cartController.addToCart);

/**
 * @route   PUT /api/cart/items/:productId
 * @desc    Update cart item quantity
 * @access  Private (registered users only)
 */
router.put('/items/:productId', authenticate, requireUser, cartValidators.updateCartItem, validate, cartController.updateCartItem);

/**
 * @route   DELETE /api/cart/items/:productId
 * @desc    Remove item from cart
 * @access  Private (registered users only)
 */
router.delete('/items/:productId', authenticate, requireUser, cartValidators.removeFromCart, validate, cartController.removeFromCart);

/**
 * @route   DELETE /api/cart
 * @desc    Clear all items from cart
 * @access  Private (registered users only)
 */
router.delete('/', authenticate, requireUser, cartController.clearCart);

module.exports = router;
