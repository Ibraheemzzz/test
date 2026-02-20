const { body, param } = require('express-validator');

/**
 * Reviews Validation Rules
 */

/**
 * Custom validator for rating (must be multiple of 0.5)
 */
const isValidRating = (value) => {
  if (value < 1 || value > 5) {
    throw new Error('Rating must be between 1 and 5');
  }
  // Check if rating is a multiple of 0.5 (1, 1.5, 2, 2.5, etc.)
  if ((value * 2) % 1 !== 0) {
    throw new Error('Rating must be in steps of 0.5 (e.g., 1, 1.5, 2, 2.5)');
  }
  return true;
};

/**
 * Create review validation rules
 */
const create = [
  param('productId')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),

  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isFloat()
    .withMessage('Rating must be a number')
    .custom(isValidRating),

  body('comment')
    .optional()
    .isString()
    .withMessage('Comment must be a string')
    .isLength({ max: 1000 })
    .withMessage('Comment must be at most 1000 characters')
];

/**
 * Update review validation rules
 */
const update = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Review ID must be a positive integer'),

  body('rating')
    .optional()
    .isFloat()
    .withMessage('Rating must be a number')
    .custom(isValidRating),

  body('comment')
    .optional()
    .isString()
    .withMessage('Comment must be a string')
    .isLength({ max: 1000 })
    .withMessage('Comment must be at most 1000 characters')
];

/**
 * Toggle review visibility validation rules
 */
const toggleVisibility = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Review ID must be a positive integer')
];

module.exports = {
  create,
  update,
  toggleVisibility
};
