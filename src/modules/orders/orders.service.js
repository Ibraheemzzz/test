const { query, transaction } = require('../../config/db');
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
  return await transaction(async (client) => {
    // 1. Validate stock for every item
    const validatedItems = [];
    let total_products_price = 0;

    for (const item of items) {
      const productResult = await client.query(
        'SELECT product_id, name, price, cost_price, sale_type, stock_quantity FROM products WHERE product_id = $1 AND is_active = true',
        [item.product_id]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Product ${item.product_id} not found or unavailable`);
      }

      const product = productResult.rows[0];

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
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, guest_id, status, total_products_price, shipping_fees, discount_amount, final_total, 
                          shipping_city, shipping_street, shipping_building, shipping_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING order_id, status, total_products_price, shipping_fees, discount_amount, final_total, created_at`,
      [user_id || null, guest_id || null, 'Created', total_products_price, shipping_fees, discount_amount, final_total,
       shipping_city, shipping_street, shipping_building, shipping_phone]
    );

    const order = orderResult.rows[0];

    // 3. Insert order_items with current price and cost_price
    // 4. Decrease stock_quantity for each product
    // 5. Insert stock_transactions with reason = "purchase"
    for (const item of validatedItems) {
      // Insert order item
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase, cost_price_at_purchase)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.order_id, item.product_id, item.quantity, item.price, item.cost_price]
      );

      // Decrease stock
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2',
        [item.quantity, item.product_id]
      );

      // Log stock transaction
      await client.query(
        `INSERT INTO stock_transactions (product_id, quantity_change, reason, related_order_id)
         VALUES ($1, $2, $3, $4)`,
        [item.product_id, -item.quantity, 'purchase', order.order_id]
      );
    }

    // 6. Create payment record (cash_on_delivery, status = Pending)
    await client.query(
      `INSERT INTO payments (order_id, payment_method, amount, status)
       VALUES ($1, $2, $3, $4)`,
      [order.order_id, 'cash_on_delivery', final_total, 'Pending']
    );

    // 7. Log first status history entry (Created)
    await client.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status)
       VALUES ($1, $2, $3)`,
      [order.order_id, null, 'Created']
    );

    // 8. Clear user cart if user order
    if (user_id) {
      const cartResult = await client.query(
        'SELECT cart_id FROM carts WHERE user_id = $1',
        [user_id]
      );

      if (cartResult.rows.length > 0) {
        await client.query(
          'DELETE FROM cart_items WHERE cart_id = $1',
          [cartResult.rows[0].cart_id]
        );
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
  const { offset } = getPaginationParams({ page, limit });

  // Get total count
  const countResult = await query(
    'SELECT COUNT(*) as total FROM orders WHERE user_id = $1',
    [user_id]
  );
  const totalItems = parseInt(countResult.rows[0].total);

  // Get paginated orders
  const result = await query(
    `SELECT order_id, status, total_products_price, shipping_fees, discount_amount, final_total, 
            created_at, delivered_at
     FROM orders 
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [user_id, limit, offset]
  );

  return buildPaginatedResponse(result.rows, totalItems, parseInt(page) || 1, parseInt(limit) || 20);
};

/**
 * Get guest's orders (paginated)
 * @param {number} guest_id - Guest ID
 * @param {Object} options - Pagination options
 * @returns {Object} Paginated orders
 */
