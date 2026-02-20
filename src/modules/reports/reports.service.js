const prisma = require('../../config/prisma');

/**
 * Reports Service
 * Handles all admin dashboard and reports operations
 * 
 * IMPORTANT: Profit calculation uses values stored in order_items
 * profit = (price_at_purchase - cost_price_at_purchase) × quantity
 * Never recalculate from current product prices
 */

/**
 * Get dashboard summary
 * @returns {Object} Dashboard data
 */
const getDashboardSummary = async () => {
  // Today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Today's orders and revenue
  const todayStats = await prisma.order.aggregate({
    where: {
      created_at: { gte: today },
      status: { not: 'Cancelled' }
    },
    _count: { order_id: true },
    _sum: { final_total: true }
  });

  // Low stock count (below threshold)
  const lowStockCount = await prisma.product.count({
    where: {
      is_active: true,
      stock_quantity: { lt: 10 }
    }
  });

  // New users today
  const newUsersToday = await prisma.user.count({
    where: {
      created_at: { gte: today }
    }
  });

  // Pending orders
  const pendingOrders = await prisma.order.count({
    where: { status: 'Created' }
  });

  // Total customers
  const totalCustomers = await prisma.user.count({
    where: {
      role: 'Customer',
      is_active: true
    }
  });

  // Total products
  const totalProducts = await prisma.product.count({
    where: { is_active: true }
  });

  return {
    today: {
      orders_count: todayStats._count.order_id,
      revenue: parseFloat(todayStats._sum.final_total || 0)
    },
    low_stock_count: lowStockCount,
    new_users_today: newUsersToday,
    pending_orders: pendingOrders,
    totals: {
      customers: totalCustomers,
      products: totalProducts
    }
  };
};

/**
 * Get sales report grouped by period
 * @param {string} period - daily, monthly, yearly
 * @param {Object} options - Date range options
 * @returns {Array} Sales data
 */
const getSalesReport = async (period, options = {}) => {
  const { start_date, end_date } = options;

  // Build date filter
  let dateTrunc;
  switch (period) {
    case 'daily':
      dateTrunc = 'day';
      break;
    case 'monthly':
      dateTrunc = 'month';
      break;
    case 'yearly':
      dateTrunc = 'year';
      break;
    default:
      dateTrunc = 'day';
  }

  // Build where conditions
  const conditions = ["status != 'Cancelled'"];
  const params = [];
  let paramIndex = 1;

  if (start_date) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(start_date);
  }

  if (end_date) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(end_date);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const result = await prisma.$queryRawUnsafe(
    `SELECT 
      DATE_TRUNC('${dateTrunc}', created_at) as period,
      COUNT(*) as orders_count,
      COALESCE(SUM(total_products_price), 0) as products_revenue,
      COALESCE(SUM(shipping_fees), 0) as shipping_revenue,
      COALESCE(SUM(discount_amount), 0) as total_discount,
      COALESCE(SUM(final_total), 0) as total_revenue
    FROM orders
    ${whereClause}
    GROUP BY DATE_TRUNC('${dateTrunc}', created_at)
    ORDER BY period DESC
    LIMIT 100`,
    ...params
  );

  return result.map(row => ({
    period: row.period,
    orders_count: parseInt(row.orders_count),
    products_revenue: parseFloat(row.products_revenue),
    shipping_revenue: parseFloat(row.shipping_revenue),
    total_discount: parseFloat(row.total_discount),
    total_revenue: parseFloat(row.total_revenue)
  }));
};

/**
 * Get top products by quantity sold
 * @param {Object} options - Limit and date range
 * @returns {Array} Top products
 */
const getTopProducts = async (options = {}) => {
  const { limit = 10, start_date, end_date } = options;

  // Build where conditions
  const conditions = ["o.status != 'Cancelled'"];
  const params = [];
  let paramIndex = 1;

  if (start_date) {
    conditions.push(`o.created_at >= $${paramIndex++}`);
    params.push(start_date);
  }

  if (end_date) {
    conditions.push(`o.created_at <= $${paramIndex++}`);
    params.push(end_date);
  }

  params.push(parseInt(limit));

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const result = await prisma.$queryRawUnsafe(
    `SELECT 
      p.product_id, p.name, p.sale_type, p.price, p.image_url,
      SUM(oi.quantity) as total_quantity,
      COUNT(DISTINCT o.order_id) as orders_count,
      SUM(oi.quantity * oi.price_at_purchase) as total_revenue
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.order_id
    INNER JOIN products p ON oi.product_id = p.product_id
    ${whereClause}
    GROUP BY p.product_id, p.name, p.sale_type, p.price, p.image_url
    ORDER BY total_quantity DESC
    LIMIT $${paramIndex}`,
    ...params
  );

  return result.map(row => ({
    product_id: row.product_id,
    name: row.name,
    sale_type: row.sale_type,
    price: parseFloat(row.price),
    image_url: row.image_url,
    total_quantity: parseFloat(row.total_quantity),
    orders_count: parseInt(row.orders_count),
    total_revenue: parseFloat(row.total_revenue)
  }));
};

