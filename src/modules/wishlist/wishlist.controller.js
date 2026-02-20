const wishlistService = require('./wishlist.service');
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  createdResponse,
  serverErrorResponse
} = require('../../utils/response');

/**
 * Wishlist Controller
 * Handles HTTP request and response for wishlist endpoints
 */

/**
 * Get user's wishlist
 * GET /api/wishlist
 * Protected route (registered users only)
 */
const getWishlist = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const wishlist = await wishlistService.getWishlist(user_id);

    return successResponse(res, {
      items: wishlist,
      count: wishlist.length
    }, 'Wishlist retrieved successfully');
  } catch (error) {
    console.error('Get wishlist error:', error);
    return serverErrorResponse(res, 'Failed to get wishlist');
  }
};

/**
 * Check if product is in wishlist
 * GET /api/wishlist/:productId
 * Protected route (registered users only)
 */
const checkWishlist = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { productId } = req.params;

    if (!productId || isNaN(parseInt(productId))) {
      return errorResponse(res, 'Invalid product ID', 400);
    }

    const item = await wishlistService.checkWishlist(user_id, parseInt(productId));

    return successResponse(res, {
      in_wishlist: item !== null,
      added_at: item?.created_at || null
    }, 'Wishlist status retrieved');
  } catch (error) {
    console.error('Check wishlist error:', error);
    return serverErrorResponse(res, 'Failed to check wishlist');
  }
};

/**
 * Add product to wishlist
 * POST /api/wishlist/:productId
 * Protected route (registered users only)
 */
const addToWishlist = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { productId } = req.params;

    if (!productId || isNaN(parseInt(productId))) {
      return errorResponse(res, 'Invalid product ID', 400);
    }

    const result = await wishlistService.addToWishlist(user_id, parseInt(productId));

    return createdResponse(res, result, 'Product added to wishlist');
  } catch (error) {
    if (error.message === 'Product not found') {
      return notFoundResponse(res, 'Product');
    }
    if (error.message === 'Product already in wishlist') {
      return errorResponse(res, error.message, 409);
    }
    console.error('Add to wishlist error:', error);
    return serverErrorResponse(res, 'Failed to add to wishlist');
  }
};

/**
 * Remove product from wishlist
 * DELETE /api/wishlist/:productId
 * Protected route (registered users only)
 */
const removeFromWishlist = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { productId } = req.params;

    if (!productId || isNaN(parseInt(productId))) {
      return errorResponse(res, 'Invalid product ID', 400);
    }

    const result = await wishlistService.removeFromWishlist(user_id, parseInt(productId));

    return successResponse(res, result, 'Product removed from wishlist');
  } catch (error) {
    if (error.message === 'Product not found in wishlist') {
      return notFoundResponse(res, 'Item in wishlist');
    }
    console.error('Remove from wishlist error:', error);
    return serverErrorResponse(res, 'Failed to remove from wishlist');
  }
};

/**
 * Toggle product in wishlist
 * This is a convenience endpoint that adds if not present, removes if present
 */
const toggleWishlist = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { productId } = req.params;

    if (!productId || isNaN(parseInt(productId))) {
      return errorResponse(res, 'Invalid product ID', 400);
    }

    const result = await wishlistService.toggleWishlist(user_id, parseInt(productId));

    return successResponse(res, result, result.message);
  } catch (error) {
    if (error.message === 'Product not found') {
      return notFoundResponse(res, 'Product');
    }
    console.error('Toggle wishlist error:', error);
    return serverErrorResponse(res, 'Failed to toggle wishlist');
  }
};

/**
 * Clear entire wishlist
 * DELETE /api/wishlist
 * Protected route (registered users only)
 */
const clearWishlist = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const result = await wishlistService.clearWishlist(user_id);

    return successResponse(res, result, 'Wishlist cleared successfully');
  } catch (error) {
    console.error('Clear wishlist error:', error);
    return serverErrorResponse(res, 'Failed to clear wishlist');
  }
};

module.exports = {
  getWishlist,
  checkWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  clearWishlist
};