const getGuestOrders = async (guest_id, options) => {
  const { page, limit } = options;
  const { offset } = getPaginationParams({ page, limit });

  // Get total count
  const countResult = await query(
    'SELECT COUNT(*) as total FROM orders WHERE guest_id = $1',
    [guest_id]
  );
  const totalItems = parseInt(countResult.rows[0].total);

  // Get paginated orders
  const result = await query(
    `SELECT order_id, status, total_products_price, shipping_fees, discount_amount, final_total, 
            created_at, delivered_at
     FROM orders 
     WHERE guest_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [guest_id, limit, offset]
  );

  return buildPaginatedResponse(result.rows, totalItems, parseInt(page) || 1, parseInt(limit) || 20);
};

/**
 * Get order by ID with items
 * @param {number} order_id - Order ID
 * @param {number} user_id - User ID (optional, for authorization)
 * @param {number} guest_id - Guest ID (optional, for authorization)
 * @returns {Object} Order with items
 */
const getOrderById = async (order_id, user_id = null, guest_id = null) => {
  // Get order
  let orderQuery = 'SELECT * FROM orders WHERE order_id = $1';
  const orderParams = [order_id];

  // Add user/guest filter if provided
  if (user_id) {
    orderQuery += ' AND user_id = $2';
    orderParams.push(user_id);
  } else if (guest_id) {
    orderQuery += ' AND guest_id = $2';
    orderParams.push(guest_id);
  }

  const orderResult = await query(orderQuery, orderParams);

  if (orderResult.rows.length === 0) {
    throw new Error('Order not found');
  }

  const order = orderResult.rows[0];

  // Get order items
  const itemsResult = await query(
    `SELECT oi.product_id, oi.quantity, oi.price_at_purchase, oi.cost_price_at_purchase,
            p.name, p.image_url, p.sale_type
     FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.product_id
     WHERE oi.order_id = $1`,
    [order_id]
  );

  // Get payment info
  const paymentResult = await query(
    'SELECT payment_id, payment_method, amount, status FROM payments WHERE order_id = $1',
    [order_id]
  );

  return {
    ...order,
    items: itemsResult.rows,
    payment: paymentResult.rows[0] || null
  };
};

/**
 * Cancel order (customer only, Created status only)
 * @param {number} order_id - Order ID
 * @param {number} user_id - User ID
 * @returns {Object} Cancelled order
 */
const cancelOrder = async (order_id, user_id) => {
  return await transaction(async (client) => {
    // Get order
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE order_id = $1 AND user_id = $2',
      [order_id, user_id]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }

    const order = orderResult.rows[0];

    // Check status
    if (order.status !== 'Created') {
      throw new Error('Only orders with "Created" status can be cancelled');
    }

    // Get order items
    const itemsResult = await client.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
      [order_id]
    );

    // Restore stock and log transactions
    for (const item of itemsResult.rows) {
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2',
        [item.quantity, item.product_id]
      );

      await client.query(
        `INSERT INTO stock_transactions (product_id, quantity_change, reason, related_order_id)
         VALUES ($1, $2, $3, $4)`,
        [item.product_id, item.quantity, 'cancellation', order_id]
      );
    }

    // Update order status
    await client.query(
      'UPDATE orders SET status = $1 WHERE order_id = $2',
      ['Cancelled', order_id]
    );

    // Log status change
    await client.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status)
       VALUES ($1, $2, $3)`,
      [order_id, order.status, 'Cancelled']
    );

    // Update payment status
    await client.query(
      'UPDATE payments SET status = $1 WHERE order_id = $2',
      ['Cancelled', order_id]
    );

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
  const { offset } = getPaginationParams({ page, limit });

  let whereClause = 'WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  // Status filter
  if (status) {
    whereClause += ` AND o.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
    params
  );
  const totalItems = parseInt(countResult.rows[0].total);

  // Get paginated orders with user info
  params.push(limit, offset);
  const result = await query(
    `SELECT o.order_id, o.status, o.total_products_price, o.final_total, o.created_at, o.delivered_at,
            u.name as user_name, u.phone_number as user_phone,
            g.name as guest_name, g.phone_number as guest_phone,
            o.shipping_city, o.shipping_street, o.shipping_phone
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.user_id
     LEFT JOIN guests g ON o.guest_id = g.guest_id
     ${whereClause}
     ORDER BY o.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return buildPaginatedResponse(result.rows, totalItems, parseInt(page) || 1, parseInt(limit) || 20);
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

  return await transaction(async (client) => {
    // Get current order
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE order_id = $1',
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }

    const order = orderResult.rows[0];

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
    let updateQuery = 'UPDATE orders SET status = $1';
    const updateParams = [new_status];

    if (new_status === 'Delivered') {
      updateQuery += ', delivered_at = CURRENT_TIMESTAMP';
    }

    updateQuery += ' WHERE order_id = $2 RETURNING order_id, status';
    updateParams.push(order_id);

    await client.query(updateQuery, updateParams);

    // Log status change
    await client.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status)
       VALUES ($1, $2, $3)`,
      [order_id, order.status, new_status]
    );

    // Update payment status if delivered
    if (new_status === 'Delivered') {
      await client.query(
        'UPDATE payments SET status = $1 WHERE order_id = $2',
        ['Completed', order_id]
      );
    }

    // Handle cancellation - restore stock
    if (new_status === 'Cancelled') {
      const itemsResult = await client.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
        [order_id]
      );

      for (const item of itemsResult.rows) {
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2',
          [item.quantity, item.product_id]
        );

        await client.query(
          `INSERT INTO stock_transactions (product_id, quantity_change, reason, related_order_id)
           VALUES ($1, $2, $3, $4)`,
          [item.product_id, item.quantity, 'cancellation', order_id]
        );
      }

      await client.query(
        'UPDATE payments SET status = $1 WHERE order_id = $2',
        ['Cancelled', order_id]
      );
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
  const orderResult = await query(
    'SELECT order_id FROM orders WHERE order_id = $1',
    [order_id]
  );

  if (orderResult.rows.length === 0) {
    throw new Error('Order not found');
  }

  const result = await query(
    `SELECT history_id, old_status, new_status, changed_at
     FROM order_status_history
     WHERE order_id = $1
     ORDER BY changed_at ASC`,
    [order_id]
  );

  return result.rows;
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
