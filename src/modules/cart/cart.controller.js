const cartService = require('./cart.service');
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse
} = require('../../utils/response');

/**
 * Cart Controller
 * Handles HTTP request and response for cart endpoints
 */

/**
 * Get cart
 * GET /api/cart
 * Protected route (registered users only)
 */
const getCart = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const cart = await cartService.getCart(user_id);

    return successResponse(res, cart, 'Cart retrieved successfully');
  } catch (error) {
    console.error('Get cart error:', error);
    return serverErrorResponse(res, 'Failed to get cart');
  }
};

/**
 * Add item to cart
 * POST /api/cart/items
 * Protected route (registered users only)
 */
const addToCart = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { product_id, quantity } = req.body;

    // Validate required fields
    if (!product_id || !quantity) {
      return errorResponse(res, 'product_id and quantity are required', 400);
    }

    // Validate product_id
    if (isNaN(parseInt(product_id))) {
      return errorResponse(res, 'Invalid product_id', 400);
    }

    // Validate quantity
    if (isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
      return errorResponse(res, 'Quantity must be a positive number', 400);
    }

    const item = await cartService.addToCart(user_id, {
      product_id: parseInt(product_id),
      quantity: parseFloat(quantity)
    });

    return successResponse(res, item, 'Item added to cart');
  } catch (error) {
    if (error.message === 'Product not found or unavailable') {
      return notFoundResponse(res, 'Product');
    }
    if (error.message.startsWith('Insufficient stock') || 
        error.message === 'Quantity must be greater than 0' ||
        error.message.startsWith('Maximum quantity')) {
      return errorResponse(res, error.message, 400);
    }
    console.error('Add to cart error:', error);
    return serverErrorResponse(res, 'Failed to add item to cart');
  }
};

/**
 * Update cart item quantity
 * PUT /api/cart/items/:productId
 * Protected route (registered users only)
 */
const updateCartItem = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { productId } = req.params;
    const { quantity } = req.body;

    // Validate product_id
    if (!productId || isNaN(parseInt(productId))) {
      return errorResponse(res, 'Invalid product_id', 400);
    }

    // Validate quantity
    if (quantity === undefined || isNaN(parseFloat(quantity))) {
      return errorResponse(res, 'Quantity is required and must be a number', 400);
    }

    const result = await cartService.updateCartItem(user_id, parseInt(productId), parseFloat(quantity));

    return successResponse(res, result, result.removed ? 'Item removed from cart' : 'Cart updated successfully');
  } catch (error) {
    if (error.message === 'Cart not found' || error.message === 'Item not found in cart') {
      return notFoundResponse(res, error.message === 'Cart not found' ? 'Cart' : 'Item');
    }
    if (error.message.startsWith('Insufficient stock')) {
      return errorResponse(res, error.message, 400);
    }
    console.error('Update cart error:', error);
    return serverErrorResponse(res, 'Failed to update cart');
  }
};

/**
 * Remove item from cart
 * DELETE /api/cart/items/:productId
 * Protected route (registered users only)
 */
const removeFromCart = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { productId } = req.params;

    // Validate product_id
    if (!productId || isNaN(parseInt(productId))) {
      return errorResponse(res, 'Invalid product_id', 400);
    }

    const result = await cartService.removeFromCart(user_id, parseInt(productId));

    return successResponse(res, result, 'Item removed from cart');
  } catch (error) {
    if (error.message === 'Cart not found' || error.message === 'Item not found in cart') {
      return notFoundResponse(res, error.message === 'Cart not found' ? 'Cart' : 'Item');
    }
    console.error('Remove from cart error:', error);
    return serverErrorResponse(res, 'Failed to remove item from cart');
  }
};

/**
 * Clear cart
 * DELETE /api/cart
 * Protected route (registered users only)
 */
const clearCart = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const result = await cartService.clearCart(user_id);

    return successResponse(res, result, 'Cart cleared successfully');
  } catch (error) {
    if (error.message === 'Cart not found') {
      return notFoundResponse(res, 'Cart');
    }
    console.error('Clear cart error:', error);
    return serverErrorResponse(res, 'Failed to clear cart');
  }
};

/**
 * Validate cart
 * GET /api/cart/validate
 * Protected route (registered users only)
 */
const validateCart = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const result = await cartService.validateCart(user_id);

    return successResponse(res, result, result.valid ? 'Cart is valid' : 'Cart has invalid items');
  } catch (error) {
    console.error('Validate cart error:', error);
    return serverErrorResponse(res, 'Failed to validate cart');
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  validateCart
};
