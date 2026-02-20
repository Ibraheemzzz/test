const prisma = require('../../config/prisma');
const { getPaginationParams, buildPaginatedResponse } = require('../../utils/pagination');

/**
 * Orders Service
 * Handles all order-related database operations
 * 
 * CRITICAL: Order placement runs inside a single DB transaction
 */

/**
 * Place order (user or guest)
 * @param {Object} orderData - Order data
 * @returns {Object} Created order
 */
const placeOrder = async (orderData) => {
  const { user_id, guest_id, items, shipping_city, shipping_street, shipping_building, shipping_phone } = orderData;

  // Validate that either user_id or guest_id is provided, not both
  if ((user_id && guest_id) || (!user_id && !guest_id)) {
    throw new Error('Either user_id or guest_id must be provided, but not both');
  }

  // Validate items
  if (!items || items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  // Run order placement in a transaction
  return await prisma.$transaction(async (tx) => {
    // 1. Validate stock for every item and prepare data
    const validatedItems = [];
    let total_products_price = 0;

    for (const item of items) {
      const product = await tx.product.findFirst({
        where: { product_id: item.product_id, is_active: true },
        select: {
          product_id: true,
          name: true,
          price: true,
          cost_price: true,
          sale_type: true,
          stock_quantity: true
        }
      });

      if (!product) {
        throw new Error(`Product ${item.product_id} not found or unavailable`);
      }

      if (item.quantity > parseFloat(product.stock_quantity)) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock_quantity} ${product.sale_type}`);
      }

      const subtotal = item.quantity * parseFloat(product.price);
      total_products_price += subtotal;

      validatedItems.push({
        product_id: product.product_id,
        name: product.name,
        price: parseFloat(product.price),
        cost_price: parseFloat(product.cost_price),
        quantity: item.quantity,
        subtotal
      });
    }

    // Calculate final total (no discount for now, no coupon support in Phase 1)
    const shipping_fees = 0;
    const discount_amount = 0;
    const final_total = total_products_price + shipping_fees - discount_amount;

    // 2. Create order record
    const order = await tx.order.create({
      data: {
        user_id: user_id || null,
        guest_id: guest_id || null,
        status: 'Created',
        total_products_price,
        shipping_fees,
        discount_amount,
        final_total,
        shipping_city,
        shipping_street,
        shipping_building,
        shipping_phone
      },
      select: {
        order_id: true,
        status: true,
        total_products_price: true,
        shipping_fees: true,
        discount_amount: true,
        final_total: true,
        created_at: true
      }
    });

    // 3. Insert order_items with current price and cost_price
    // 4. Decrease stock_quantity for each product
    // 5. Insert stock_transactions with reason = "purchase"
    for (const item of validatedItems) {
      // Insert order item
      await tx.orderItem.create({
        data: {
          order_id: order.order_id,
          product_id: item.product_id,
          quantity: item.quantity,
          price_at_purchase: item.price,
          cost_price_at_purchase: item.cost_price
        }
      });

      // Decrease stock using atomic decrement
      await tx.product.update({
        where: { product_id: item.product_id },
        data: { stock_quantity: { decrement: item.quantity } }
      });

      // Log stock transaction
      await tx.stockTransaction.create({
        data: {
          product_id: item.product_id,
          quantity_change: -item.quantity,
          reason: 'purchase',
          related_order_id: order.order_id
        }
      });
    }

    // 6. Create payment record (cash_on_delivery, status = Pending)
    await tx.payment.create({
      data: {
        order_id: order.order_id,
        payment_method: 'cash_on_delivery',
        amount: final_total,
        status: 'Pending'
      }
    });

    // 7. Log first status history entry (Created)
    await tx.orderStatusHistory.create({
      data: {
        order_id: order.order_id,
        old_status: null,
        new_status: 'Created'
      }
    });

    // 8. Clear user cart if user order
    if (user_id) {
      const cart = await tx.cart.findUnique({
        where: { user_id },
        select: { cart_id: true }
      });

      if (cart) {
        await tx.cartItem.deleteMany({
          where: { cart_id: cart.cart_id }
        });
      }
    }

    return {
      order_id: order.order_id,
      status: order.status,
      total_products_price: parseFloat(order.total_products_price),
      shipping_fees: parseFloat(order.shipping_fees),
      discount_amount: parseFloat(order.discount_amount),
      final_total: parseFloat(order.final_total),
      items_count: validatedItems.length,
      created_at: order.created_at
    };
  });
};

/**
 * Get user's orders (paginated)
 * @param {number} user_id - User ID
 * @param {Object} options - Pagination options
 * @returns {Object} Paginated orders
 */
const getUserOrders = async (user_id, options) => {
  const { page, limit } = options;
  const { skip, take } = { 
    skip: (parseInt(page) - 1) * parseInt(limit), 
    take: parseInt(limit) 
  };

  // Get total count
  const totalItems = await prisma.order.count({ where: { user_id } });

  // Get paginated orders
  const orders = await prisma.order.findMany({
    where: { user_id },
    select: {
      order_id: true,
      status: true,
      total_products_price: true,
      shipping_fees: true,
      discount_amount: true,
      final_total: true,
      created_at: true,
      delivered_at: true
    },
    orderBy: { created_at: 'desc' },
    skip,
    take
  });

  return buildPaginatedResponse(
    orders.map(o => ({
      ...o,
      total_products_price: parseFloat(o.total_products_price),
      shipping_fees: parseFloat(o.shipping_fees),
      discount_amount: parseFloat(o.discount_amount),
      final_total: parseFloat(o.final_total)
    })),
    totalItems,
    parseInt(page) || 1,
    parseInt(limit) || 20
  );
};

/**
 * Get guest's orders (paginated)
 * @param {number} guest_id - Guest ID
 * @param {Object} options - Pagination options
 * @returns {Object} Paginated orders
 */
const getGuestOrders = async (guest_id, options) => {
  const { page, limit } = options;
  const { skip, take } = { 
    skip: (parseInt(page) - 1) * parseInt(limit), 
    take: parseInt(limit) 
  };

  // Get total count
  const totalItems = await prisma.order.count({ where: { guest_id } });

  // Get paginated orders
  const orders = await prisma.order.findMany({
    where: { guest_id },
    select: {
      order_id: true,
      status: true,
      total_products_price: true,
      shipping_fees: true,
      discount_amount: true,
      final_total: true,
      created_at: true,
      delivered_at: true
    },
    orderBy: { created_at: 'desc' },
    skip,
    take
  });

  return buildPaginatedResponse(
    orders.map(o => ({
      ...o,
      total_products_price: parseFloat(o.total_products_price),
      shipping_fees: parseFloat(o.shipping_fees),
      discount_amount: parseFloat(o.discount_amount),
      final_total: parseFloat(o.final_total)
    })),
    totalItems,
    parseInt(page) || 1,
    parseInt(limit) || 20
  );
};

/**
 * Get order by ID with items
 * @param {number} order_id - Order ID
 * @param {number} user_id - User ID (optional, for authorization)
 * @param {number} guest_id - Guest ID (optional, for authorization)
 * @returns {Object} Order with items
 */
const getOrderById = async (order_id, user_id = null, guest_id = null) => {
  // Build where clause
  const where = { order_id };
  if (user_id) {
    where.user_id = user_id;
  } else if (guest_id) {
    where.guest_id = guest_id;
  }

  // Get order
  const order = await prisma.order.findFirst({
    where,
    select: {
      order_id: true,
      user_id: true,
      guest_id: true,
      status: true,
      total_products_price: true,
      shipping_fees: true,
      discount_amount: true,
      final_total: true,
      shipping_city: true,
      shipping_street: true,
      shipping_building: true,
      shipping_phone: true,
      created_at: true,
      delivered_at: true
    }
  });

  if (!order) {
    throw new Error('Order not found');
  }

  // Get order items
  const items = await prisma.orderItem.findMany({
    where: { order_id },
    select: {
      product_id: true,
      quantity: true,
      price_at_purchase: true,
      cost_price_at_purchase: true,
      product: {
        select: {
          name: true,
          image_url: true,
          sale_type: true
        }
      }
    }
  });

  // Get payment info
  const payment = await prisma.payment.findFirst({
    where: { order_id },
    select: {
      payment_id: true,
      payment_method: true,
      amount: true,
      status: true
    }
  });

  return {
    ...order,
    total_products_price: parseFloat(order.total_products_price),
    shipping_fees: parseFloat(order.shipping_fees),
    discount_amount: parseFloat(order.discount_amount),
    final_total: parseFloat(order.final_total),
    items: items.map(item => ({
      ...item,
      quantity: parseFloat(item.quantity),
      price_at_purchase: parseFloat(item.price_at_purchase),
      cost_price_at_purchase: parseFloat(item.cost_price_at_purchase),
      name: item.product?.name,
      image_url: item.product?.image_url,
      sale_type: item.product?.sale_type
    })),
    payment: payment ? {
      ...payment,
      amount: parseFloat(payment.amount)
    } : null
  };
};

/**
 * Cancel order (customer only, Created status only)
 * @param {number} order_id - Order ID
 * @param {number} user_id - User ID
 * @returns {Object} Cancelled order
 */
const cancelOrder = async (order_id, user_id) => {
  return await prisma.$transaction(async (tx) => {
    // Get order
    const order = await tx.order.findFirst({
      where: { order_id, user_id },
      select: { order_id: true, status: true }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Check status
    if (order.status !== 'Created') {
      throw new Error('Only orders with "Created" status can be cancelled');
    }

    // Get order items
    const items = await tx.orderItem.findMany({
      where: { order_id },
      select: { product_id: true, quantity: true }
    });

    // Restore stock and log transactions
    for (const item of items) {
      // Restore stock using atomic increment
      await tx.product.update({
        where: { product_id: item.product_id },
        data: { stock_quantity: { increment: parseFloat(item.quantity) } }
      });

      await tx.stockTransaction.create({
        data: {
          product_id: item.product_id,
          quantity_change: parseFloat(item.quantity),
          reason: 'cancellation',
          related_order_id: order_id
        }
      });
    }

    // Update order status
    await tx.order.update({
      where: { order_id },
      data: { status: 'Cancelled' }
    });

    // Log status change
    await tx.orderStatusHistory.create({
      data: {
        order_id,
        old_status: order.status,
        new_status: 'Cancelled'
      }
    });

    // Update payment status
    await tx.payment.updateMany({
      where: { order_id },
      data: { status: 'Cancelled' }
    });

    return {
      order_id,
      status: 'Cancelled',
      message: 'Order cancelled successfully'
    };
  });
};

/**
 * Get all orders (admin only)
 * @param {Object} options - Query options
 * @returns {Object} Paginated orders
 */
const getAllOrders = async (options) => {
  const { status, page, limit } = options;
  const { skip, take } = { 
    skip: (parseInt(page) - 1) * parseInt(limit), 
    take: parseInt(limit) 
  };

  // Build where clause
  const where = {};
  if (status) {
    where.status = status;
  }

  // Get total count
  const totalItems = await prisma.order.count({ where });

  // Get paginated orders with user info
  const orders = await prisma.order.findMany({
    where,
    select: {
      order_id: true,
      status: true,
      total_products_price: true,
      final_total: true,
      created_at: true,
      delivered_at: true,
      shipping_city: true,
      shipping_street: true,
      shipping_phone: true,
      user: {
        select: { name: true, phone_number: true }
      },
      guest: {
        select: { name: true, phone_number: true }
      }
    },
    orderBy: { created_at: 'desc' },
    skip,
    take
  });

  return buildPaginatedResponse(
    orders.map(o => ({
      order_id: o.order_id,
      status: o.status,
      total_products_price: parseFloat(o.total_products_price),
      final_total: parseFloat(o.final_total),
      created_at: o.created_at,
      delivered_at: o.delivered_at,
      user_name: o.user?.name || null,
      user_phone: o.user?.phone_number || null,
      guest_name: o.guest?.name || null,
      guest_phone: o.guest?.phone_number || null,
      shipping_city: o.shipping_city,
      shipping_street: o.shipping_street,
      shipping_phone: o.shipping_phone
    })),
    totalItems,
    parseInt(page) || 1,
    parseInt(limit) || 20
  );
};

/**
 * Change order status (admin only)
 * @param {number} order_id - Order ID
 * @param {string} new_status - New status
 * @returns {Object} Updated order
 */
const changeOrderStatus = async (order_id, new_status) => {
  // Validate status (admin cannot set status back to 'Created')
  const validStatuses = ['Shipped', 'Delivered', 'Cancelled'];
  if (!validStatuses.includes(new_status)) {
    throw new Error('Invalid status. Admin can only set: Shipped, Delivered, or Cancelled');
  }

  return await prisma.$transaction(async (tx) => {
    // Get current order
    const order = await tx.order.findUnique({
      where: { order_id },
      select: { order_id: true, status: true }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Validate status transition
    const transitions = {
      'Created': ['Shipped', 'Cancelled'],
      'Shipped': ['Delivered', 'Cancelled'],
      'Delivered': [],
      'Cancelled': []
    };

    if (!transitions[order.status].includes(new_status)) {
      throw new Error(`Cannot change status from ${order.status} to ${new_status}`);
    }

    // Update status
    const updateData = { status: new_status };
    if (new_status === 'Delivered') {
      updateData.delivered_at = new Date();
    }

    await tx.order.update({
      where: { order_id },
      data: updateData
    });

    // Log status change
    await tx.orderStatusHistory.create({
      data: {
        order_id,
        old_status: order.status,
        new_status
      }
    });

    // Update payment status if delivered
    if (new_status === 'Delivered') {
      await tx.payment.updateMany({
        where: { order_id },
        data: { status: 'Completed' }
      });
    }

    // Handle cancellation - restore stock
    if (new_status === 'Cancelled') {
      const items = await tx.orderItem.findMany({
        where: { order_id },
        select: { product_id: true, quantity: true }
      });

      for (const item of items) {
        // Restore stock using atomic increment
        await tx.product.update({
          where: { product_id: item.product_id },
          data: { stock_quantity: { increment: parseFloat(item.quantity) } }
        });

        await tx.stockTransaction.create({
          data: {
            product_id: item.product_id,
            quantity_change: parseFloat(item.quantity),
            reason: 'cancellation',
            related_order_id: order_id
          }
        });
      }

      await tx.payment.updateMany({
        where: { order_id },
        data: { status: 'Cancelled' }
      });
    }

    return {
      order_id,
      old_status: order.status,
      new_status
    };
  });
};

/**
 * Get order status history
 * @param {number} order_id - Order ID
 * @returns {Array} Status history
 */
const getOrderStatusHistory = async (order_id) => {
  // Verify order exists
  const order = await prisma.order.findUnique({
    where: { order_id },
    select: { order_id: true }
  });

  if (!order) {
    throw new Error('Order not found');
  }

  const history = await prisma.orderStatusHistory.findMany({
    where: { order_id },
    select: {
      history_id: true,
      old_status: true,
      new_status: true,
      changed_at: true
    },
    orderBy: { changed_at: 'asc' }
  });

  return history;
};

module.exports = {
  placeOrder,
  getUserOrders,
  getGuestOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  changeOrderStatus,
  getOrderStatusHistory
};