/**
 * Get low stock products
 * @param {number} threshold - Stock threshold
 * @returns {Array} Low stock products
 */
const getLowStockProducts = async (threshold = 10) => {
  const products = await prisma.product.findMany({
    where: {
      is_active: true,
      stock_quantity: { lt: threshold }
    },
    select: {
      product_id: true,
      name: true,
      sale_type: true,
      stock_quantity: true,
      price: true,
      category: {
        select: { name: true }
      }
    },
    orderBy: { stock_quantity: 'asc' }
  });

  return products.map(p => ({
    product_id: p.product_id,
    name: p.name,
    sale_type: p.sale_type,
    stock_quantity: parseFloat(p.stock_quantity),
    price: parseFloat(p.price),
    category_name: p.category?.name || null
  }));
};

/**
 * Get profit report grouped by period
 * Profit = (price_at_purchase - cost_price_at_purchase) × quantity
 * @param {string} period - daily, monthly, yearly
 * @param {Object} options - Date range options
 * @returns {Array} Profit data
 */
const getProfitReport = async (period, options = {}) => {
  const { start_date, end_date } = options;

  // Build date trunc
  let dateTrunc;
  switch (period) {
    case 'daily':
      dateTrunc = 'day';
      break;
    case 'monthly':
      dateTrunc = 'month';
      break;
    case 'yearly':
      dateTrunc = 'year';
      break;
    default:
      dateTrunc = 'day';
  }

  // Build where conditions
  const conditions = ["o.status != 'Cancelled'"];
  const params = [];
  let paramIndex = 1;

  if (start_date) {
    conditions.push(`o.created_at >= $${paramIndex++}`);
    params.push(start_date);
  }

  if (end_date) {
    conditions.push(`o.created_at <= $${paramIndex++}`);
    params.push(end_date);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const result = await prisma.$queryRawUnsafe(
    `SELECT 
      DATE_TRUNC('${dateTrunc}', o.created_at) as period,
      COUNT(DISTINCT o.order_id) as orders_count,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.quantity * oi.price_at_purchase) as total_revenue,
      SUM(oi.quantity * oi.cost_price_at_purchase) as total_cost,
      SUM(oi.quantity * (oi.price_at_purchase - oi.cost_price_at_purchase)) as total_profit
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.order_id
    ${whereClause}
    GROUP BY DATE_TRUNC('${dateTrunc}', o.created_at)
    ORDER BY period DESC
    LIMIT 100`,
    ...params
  );

  return result.map(row => {
    const revenue = parseFloat(row.total_revenue);
    const profit = parseFloat(row.total_profit);
    
    return {
      period: row.period,
      orders_count: parseInt(row.orders_count),
      total_quantity: parseFloat(row.total_quantity),
      total_revenue: revenue,
      total_cost: parseFloat(row.total_cost),
      total_profit: profit,
      profit_margin: revenue > 0 ? ((profit / revenue) * 100).toFixed(2) : 0
    };
  });
};

/**
 * Get category sales breakdown
 * @param {Object} options - Date range options
 * @returns {Array} Category sales data
 */
const getCategorySales = async (options = {}) => {
  const { start_date, end_date } = options;

  // Build where conditions
  const conditions = ["o.status != 'Cancelled'"];
  const params = [];
  let paramIndex = 1;

  if (start_date) {
    conditions.push(`o.created_at >= $${paramIndex++}`);
    params.push(start_date);
  }

  if (end_date) {
    conditions.push(`o.created_at <= $${paramIndex++}`);
    params.push(end_date);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const result = await prisma.$queryRawUnsafe(
    `SELECT 
      c.category_id, c.name as category_name,
      COUNT(DISTINCT o.order_id) as orders_count,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.quantity * oi.price_at_purchase) as total_revenue
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.order_id
    INNER JOIN products p ON oi.product_id = p.product_id
    LEFT JOIN categories c ON p.category_id = c.category_id
    ${whereClause}
    GROUP BY c.category_id, c.name
    ORDER BY total_revenue DESC`,
    ...params
  );

  return result.map(row => ({
    category_id: row.category_id,
    category_name: row.category_name,
    orders_count: parseInt(row.orders_count),
    total_quantity: parseFloat(row.total_quantity),
    total_revenue: parseFloat(row.total_revenue)
  }));
};

/**
 * Get order status distribution
 * @returns {Object} Status counts
 */
const getOrderStatusDistribution = async () => {
  const result = await prisma.order.groupBy({
    by: ['status'],
    _count: { order_id: true }
  });

  const distribution = {};
  result.forEach(row => {
    distribution[row.status] = row._count.order_id;
  });

  return distribution;
};

module.exports = {
  getDashboardSummary,
  getSalesReport,
  getTopProducts,
  getLowStockProducts,
  getProfitReport,
  getCategorySales,
  getOrderStatusDistribution
};
