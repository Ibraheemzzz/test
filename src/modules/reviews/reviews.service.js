const { query } = require('../../config/db');
const { getPaginationParams, buildPaginatedResponse } = require('../../utils/pagination');

/**
 * Reviews Service
 * Handles all review-related database operations
 * 
 * IMPORTANT: average_rating and reviews_count in products table
 * must be recalculated after every review add, edit, or delete
 */

/**
 * Recalculate product rating stats
 * @param {number} product_id - Product ID
 */
const recalculateProductStats = async (product_id) => {
  const result = await query(
    `SELECT COALESCE(AVG(rating), 0) as average_rating, COUNT(*) as reviews_count
     FROM product_reviews
     WHERE product_id = $1 AND is_approved = true AND is_hidden = false`,
    [product_id]
  );

  const stats = result.rows[0];

  await query(
    `UPDATE products 
     SET average_rating = $1, reviews_count = $2
     WHERE product_id = $3`,
    [parseFloat(stats.average_rating).toFixed(2), parseInt(stats.reviews_count), product_id]
  );
};

/**
 * Create review
 * @param {number} user_id - User ID
 * @param {number} product_id - Product ID
 * @param {Object} reviewData - Review data
 * @returns {Object} Created review
 */
const createReview = async (user_id, product_id, reviewData) => {
  const { rating, comment } = reviewData;

  // Service-level validation for rating (critical for DB constraint)
  if (rating < 1 || rating > 5 || (rating * 2) % 1 !== 0) {
    throw new Error('Rating must be between 1 and 5 in steps of 0.5');
  }

  // Verify product exists and is active
  const productResult = await query(
    'SELECT product_id FROM products WHERE product_id = $1 AND is_active = true',
    [product_id]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found');
  }

  // Check if user already reviewed this product
  const existingReview = await query(
    'SELECT review_id FROM product_reviews WHERE user_id = $1 AND product_id = $2',
    [user_id, product_id]
  );

  if (existingReview.rows.length > 0) {
    throw new Error('You have already reviewed this product');
  }

  // Create review
  const result = await query(
    `INSERT INTO product_reviews (user_id, product_id, rating, comment)
     VALUES ($1, $2, $3, $4)
     RETURNING review_id, rating, comment, created_at`,
    [user_id, product_id, rating, comment || null]
  );

  // Recalculate product stats
  await recalculateProductStats(product_id);

  return result.rows[0];
};

/**
 * Get product reviews (paginated)
 * @param {number} product_id - Product ID
 * @param {Object} options - Pagination options
 * @returns {Object} Paginated reviews
 */
const getProductReviews = async (product_id, options) => {
  const { page, limit } = options;
  const { offset } = getPaginationParams({ page, limit });

  // Verify product exists
  const productResult = await query(
    'SELECT product_id FROM products WHERE product_id = $1',
    [product_id]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found');
  }

  // Get total count (only approved and visible reviews)
  const countResult = await query(
    `SELECT COUNT(*) as total 
     FROM product_reviews 
     WHERE product_id = $1 AND is_approved = true AND is_hidden = false`,
    [product_id]
  );
  const totalItems = parseInt(countResult.rows[0].total);

  // Get paginated reviews
  const result = await query(
    `SELECT pr.review_id, pr.rating, pr.comment, pr.created_at,
            u.name as user_name
     FROM product_reviews pr
     INNER JOIN users u ON pr.user_id = u.user_id
     WHERE pr.product_id = $1 AND pr.is_approved = true AND pr.is_hidden = false
     ORDER BY pr.created_at DESC
     LIMIT $2 OFFSET $3`,
    [product_id, limit, offset]
  );

  return buildPaginatedResponse(result.rows, totalItems, parseInt(page) || 1, parseInt(limit) || 20);
};

/**
 * Update review
 * @param {number} review_id - Review ID
 * @param {number} user_id - User ID
 * @param {Object} updateData - Data to update
 * @returns {Object} Updated review
 */
