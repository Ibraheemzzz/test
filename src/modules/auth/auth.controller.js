const authService = require('./auth.service');
const {
  successResponse,
  errorResponse,
  createdResponse,
  serverErrorResponse
} = require('../../utils/response');

/**
 * Auth Controller
 * Handles HTTP request and response for authentication endpoints
 */

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { phone_number, name, password } = req.body;

    const user = await authService.register({ phone_number, name, password });

    return createdResponse(res, {
      user_id: user.user_id,
      phone_number: user.phone_number,
      name: user.name,
      role: user.role
    }, 'User registered successfully');
  } catch (error) {
    if (error.message === 'Phone number already registered') {
      return errorResponse(res, error.message, 409);
    }
    console.error('Register error:', error);
    return serverErrorResponse(res, 'Registration failed');
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { phone_number, password } = req.body;

    const result = await authService.login(phone_number, password);

    return successResponse(res, {
      user: result.user,
      token: result.token
    }, 'Login successful');
  } catch (error) {
    if (error.message === 'Invalid phone number or password') {
      return errorResponse(res, error.message, 401);
    }
    if (error.message === 'Account is deactivated. Please contact support.') {
      return errorResponse(res, error.message, 403);
    }
    console.error('Login error:', error);
    return serverErrorResponse(res, 'Login failed');
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 * Protected route
 */
const logout = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    await authService.logout(user_id);

    return successResponse(res, null, 'Logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    return serverErrorResponse(res, 'Logout failed');
  }
};

/**
 * Create guest user
 * POST /api/auth/guest
 */
const createGuest = async (req, res) => {
  try {
    const { phone_number, name } = req.body;

    const result = await authService.createGuest({ phone_number, name });

    return createdResponse(res, {
      guest: result.guest,
      token: result.token
    }, 'Guest session created');
  } catch (error) {
    console.error('Create guest error:', error);
    return serverErrorResponse(res, 'Failed to create guest session');
  }
};

/**
 * Get current user info
 * GET /api/auth/me
 * Protected route
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;

    if (user.role === 'Guest') {
      return successResponse(res, {
        guest_id: user.guest_id,
        role: 'Guest'
      }, 'Guest user');
    }

    const userInfo = await authService.verifyUser(user.user_id);

    return successResponse(res, {
      user_id: userInfo.user_id,
      phone_number: userInfo.phone_number,
      name: userInfo.name,
      role: userInfo.role
    }, 'User info retrieved');
  } catch (error) {
    console.error('Get current user error:', error);
    return serverErrorResponse(res, 'Failed to get user info');
  }
};

module.exports = {
  register,
  login,
  logout,
  createGuest,
  getCurrentUser
};
