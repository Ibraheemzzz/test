const prisma = require('../../config/prisma');
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
  const stats = await prisma.productReview.aggregate({
    where: {
      product_id,
      is_hidden: false,
      is_approved: true
    },
    _avg: { rating: true },
    _count: { review_id: true }
  });

  await prisma.product.update({
    where: { product_id },
    data: {
      average_rating: stats._avg.rating || 0,
      reviews_count: stats._count.review_id
    }
  });
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
  const product = await prisma.product.findFirst({
    where: { product_id, is_active: true },
    select: { product_id: true }
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // Check if user already reviewed this product
  const existingReview = await prisma.productReview.findUnique({
    where: {
      user_id_product_id: {
        user_id,
        product_id
      }
    },
    select: { review_id: true }
  });

  if (existingReview) {
    throw new Error('You have already reviewed this product');
  }

  // Create review
  const review = await prisma.productReview.create({
    data: {
      user_id,
      product_id,
      rating,
      comment: comment || null
    },
    select: {
      review_id: true,
      rating: true,
      comment: true,
      created_at: true
    }
  });

  // Recalculate product stats
  await recalculateProductStats(product_id);

  return {
    ...review,
    rating: parseFloat(review.rating)
  };
};

/**
 * Get product reviews (paginated)
 * @param {number} product_id - Product ID
 * @param {Object} options - Pagination options
 * @returns {Object} Paginated reviews
 */
const getProductReviews = async (product_id, options) => {
  const { page, limit } = options;
  const { skip, take } = { 
    skip: (parseInt(page) - 1) * parseInt(limit), 
    take: parseInt(limit) 
  };

  // Verify product exists
  const product = await prisma.product.findUnique({
    where: { product_id },
    select: { product_id: true }
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // Get total count (only approved and visible reviews)
  const totalItems = await prisma.productReview.count({
    where: {
      product_id,
      is_approved: true,
      is_hidden: false
    }
  });

  // Get paginated reviews
  const reviews = await prisma.productReview.findMany({
    where: {
      product_id,
      is_approved: true,
      is_hidden: false
    },
    select: {
      review_id: true,
      rating: true,
      comment: true,
      created_at: true,
      user: {
        select: { name: true }
      }
    },
    orderBy: { created_at: 'desc' },
    skip,
    take
  });

  return buildPaginatedResponse(
    reviews.map(r => ({
      ...r,
      rating: parseFloat(r.rating),
      user_name: r.user?.name || 'Anonymous'
    })),
    totalItems,
    parseInt(page) || 1,
    parseInt(limit) || 20
  );
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
  const review = await prisma.productReview.findUnique({
    where: { review_id },
    select: { review_id: true, product_id: true, user_id: true }
  });

  if (!review) {
    throw new Error('Review not found');
  }

  if (review.user_id !== user_id) {
    throw new Error('You can only edit your own reviews');
  }

  // Build update data
  const updatePayload = {};
  if (rating !== undefined) updatePayload.rating = rating;
  if (comment !== undefined) updatePayload.comment = comment;

  // Update review
  const updatedReview = await prisma.productReview.update({
    where: { review_id },
    data: updatePayload,
    select: {
      review_id: true,
      rating: true,
      comment: true,
      updated_at: true
    }
  });

  // Recalculate product stats
  await recalculateProductStats(review.product_id);

  return {
    ...updatedReview,
    rating: parseFloat(updatedReview.rating)
  };
};

/**
 * Delete review
 * @param {number} review_id - Review ID
 * @param {number} user_id - User ID
 * @returns {Object} Deleted review info
 */
const deleteReview = async (review_id, user_id) => {
  // Get review and verify ownership
  const review = await prisma.productReview.findUnique({
    where: { review_id },
    select: { review_id: true, product_id: true, user_id: true }
  });

  if (!review) {
    throw new Error('Review not found');
  }

  if (review.user_id !== user_id) {
    throw new Error('You can only delete your own reviews');
  }

  // Delete review
  await prisma.productReview.delete({
    where: { review_id }
  });

  // Recalculate product stats
  await recalculateProductStats(review.product_id);

  return { review_id, deleted: true };
};

/**
 * Get all reviews (admin only)
 * @param {Object} options - Query options
 * @returns {Object} Paginated reviews
 */
const getAllReviews = async (options) => {
  const { page, limit } = options;
  const { skip, take } = { 
    skip: (parseInt(page) - 1) * parseInt(limit), 
    take: parseInt(limit) 
  };

  // Get total count
  const totalItems = await prisma.productReview.count();

  // Get paginated reviews
  const reviews = await prisma.productReview.findMany({
    select: {
      review_id: true,
      rating: true,
      comment: true,
      is_approved: true,
      is_hidden: true,
      created_at: true,
      user: {
        select: { name: true, phone_number: true }
      },
      product: {
        select: { name: true, product_id: true }
      }
    },
    orderBy: { created_at: 'desc' },
    skip,
    take
  });

  return buildPaginatedResponse(
    reviews.map(r => ({
      ...r,
      rating: parseFloat(r.rating),
      user_name: r.user?.name || null,
      user_phone: r.user?.phone_number || null,
      product_name: r.product?.name || null,
      product_id: r.product?.product_id || null
    })),
    totalItems,
    parseInt(page) || 1,
    parseInt(limit) || 20
  );
};

/**
 * Toggle review visibility (admin only)
 * @param {number} review_id - Review ID
 * @returns {Object} Updated review
 */
const toggleReviewVisibility = async (review_id) => {
  // Get review
  const review = await prisma.productReview.findUnique({
    where: { review_id },
    select: { review_id: true, product_id: true, is_hidden: true }
  });

  if (!review) {
    throw new Error('Review not found');
  }

  const newVisibility = !review.is_hidden;

  // Update visibility
  const updatedReview = await prisma.productReview.update({
    where: { review_id },
    data: { is_hidden: newVisibility },
    select: { review_id: true, is_hidden: true }
  });

  // Recalculate product stats
  await recalculateProductStats(review.product_id);

  return updatedReview;
};

/**
 * Get user's review for a product
 * @param {number} user_id - User ID
 * @param {number} product_id - Product ID
 * @returns {Object} User's review or null
 */
const getUserReviewForProduct = async (user_id, product_id) => {
  const review = await prisma.productReview.findUnique({
    where: {
      user_id_product_id: {
        user_id,
        product_id
      }
    },
    select: {
      review_id: true,
      rating: true,
      comment: true,
      created_at: true,
      updated_at: true
    }
  });

  return review ? {
    ...review,
    rating: parseFloat(review.rating)
  } : null;
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
