const bcrypt = require('bcryptjs');
const { query } = require('../../config/db');
const { getPaginationParams, buildPaginatedResponse } = require('../../utils/pagination');

/**
 * Users Service
 * Handles all user-related database operations
 */

/**
 * Get user profile by ID
 * @param {number} user_id - User ID
 * @returns {Object} User profile
 */
const getProfile = async (user_id) => {
  const result = await query(
    `SELECT user_id, name, phone_number, role, points, daily_streak, 
            last_login_date, is_verified, is_active, created_at
     FROM users 
     WHERE user_id = $1`,
    [user_id]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  return result.rows[0];
};

/**
 * Update user profile
 * @param {number} user_id - User ID
 * @param {Object} updateData - Data to update
 * @returns {Object} Updated user profile
 */
const updateProfile = async (user_id, updateData) => {
  const { name, password, current_password } = updateData;

  // If password update, verify current password
  if (password) {
    const userResult = await query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const isValidPassword = await bcrypt.compare(current_password, userResult.rows[0].password_hash);

    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await query(
      `UPDATE users 
       SET name = COALESCE($1, name), password_hash = $2
       WHERE user_id = $3
       RETURNING user_id, name, phone_number, role`,
      [name, password_hash, user_id]
    );

    return result.rows[0];
  }

  // Update only name
  const result = await query(
    `UPDATE users 
     SET name = COALESCE($1, name)
     WHERE user_id = $2
     RETURNING user_id, name, phone_number, role`,
    [name, user_id]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  return result.rows[0];
};

/**
 * Get all users (admin only)
 * @param {Object} options - Query options
 * @returns {Object} Paginated users list
 */
const getAllUsers = async (options) => {
  const { search, page, limit } = options;
  const { offset } = getPaginationParams({ page, limit });

  let whereClause = 'WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  // Search filter
  if (search) {
    whereClause += ` AND (name ILIKE $${paramIndex} OR phone_number ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM users ${whereClause}`,
    params
  );
  const totalItems = parseInt(countResult.rows[0].total);

  // Get paginated users
  params.push(limit, offset);
  const result = await query(
    `SELECT user_id, name, phone_number, role, points, daily_streak, 
            is_verified, is_active, last_login_date, created_at
     FROM users 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return buildPaginatedResponse(result.rows, totalItems, parseInt(page) || 1, parseInt(limit) || 20);
};

/**
 * Toggle user active status (admin only)
 * @param {number} user_id - User ID to toggle
 * @returns {Object} Updated user status
 */
const toggleUserStatus = async (user_id) => {
  // Check if user exists
  const checkResult = await query(
    'SELECT user_id, is_active, role FROM users WHERE user_id = $1',
    [user_id]
  );

  if (checkResult.rows.length === 0) {
    throw new Error('User not found');
  }

  // Don't allow deactivating admin users
  if (checkResult.rows[0].role === 'Admin') {
    throw new Error('Cannot deactivate admin users');
  }

  const newStatus = !checkResult.rows[0].is_active;

  const result = await query(
    `UPDATE users 
     SET is_active = $1
     WHERE user_id = $2
     RETURNING user_id, name, phone_number, is_active`,
    [newStatus, user_id]
  );

  return result.rows[0];
};

/**
 * Get user by ID (admin only)
 * @param {number} user_id - User ID
 * @returns {Object} User details
 */
const getUserById = async (user_id) => {
  const result = await query(
    `SELECT user_id, name, phone_number, role, points, daily_streak, 
            is_verified, is_active, last_login_date, created_at
     FROM users 
     WHERE user_id = $1`,
    [user_id]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  return result.rows[0];
};

/**
 * Get user statistics
 * @param {number} user_id - User ID
 * @returns {Object} User statistics
 */
const getUserStats = async (user_id) => {
  // Get order count and total spent
  const orderStats = await query(
    `SELECT COUNT(*) as order_count, COALESCE(SUM(final_total), 0) as total_spent
     FROM orders 
     WHERE user_id = $1 AND status != 'Cancelled'`,
    [user_id]
  );

  // Get wishlist count
  const wishlistCount = await query(
    'SELECT COUNT(*) as count FROM wishlist WHERE user_id = $1',
    [user_id]
  );

  return {
    order_count: parseInt(orderStats.rows[0].order_count),
    total_spent: parseFloat(orderStats.rows[0].total_spent),
    wishlist_count: parseInt(wishlistCount.rows[0].count)
  };
};

module.exports = {
  getProfile,
  updateProfile,
  getAllUsers,
  toggleUserStatus,
  getUserById,
  getUserStats
};
