const { body } = require('express-validator');

/**
 * Products Validation Rules
 */

/**
 * Create product validation rules
 */
const create = [
  body('name')
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 2, max: 255 })
    .withMessage('Product name must be between 2 and 255 characters'),

  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string'),

  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),

  body('cost_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost price must be a non-negative number'),

  body('sale_type')
    .notEmpty()
    .withMessage('Sale type is required')
    .isIn(['kg', 'piece'])
    .withMessage('Sale type must be "kg" or "piece"'),

  body('stock_quantity')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Stock quantity must be a non-negative number'),

  body('category_id')
    .notEmpty()
    .withMessage('Category ID is required')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
];

/**
 * Update product validation rules
 */
const update = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 255 })
    .withMessage('Product name must be between 2 and 255 characters'),

  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string'),

  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),

  body('cost_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost price must be a non-negative number'),

  body('sale_type')
    .optional()
    .isIn(['kg', 'piece'])
    .withMessage('Sale type must be "kg" or "piece"'),

  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
];

/**
 * Adjust stock validation rules
 */
const adjustStock = [
  body('quantity_change')
    .notEmpty()
    .withMessage('Quantity change is required')
    .isFloat()
    .withMessage('Quantity change must be a number'),

  body('reason')
    .notEmpty()
    .withMessage('Reason is required')
    .isIn(['admin_add', 'admin_remove'])
    .withMessage('Reason must be "admin_add" or "admin_remove"')
];

module.exports = {
  create,
  update,
  adjustStock
};
