const ordersService = require('./orders.service');
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  createdResponse,
  serverErrorResponse
} = require('../../utils/response');

/**
 * Orders Controller
 * Handles HTTP request and response for order endpoints
 */

/**
 * Place order
 * POST /api/orders
 * Protected route (user or guest)
 */
const placeOrder = async (req, res) => {
  try {
    const user = req.user;
    const { items, shipping_city, shipping_street, shipping_building, shipping_phone } = req.body;

    // Validate required fields
    if (!shipping_city || !shipping_street || !shipping_building || !shipping_phone) {
      return errorResponse(res, 'Shipping address (city, street, building, phone) is required', 400);
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 'Order must contain at least one item', 400);
    }

    // Validate each item
    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        return errorResponse(res, 'Each item must have product_id and a positive quantity', 400);
      }
    }

    // Prepare order data
    const orderData = {
      items: items.map(item => ({
        product_id: parseInt(item.product_id),
        quantity: parseFloat(item.quantity)
      })),
      shipping_city,
      shipping_street,
      shipping_building,
      shipping_phone
    };

    // Set user_id or guest_id based on user type
    if (user.role === 'Guest') {
      orderData.guest_id = user.guest_id;
    } else {
      orderData.user_id = user.user_id;
    }

    const order = await ordersService.placeOrder(orderData);

    return createdResponse(res, order, 'Order placed successfully');
  } catch (error) {
    if (error.message.startsWith('Product') && error.message.includes('not found')) {
      return notFoundResponse(res, 'Product');
    }
    if (error.message.startsWith('Insufficient stock')) {
      return errorResponse(res, error.message, 400);
    }
    if (error.message === 'Order must contain at least one item' || 
        error.message === 'Either user_id or guest_id must be provided, but not both') {
      return errorResponse(res, error.message, 400);
    }
    console.error('Place order error:', error);
    return serverErrorResponse(res, 'Failed to place order');
  }
};

/**
 * Get user's orders
 * GET /api/orders
 * Protected route
 */
const getOrders = async (req, res) => {
  try {
    const user = req.user;
    const { page, limit } = req.query;

    let result;
    if (user.role === 'Guest') {
      result = await ordersService.getGuestOrders(user.guest_id, { page, limit });
    } else {
      result = await ordersService.getUserOrders(user.user_id, { page, limit });
    }

    return successResponse(res, result, 'Orders retrieved successfully');
  } catch (error) {
    console.error('Get orders error:', error);
    return serverErrorResponse(res, 'Failed to get orders');
  }
};

/**
 * Get order by ID
 * GET /api/orders/:id
 * Protected route
 */
const getOrderById = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid order ID', 400);
    }

    const order = await ordersService.getOrderById(
      parseInt(id),
      user.role !== 'Guest' ? user.user_id : null,
      user.role === 'Guest' ? user.guest_id : null
    );

    return successResponse(res, order, 'Order retrieved successfully');
  } catch (error) {
    if (error.message === 'Order not found') {
      return notFoundResponse(res, 'Order');
    }
    console.error('Get order error:', error);
    return serverErrorResponse(res, 'Failed to get order');
  }
};

/**
 * Cancel order
 * PUT /api/orders/:id/cancel
 * Protected route (registered users only)
 */
const cancelOrder = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid order ID', 400);
    }

    // Guests cannot cancel orders
    if (user.role === 'Guest') {
      return errorResponse(res, 'Guest users cannot cancel orders', 403);
    }

    const result = await ordersService.cancelOrder(parseInt(id), user.user_id);

    return successResponse(res, result, 'Order cancelled successfully');
  } catch (error) {
    if (error.message === 'Order not found') {
      return notFoundResponse(res, 'Order');
    }
    if (error.message === 'Only orders with "Created" status can be cancelled') {
      return errorResponse(res, error.message, 400);
    }
    console.error('Cancel order error:', error);
    return serverErrorResponse(res, 'Failed to cancel order');
  }
};

/**
 * Get all orders (admin only)
 * GET /api/admin/orders/all
 */
const getAllOrders = async (req, res) => {
  try {
    const { status, page, limit } = req.query;

    // Validate status if provided
    if (status && !['Created', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
      return errorResponse(res, 'Invalid status', 400);
    }

    const result = await ordersService.getAllOrders({
      status,
      page: page || 1,
      limit: limit || 20
    });

    return successResponse(res, result, 'Orders retrieved successfully');
  } catch (error) {
    console.error('Get all orders error:', error);
    return serverErrorResponse(res, 'Failed to get orders');
  }
};

/**
 * Change order status (admin only)
 * PUT /api/admin/orders/:id/status
 */
const changeOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid order ID', 400);
    }

    if (!status) {
      return errorResponse(res, 'Status is required', 400);
    }

    const result = await ordersService.changeOrderStatus(parseInt(id), status);

    return successResponse(res, result, 'Order status updated successfully');
  } catch (error) {
    if (error.message === 'Order not found') {
      return notFoundResponse(res, 'Order');
    }
    if (error.message.startsWith('Invalid status') || error.message.startsWith('Cannot change status')) {
      return errorResponse(res, error.message, 400);
    }
    console.error('Change order status error:', error);
    return serverErrorResponse(res, 'Failed to change order status');
  }
};

/**
 * Get order status history (admin only)
 * GET /api/admin/orders/:id/history
 */
const getOrderStatusHistory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid order ID', 400);
    }

    const history = await ordersService.getOrderStatusHistory(parseInt(id));

    return successResponse(res, history, 'Order status history retrieved successfully');
  } catch (error) {
    if (error.message === 'Order not found') {
      return notFoundResponse(res, 'Order');
    }
    console.error('Get order status history error:', error);
    return serverErrorResponse(res, 'Failed to get order status history');
  }
};

module.exports = {
  placeOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  changeOrderStatus,
  getOrderStatusHistory
};
