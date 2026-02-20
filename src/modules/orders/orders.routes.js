const express = require('express');
const router = express.Router();
const ordersController = require('./orders.controller');
const { authenticate, requireAdmin, allowGuestOrUser } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const ordersValidators = require('./orders.validators');

router.post('/', authenticate, allowGuestOrUser, ordersValidators.placeOrder, validate, ordersController.placeOrder);
router.get('/', authenticate, allowGuestOrUser, ordersController.getOrders);
router.put('/:id/cancel', authenticate, allowGuestOrUser, ordersValidators.cancelOrder, validate, ordersController.cancelOrder);

// Admin Routes — قبل /:id
router.get('/admin/all', authenticate, requireAdmin, ordersController.getAllOrders);
router.put('/admin/:id/status', authenticate, requireAdmin, ordersValidators.changeStatus, validate, ordersController.changeOrderStatus);
router.get('/admin/:id/history', authenticate, requireAdmin, ordersController.getOrderStatusHistory);

// /:id في الأخير دائماً
router.get('/:id', authenticate, allowGuestOrUser, ordersController.getOrderById);

module.exports = router;