const updateReview = async (review_id, user_id, updateData) => {
  const { rating, comment } = updateData;

  // Service-level validation for rating if provided (critical for DB constraint)
  if (rating !== undefined && (rating < 1 || rating > 5 || (rating * 2) % 1 !== 0)) {
    throw new Error('Rating must be between 1 and 5 in steps of 0.5');
  }

  // Get review and verify ownership
  const reviewResult = await query(
    'SELECT review_id, product_id, user_id FROM product_reviews WHERE review_id = $1',
    [review_id]
  );

  if (reviewResult.rows.length === 0) {
    throw new Error('Review not found');
  }

  if (reviewResult.rows[0].user_id !== user_id) {
    throw new Error('You can only edit your own reviews');
  }

  const product_id = reviewResult.rows[0].product_id;

  // Update review
  const result = await query(
    `UPDATE product_reviews 
     SET rating = COALESCE($1, rating), comment = COALESCE($2, comment)
     WHERE review_id = $3
     RETURNING review_id, rating, comment, updated_at`,
    [rating, comment, review_id]
  );

  // Recalculate product stats
  await recalculateProductStats(product_id);

  return result.rows[0];
};

/**
 * Delete review
 * @param {number} review_id - Review ID
 * @param {number} user_id - User ID
 * @returns {Object} Deleted review info
 */
const deleteReview = async (review_id, user_id) => {
  // Get review and verify ownership
  const reviewResult = await query(
    'SELECT review_id, product_id, user_id FROM product_reviews WHERE review_id = $1',
    [review_id]
  );

  if (reviewResult.rows.length === 0) {
    throw new Error('Review not found');
  }

  if (reviewResult.rows[0].user_id !== user_id) {
    throw new Error('You can only delete your own reviews');
  }

  const product_id = reviewResult.rows[0].product_id;

  // Delete review
  await query(
    'DELETE FROM product_reviews WHERE review_id = $1',
    [review_id]
  );

  // Recalculate product stats
  await recalculateProductStats(product_id);

  return { review_id, deleted: true };
};

/**
 * Get all reviews (admin only)
 * @param {Object} options - Query options
 * @returns {Object} Paginated reviews
 */
const getAllReviews = async (options) => {
  const { page, limit } = options;
  const { offset } = getPaginationParams({ page, limit });

  // Get total count
  const countResult = await query('SELECT COUNT(*) as total FROM product_reviews');
  const totalItems = parseInt(countResult.rows[0].total);

  // Get paginated reviews
  const result = await query(
    `SELECT pr.review_id, pr.rating, pr.comment, pr.is_approved, pr.is_hidden, pr.created_at,
            u.name as user_name, u.phone_number as user_phone,
            p.name as product_name, p.product_id
     FROM product_reviews pr
     INNER JOIN users u ON pr.user_id = u.user_id
     INNER JOIN products p ON pr.product_id = p.product_id
     ORDER BY pr.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return buildPaginatedResponse(result.rows, totalItems, parseInt(page) || 1, parseInt(limit) || 20);
};

/**
 * Toggle review visibility (admin only)
 * @param {number} review_id - Review ID
 * @returns {Object} Updated review
 */
const toggleReviewVisibility = async (review_id) => {
  // Get review
  const reviewResult = await query(
    'SELECT review_id, product_id, is_hidden FROM product_reviews WHERE review_id = $1',
    [review_id]
  );

  if (reviewResult.rows.length === 0) {
    throw new Error('Review not found');
  }

  const newVisibility = !reviewResult.rows[0].is_hidden;
  const product_id = reviewResult.rows[0].product_id;

  // Update visibility
  const result = await query(
    `UPDATE product_reviews 
     SET is_hidden = $1
     WHERE review_id = $2
     RETURNING review_id, is_hidden`,
    [newVisibility, review_id]
  );

  // Recalculate product stats
  await recalculateProductStats(product_id);

  return result.rows[0];
};

/**
 * Get user's review for a product
 * @param {number} user_id - User ID
 * @param {number} product_id - Product ID
 * @returns {Object} User's review or null
 */
const getUserReviewForProduct = async (user_id, product_id) => {
  const result = await query(
    `SELECT review_id, rating, comment, created_at, updated_at
     FROM product_reviews
     WHERE user_id = $1 AND product_id = $2`,
    [user_id, product_id]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
};

module.exports = {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  getAllReviews,
  toggleReviewVisibility,
  getUserReviewForProduct,
  recalculateProductStats
};
