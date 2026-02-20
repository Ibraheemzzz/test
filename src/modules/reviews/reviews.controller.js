const reviewsService = require('./reviews.service');
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  createdResponse,
  serverErrorResponse
} = require('../../utils/response');

/**
 * Reviews Controller
 * Handles HTTP request and response for review endpoints
 */

/**
 * Create review
 * POST /api/products/:productId/reviews
 * Protected route (registered users only)
 */
const createReview = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { productId } = req.params;
    const { rating, comment } = req.body;

    // Validate product ID
    if (!productId || isNaN(parseInt(productId))) {
      return errorResponse(res, 'Invalid product ID', 400);
    }

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return errorResponse(res, 'Rating must be between 1 and 5', 400);
    }

    // Validate rating precision (0.5 increments)
    if (rating * 2 !== Math.floor(rating * 2)) {
      return errorResponse(res, 'Rating must be in 0.5 increments (e.g., 1, 1.5, 2, 2.5, ...)', 400);
    }

    const review = await reviewsService.createReview(user_id, parseInt(productId), {
      rating: parseFloat(rating),
      comment
    });

    return createdResponse(res, review, 'Review created successfully');
  } catch (error) {
    if (error.message === 'Product not found') {
      return notFoundResponse(res, 'Product');
    }
    if (error.message === 'You have already reviewed this product') {
      return errorResponse(res, error.message, 409);
    }
    console.error('Create review error:', error);
    return serverErrorResponse(res, 'Failed to create review');
  }
};

/**
 * Get product reviews
 * GET /api/products/:productId/reviews
 * Public route
 */
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page, limit } = req.query;

    // Validate product ID
    if (!productId || isNaN(parseInt(productId))) {
      return errorResponse(res, 'Invalid product ID', 400);
    }

    const result = await reviewsService.getProductReviews(parseInt(productId), {
      page: page || 1,
      limit: limit || 20
    });

    return successResponse(res, result, 'Reviews retrieved successfully');
  } catch (error) {
    if (error.message === 'Product not found') {
      return notFoundResponse(res, 'Product');
    }
    console.error('Get reviews error:', error);
    return serverErrorResponse(res, 'Failed to get reviews');
  }
};

/**
 * Update review
 * PUT /api/reviews/:id
 * Protected route (owner only)
 */
const updateReview = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { id } = req.params;
    const { rating, comment } = req.body;

    // Validate review ID
    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid review ID', 400);
    }

    // Validate rating if provided
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return errorResponse(res, 'Rating must be between 1 and 5', 400);
      }
      if (rating * 2 !== Math.floor(rating * 2)) {
        return errorResponse(res, 'Rating must be in 0.5 increments', 400);
      }
    }

    // At least one field must be provided
    if (!rating && !comment) {
      return errorResponse(res, 'At least one field (rating or comment) must be provided', 400);
    }

    const review = await reviewsService.updateReview(parseInt(id), user_id, {
      rating: rating ? parseFloat(rating) : undefined,
      comment
    });

    return successResponse(res, review, 'Review updated successfully');
  } catch (error) {
    if (error.message === 'Review not found') {
      return notFoundResponse(res, 'Review');
    }
    if (error.message === 'You can only edit your own reviews') {
      return errorResponse(res, error.message, 403);
    }
    console.error('Update review error:', error);
    return serverErrorResponse(res, 'Failed to update review');
  }
};

/**
 * Delete review
 * DELETE /api/reviews/:id
 * Protected route (owner only)
 */
const deleteReview = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { id } = req.params;

    // Validate review ID
    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid review ID', 400);
    }

    const result = await reviewsService.deleteReview(parseInt(id), user_id);

    return successResponse(res, result, 'Review deleted successfully');
  } catch (error) {
    if (error.message === 'Review not found') {
      return notFoundResponse(res, 'Review');
    }
    if (error.message === 'You can only delete your own reviews') {
      return errorResponse(res, error.message, 403);
    }
    console.error('Delete review error:', error);
    return serverErrorResponse(res, 'Failed to delete review');
  }
};

/**
 * Get all reviews (admin only)
 * GET /api/admin/reviews
 */
const getAllReviews = async (req, res) => {
  try {
    const { page, limit } = req.query;

    const result = await reviewsService.getAllReviews({
      page: page || 1,
      limit: limit || 20
    });

    return successResponse(res, result, 'Reviews retrieved successfully');
  } catch (error) {
    console.error('Get all reviews error:', error);
    return serverErrorResponse(res, 'Failed to get reviews');
  }
};

/**
 * Toggle review visibility (admin only)
 * PUT /api/admin/reviews/:id/hide
 */
const toggleReviewVisibility = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid review ID', 400);
    }

    const result = await reviewsService.toggleReviewVisibility(parseInt(id));

    return successResponse(res, result, `Review ${result.is_hidden ? 'hidden' : 'unhidden'} successfully`);
  } catch (error) {
    if (error.message === 'Review not found') {
      return notFoundResponse(res, 'Review');
    }
    console.error('Toggle review visibility error:', error);
    return serverErrorResponse(res, 'Failed to toggle review visibility');
  }
};

module.exports = {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  getAllReviews,
  toggleReviewVisibility
};
