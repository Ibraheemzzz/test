const usersService = require('./users.service');
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse
} = require('../../utils/response');

/**
 * Users Controller
 * Handles HTTP request and response for user endpoints
 */

/**
 * Get current user profile
 * GET /api/users/profile
 * Protected route
 */
const getProfile = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const profile = await usersService.getProfile(user_id);
    const stats = await usersService.getUserStats(user_id);

    return successResponse(res, {
      ...profile,
      stats
    }, 'Profile retrieved successfully');
  } catch (error) {
    if (error.message === 'User not found') {
      return notFoundResponse(res, 'User');
    }
    console.error('Get profile error:', error);
    return serverErrorResponse(res, 'Failed to get profile');
  }
};

/**
 * Update user profile
 * PUT /api/users/profile
 * Protected route
 */
const updateProfile = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { name, password, current_password } = req.body;

    // Validate input
    if (!name && !password) {
      return errorResponse(res, 'At least one field (name or password) must be provided', 400);
    }

    // If updating password, current_password is required
    if (password && !current_password) {
      return errorResponse(res, 'Current password is required to set a new password', 400);
    }

    // Validate password length
    if (password && password.length < 6) {
      return errorResponse(res, 'Password must be at least 6 characters long', 400);
    }

    const profile = await usersService.updateProfile(user_id, {
      name,
      password,
      current_password
    });

    return successResponse(res, profile, 'Profile updated successfully');
  } catch (error) {
    if (error.message === 'User not found') {
      return notFoundResponse(res, 'User');
    }
    if (error.message === 'Current password is incorrect') {
      return errorResponse(res, error.message, 400);
    }
    console.error('Update profile error:', error);
    return serverErrorResponse(res, 'Failed to update profile');
  }
};

/**
 * Get all users (admin only)
 * GET /api/admin/users
 */
const getAllUsers = async (req, res) => {
  try {
    const { search, page, limit } = req.query;

    const result = await usersService.getAllUsers({
      search,
      page: page || 1,
      limit: limit || 20
    });

    return successResponse(res, result, 'Users retrieved successfully');
  } catch (error) {
    console.error('Get all users error:', error);
    return serverErrorResponse(res, 'Failed to get users');
  }
};

/**
 * Toggle user status (admin only)
 * PUT /api/admin/users/:id/status
 */
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid user ID', 400);
    }

    const user = await usersService.toggleUserStatus(parseInt(id));

    return successResponse(res, user, `User ${user.is_active ? 'activated' : 'deactivated'} successfully`);
  } catch (error) {
    if (error.message === 'User not found') {
      return notFoundResponse(res, 'User');
    }
    if (error.message === 'Cannot deactivate admin users') {
      return errorResponse(res, error.message, 403);
    }
    console.error('Toggle user status error:', error);
    return serverErrorResponse(res, 'Failed to toggle user status');
  }
};

/**
 * Get user by ID (admin only)
 * GET /api/admin/users/:id
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid user ID', 400);
    }

    const user = await usersService.getUserById(parseInt(id));
    const stats = await usersService.getUserStats(parseInt(id));

    return successResponse(res, {
      ...user,
      stats
    }, 'User retrieved successfully');
  } catch (error) {
    if (error.message === 'User not found') {
      return notFoundResponse(res, 'User');
    }
    console.error('Get user by ID error:', error);
    return serverErrorResponse(res, 'Failed to get user');
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getAllUsers,
  toggleUserStatus,
  getUserById
};
