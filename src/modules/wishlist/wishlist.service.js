const { query } = require('../../config/db');

/**
 * Wishlist Service
 * Handles all wishlist-related database operations
 */

/**
 * Get user's wishlist
 * @param {number} user_id - User ID
 * @returns {Array} Wishlist items
 */
const getWishlist = async (user_id) => {
  const result = await query(
    `SELECT w.product_id, w.created_at,
            p.name, p.price, p.sale_type, p.stock_quantity, p.image_url, 
            p.average_rating, p.reviews_count,
            c.name as category_name
     FROM wishlist w
     INNER JOIN products p ON w.product_id = p.product_id
     LEFT JOIN categories c ON p.category_id = c.category_id
     WHERE w.user_id = $1 AND p.is_active = true
     ORDER BY w.created_at DESC`,
    [user_id]
  );

  return result.rows;
};

/**
 * Check if product is in wishlist
 * @param {number} user_id - User ID
 * @param {number} product_id - Product ID
 * @returns {Object} Wishlist status
 */
const checkWishlist = async (user_id, product_id) => {
  const result = await query(
    'SELECT product_id, created_at FROM wishlist WHERE user_id = $1 AND product_id = $2',
    [user_id, product_id]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Add product to wishlist
 * @param {number} user_id - User ID
 * @param {number} product_id - Product ID
 * @returns {Object} Added item
 */
const addToWishlist = async (user_id, product_id) => {
  // Verify product exists and is active
  const productResult = await query(
    'SELECT product_id, name FROM products WHERE product_id = $1 AND is_active = true',
    [product_id]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found');
  }

  // Check if already in wishlist
  const existingItem = await query(
    'SELECT product_id FROM wishlist WHERE user_id = $1 AND product_id = $2',
    [user_id, product_id]
  );

  if (existingItem.rows.length > 0) {
    throw new Error('Product already in wishlist');
  }

  // Add to wishlist
  await query(
    'INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2)',
    [user_id, product_id]
  );

  return {
    product_id,
    name: productResult.rows[0].name,
    added: true
  };
};

/**
 * Remove product from wishlist
 * @param {number} user_id - User ID
 * @param {number} product_id - Product ID
 * @returns {Object} Removed item info
 */
const removeFromWishlist = async (user_id, product_id) => {
  const result = await query(
    'DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2 RETURNING product_id',
    [user_id, product_id]
  );

  if (result.rows.length === 0) {
    throw new Error('Product not found in wishlist');
  }

  return {
    product_id,
    removed: true
  };
};

/**
 * Toggle product in wishlist
 * @param {number} user_id - User ID
 * @param {number} product_id - Product ID
 * @returns {Object} Toggle result
 */
const toggleWishlist = async (user_id, product_id) => {
  // Verify product exists
  const productResult = await query(
    'SELECT product_id FROM products WHERE product_id = $1 AND is_active = true',
    [product_id]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found');
  }

  // Check if in wishlist
  const existingItem = await query(
    'SELECT product_id FROM wishlist WHERE user_id = $1 AND product_id = $2',
    [user_id, product_id]
  );

  if (existingItem.rows.length > 0) {
    // Remove from wishlist
    await query(
      'DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2',
      [user_id, product_id]
    );

    return {
      product_id,
      in_wishlist: false,
      message: 'Removed from wishlist'
    };
  } else {
    // Add to wishlist
    await query(
      'INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2)',
      [user_id, product_id]
    );

    return {
      product_id,
      in_wishlist: true,
      message: 'Added to wishlist'
    };
  }
};

/**
 * Clear entire wishlist
 * @param {number} user_id - User ID
 * @returns {Object} Clear result
 */
const clearWishlist = async (user_id) => {
  const result = await query(
    'DELETE FROM wishlist WHERE user_id = $1',
    [user_id]
  );

  return {
    cleared: true,
    count: result.rowCount
  };
};

/**
 * Get wishlist count
 * @param {number} user_id - User ID
 * @returns {Object} Count
 */
const getWishlistCount = async (user_id) => {
  const result = await query(
    'SELECT COUNT(*) as count FROM wishlist WHERE user_id = $1',
    [user_id]
  );

  return {
    count: parseInt(result.rows[0].count)
  };
};

module.exports = {
  getWishlist,
  checkWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  clearWishlist,
  getWishlistCount
};
