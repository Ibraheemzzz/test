const { body, param } = require('express-validator');

/**
 * Orders Validation Rules
 */

/**
 * Place order validation rules
 */
const placeOrder = [
  body('items')
    .notEmpty()
    .withMessage('Items are required')
    .isArray({ min: 1 })
    .withMessage('Items must be a non-empty array'),

  body('items.*.product_id')
    .isInt({ min: 1 })
    .withMessage('Each item must have a valid product ID'),

  body('items.*.quantity')
    .isFloat({ min: 0.001 })
    .withMessage('Each item must have a quantity greater than 0'),

  body('shipping_city')
    .notEmpty()
    .withMessage('Shipping city is required')
    .isLength({ max: 100 })
    .withMessage('Shipping city must be at most 100 characters'),

  body('shipping_street')
    .notEmpty()
    .withMessage('Shipping street is required')
    .isLength({ max: 255 })
    .withMessage('Shipping street must be at most 255 characters'),

  body('shipping_building')
    .notEmpty()
    .withMessage('Shipping building is required')
    .isLength({ max: 100 })
    .withMessage('Shipping building must be at most 100 characters'),

  body('shipping_phone')
    .notEmpty()
    .withMessage('Shipping phone is required')
    .isLength({ min: 10, max: 20 })
    .withMessage('Shipping phone must be between 10 and 20 characters')
];

/**
 * Cancel order validation rules
 */
const cancelOrder = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Order ID must be a positive integer')
];

/**
 * Change order status validation rules (admin)
 */
const changeStatus = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Order ID must be a positive integer'),

  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['Shipped', 'Delivered', 'Cancelled'])
    .withMessage('Status must be one of: Shipped, Delivered, Cancelled')
];

module.exports = {
  placeOrder,
  cancelOrder,
  changeStatus
};
