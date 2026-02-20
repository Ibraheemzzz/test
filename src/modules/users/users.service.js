const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
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
  const user = await prisma.user.findUnique({
    where: { user_id },
    select: {
      user_id: true,
      name: true,
      phone_number: true,
      role: true,
      points: true,
      daily_streak: true,
      last_login_date: true,
      is_verified: true,
      is_active: true,
      created_at: true
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
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
    const user = await prisma.user.findUnique({
      where: { user_id },
      select: { password_hash: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await bcrypt.compare(current_password, user.password_hash);

    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const updatedUser = await prisma.user.update({
      where: { user_id },
      data: { name, password_hash },
      select: {
        user_id: true,
        name: true,
        phone_number: true,
        role: true
      }
    });

    return updatedUser;
  }

  // Update only name
  const updatedUser = await prisma.user.update({
    where: { user_id },
    data: { name },
    select: {
      user_id: true,
      name: true,
      phone_number: true,
      role: true
    }
  });

  if (!updatedUser) {
    throw new Error('User not found');
  }

  return updatedUser;
};

/**
 * Get all users (admin only)
 * @param {Object} options - Query options
 * @returns {Object} Paginated users list
 */
const getAllUsers = async (options) => {
  const { search, page, limit } = options;
  const { skip, take } = { 
    skip: (parseInt(page) - 1) * parseInt(limit), 
    take: parseInt(limit) 
  };

  // Build where clause
  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone_number: { contains: search, mode: 'insensitive' } }
    ];
  }

  // Get total count
  const totalItems = await prisma.user.count({ where });

  // Get paginated users
  const users = await prisma.user.findMany({
    where,
    select: {
      user_id: true,
      name: true,
      phone_number: true,
      role: true,
      points: true,
      daily_streak: true,
      is_verified: true,
      is_active: true,
      last_login_date: true,
      created_at: true
    },
    orderBy: { created_at: 'desc' },
    skip,
    take
  });

  return buildPaginatedResponse(users, totalItems, parseInt(page) || 1, parseInt(limit) || 20);
};

/**
 * Toggle user active status (admin only)
 * @param {number} user_id - User ID to toggle
 * @returns {Object} Updated user status
 */
const toggleUserStatus = async (user_id) => {
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { user_id },
    select: { user_id: true, is_active: true, role: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Don't allow deactivating admin users
  if (user.role === 'Admin') {
    throw new Error('Cannot deactivate admin users');
  }

  const newStatus = !user.is_active;

  const updatedUser = await prisma.user.update({
    where: { user_id },
    data: { is_active: newStatus },
    select: {
      user_id: true,
      name: true,
      phone_number: true,
      is_active: true
    }
  });

  return updatedUser;
};

/**
 * Get user by ID (admin only)
 * @param {number} user_id - User ID
 * @returns {Object} User details
 */
const getUserById = async (user_id) => {
  const user = await prisma.user.findUnique({
    where: { user_id },
    select: {
      user_id: true,
      name: true,
      phone_number: true,
      role: true,
      points: true,
      daily_streak: true,
      is_verified: true,
      is_active: true,
      last_login_date: true,
      created_at: true
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

/**
 * Get user statistics
 * @param {number} user_id - User ID
 * @returns {Object} User statistics
 */
const getUserStats = async (user_id) => {
  // Get order count and total spent
  const orderStats = await prisma.order.aggregate({
    where: {
      user_id,
      status: { not: 'Cancelled' }
    },
    _count: { order_id: true },
    _sum: { final_total: true }
  });

  // Get wishlist count
  const wishlistCount = await prisma.wishlist.count({
    where: { user_id }
  });

  return {
    order_count: orderStats._count.order_id,
    total_spent: parseFloat(orderStats._sum.final_total || 0),
    wishlist_count: wishlistCount
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
