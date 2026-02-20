const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const authValidators = require('./auth.validators');

/**
 * Auth Routes
 * Public routes for authentication
 */

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authValidators.register, validate, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT token
 * @access  Public
 */
router.post('/login', authValidators.login, validate, authController.login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (protected route)
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   POST /api/auth/guest
 * @desc    Create guest session and return guest JWT
 * @access  Public
 */
router.post('/guest', authValidators.guest, validate, authController.createGuest);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user info
 * @access  Private
 */
router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router;
