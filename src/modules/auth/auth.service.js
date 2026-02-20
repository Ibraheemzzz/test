const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/db');

/**
 * Auth Service
 * Handles all authentication-related database operations
 */

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Object} Created user
 */
const register = async (userData) => {
  const { phone_number, name, password } = userData;

  // Check if phone number already exists
  const existingUser = await query(
    'SELECT user_id FROM users WHERE phone_number = $1',
    [phone_number]
  );

  if (existingUser.rows.length > 0) {
    throw new Error('Phone number already registered');
  }

  // Hash password
  const saltRounds = 10;
  const password_hash = await bcrypt.hash(password, saltRounds);

  // Insert new user
  const result = await query(
    `INSERT INTO users (phone_number, name, password_hash, role, is_active, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING user_id, phone_number, name, role, created_at`,
    [phone_number, name, password_hash, 'Customer', true, false]
  );

  return result.rows[0];
};

/**
 * Login user
 * @param {string} phone_number - User's phone number
 * @param {string} password - User's password
 * @returns {Object} User data with JWT token
 */
const login = async (phone_number, password) => {
  // Find user by phone number
  const result = await query(
    'SELECT user_id, phone_number, name, password_hash, role, is_active FROM users WHERE phone_number = $1',
    [phone_number]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid phone number or password');
  }

  const user = result.rows[0];

  // Check if user is active
  if (!user.is_active) {
    throw new Error('Account is deactivated. Please contact support.');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    throw new Error('Invalid phone number or password');
  }

  // Generate JWT token
  const token = generateToken(user.user_id, user.role);

  // Update last login date
  await query(
    'UPDATE users SET last_login_date = CURRENT_DATE WHERE user_id = $1',
    [user.user_id]
  );

  return {
    user: {
      user_id: user.user_id,
      phone_number: user.phone_number,
      name: user.name,
      role: user.role
    },
    token
  };
};

/**
 * Logout user (client-side token invalidation)
 * Since JWT is stateless, logout is handled client-side
 * @param {number} user_id - User ID
 * @returns {Object} Success message
 */
const logout = async (user_id) => {
  // Verify user exists
  const result = await query(
    'SELECT user_id FROM users WHERE user_id = $1',
    [user_id]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  // In a stateless JWT system, logout is primarily handled client-side
  // Here we just confirm the user exists
  return { message: 'Logged out successfully' };
};

/**
 * Create guest user and return guest JWT
 * @param {Object} guestData - Guest data (optional phone_number and name)
 * @returns {Object} Guest data with JWT token
 */
const createGuest = async (guestData = {}) => {
  const { phone_number, name } = guestData;

  // Insert new guest
  const result = await query(
    `INSERT INTO guests (phone_number, name)
     VALUES ($1, $2)
     RETURNING guest_id, phone_number, name, created_at`,
    [phone_number || null, name || null]
  );

  const guest = result.rows[0];

  // Generate guest JWT token
  const token = generateGuestToken(guest.guest_id);

  return {
    guest: {
      guest_id: guest.guest_id,
      phone_number: guest.phone_number,
      name: guest.name
    },
    token
  };
};

/**
 * Generate JWT token for registered users
 * @param {number} user_id - User ID
 * @param {string} role - User role
 * @returns {string} JWT token
 */
const generateToken = (user_id, role) => {
  const payload = { user_id, role };
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

/**
 * Generate JWT token for guest users
 * @param {number} guest_id - Guest ID
 * @returns {string} JWT token
 */
const generateGuestToken = (guest_id) => {
  const payload = { guest_id, role: 'Guest' };
  const expiresIn = process.env.JWT_GUEST_EXPIRES_IN || '1d';
  
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

/**
 * Verify user exists and is active
 * @param {number} user_id - User ID
 * @returns {Object} User data
 */
const verifyUser = async (user_id) => {
  const result = await query(
    'SELECT user_id, phone_number, name, role, is_active FROM users WHERE user_id = $1',
    [user_id]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  return result.rows[0];
};

module.exports = {
  register,
  login,
  logout,
  createGuest,
  generateToken,
  generateGuestToken,
  verifyUser
};
