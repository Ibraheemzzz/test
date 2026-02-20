const express = require('express');
const router = express.Router();
const usersController = require('./users.controller');
const { authenticate, requireAdmin, requireUser } = require('../../middlewares/auth.middleware');

/**
 * Users Routes
 */

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private (registered users only)
 */
router.get('/profile', authenticate, requireUser, usersController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user profile
 * @access  Private (registered users only)
 */
router.put('/profile', authenticate, requireUser, usersController.updateProfile);

/**
 * Admin Routes
 */

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with search and pagination
 * @access  Private (admin only)
 */
router.get('/admin/users', authenticate, requireAdmin, usersController.getAllUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get user by ID
 * @access  Private (admin only)
 */
router.get('/admin/users/:id', authenticate, requireAdmin, usersController.getUserById);

/**
 * @route   PUT /api/admin/users/:id/status
 * @desc    Toggle user active status
 * @access  Private (admin only)
 */
router.put('/admin/users/:id/status', authenticate, requireAdmin, usersController.toggleUserStatus);

module.exports = router;
