const { body, param } = require('express-validator');

/**
 * Cart Validation Rules
 */

/**
 * Add to cart validation rules
 */
const addToCart = [
  body('product_id')
    .notEmpty()
    .withMessage('Product ID is required')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),

  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isFloat({ min: 0.001 })
    .withMessage('Quantity must be greater than 0')
];

/**
 * Update cart item validation rules
 */
const updateCartItem = [
  param('productId')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),

  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isFloat({ min: 0 })
    .withMessage('Quantity must be greater than or equal to 0')
];

/**
 * Remove from cart validation rules
 */
const removeFromCart = [
  param('productId')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer')
];

module.exports = {
  addToCart,
  updateCartItem,
  removeFromCart
};
