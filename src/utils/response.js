/**
 * Unified API Response Format
 * All endpoints must return this exact structure
 */

/**
 * Success Response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const successResponse = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Error Response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {*} data - Optional additional data
 */
const errorResponse = (res, message = 'An error occurred', statusCode = 400, data = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data
  });
};

/**
 * Not Found Response
 * @param {Object} res - Express response object
 * @param {string} resource - Resource name
 */
const notFoundResponse = (res, resource = 'Resource') => {
  return res.status(404).json({
    success: false,
    message: `${resource} not found`,
    data: null
  });
};

/**
 * Unauthorized Response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const unauthorizedResponse = (res, message = 'Unauthorized access') => {
  return res.status(401).json({
    success: false,
    message,
    data: null
  });
};

/**
 * Forbidden Response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const forbiddenResponse = (res, message = 'Access forbidden') => {
  return res.status(403).json({
    success: false,
    message,
    data: null
  });
};

/**
 * Validation Error Response
 * @param {Object} res - Express response object
 * @param {string} message - Validation error message
 */
const validationErrorResponse = (res, message = 'Validation failed') => {
  return res.status(422).json({
    success: false,
    message,
    data: null
  });
};

/**
 * Server Error Response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const serverErrorResponse = (res, message = 'Internal server error') => {
  return res.status(500).json({
    success: false,
    message,
    data: null
  });
};

/**
 * Created Response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 */
const createdResponse = (res, data = {}, message = 'Created successfully') => {
  return successResponse(res, data, message, 201);
};

/**
 * No Content Response
 * @param {Object} res - Express response object
 */
const noContentResponse = (res) => {
  return res.status(204).send();
};

module.exports = {
  successResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
  createdResponse,
  noContentResponse
};
