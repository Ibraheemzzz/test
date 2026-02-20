const { validationResult } = require('express-validator');

/**
 * Validation Middleware
 * Collects all validation errors and returns unified error response
 */

/**
 * Validate request and return errors if any
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  // Format errors for response
  const formattedErrors = errors.array().map(error => ({
    field: error.path,
    message: error.msg
  }));

  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    data: {
      errors: formattedErrors
    }
  });
};

module.exports = {
  validate
};
