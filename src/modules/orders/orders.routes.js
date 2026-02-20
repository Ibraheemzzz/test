const express = require('express');
const router = express.Router();
const ordersController = require('./orders.controller');
const { authenticate, requireAdmin, allowGuestOrUser } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const ordersValidators = require('./orders.validators');

/**
 * Orders Routes
 */

/**
 * @route   POST /api/orders
 * @desc    Place order (user or guest)
 * @access  Private (user or guest)
 */
router.post('/', authenticate, allowGuestOrUser, ordersValidators.placeOrder, validate, ordersController.placeOrder);

/**
 * @route   GET /api/orders
 * @desc    Get user's orders
 * @access  Private (user or guest)
 */
router.get('/', authenticate, allowGuestOrUser, ordersController.getOrders);

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by ID
 * @access  Private (user or guest)
 */
router.get('/:id', authenticate, allowGuestOrUser, ordersController.getOrderById);

/**
 * @route   PUT /api/orders/:id/cancel
 * @desc    Cancel order (Created status only)
 * @access  Private (registered users only)
 */
router.put('/:id/cancel', authenticate, allowGuestOrUser, ordersValidators.cancelOrder, validate, ordersController.cancelOrder);

/**
 * Admin Routes
 */

/**
 * @route   GET /api/admin/orders/all
 * @desc    Get all orders with filters
 * @access  Private (admin only)
 */
router.get('/admin/orders/all', authenticate, requireAdmin, ordersController.getAllOrders);

/**
 * @route   PUT /api/admin/orders/:id/status
 * @desc    Change order status
 * @access  Private (admin only)
 */
router.put('/admin/orders/:id/status', authenticate, requireAdmin, ordersValidators.changeStatus, validate, ordersController.changeOrderStatus);

/**
 * @route   GET /api/admin/orders/:id/history
 * @desc    Get order status history
 * @access  Private (admin only)
 */
router.get('/admin/orders/:id/history', authenticate, requireAdmin, ordersController.getOrderStatusHistory);

module.exports = router;
