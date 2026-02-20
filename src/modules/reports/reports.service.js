const { query } = require('../../config/db');

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
  const today = new Date().toISOString().split('T')[0];

  // Today's orders and revenue
  const todayStats = await query(
    `SELECT COUNT(*) as orders_count, COALESCE(SUM(final_total), 0) as revenue
     FROM orders 
     WHERE DATE(created_at) = $1 AND status != 'Cancelled'`,
    [today]
  );

  // Low stock count (below threshold)
  const lowStockResult = await query(
    `SELECT COUNT(*) as count
     FROM products
     WHERE is_active = true AND stock_quantity < 10`
  );

  // New users today
  const newUsersResult = await query(
    `SELECT COUNT(*) as count
     FROM users
     WHERE DATE(created_at) = $1`,
    [today]
  );

  // Pending orders
  const pendingOrdersResult = await query(
    `SELECT COUNT(*) as count
     FROM orders
     WHERE status = 'Created'`
  );

  // Total customers
  const totalCustomersResult = await query(
    `SELECT COUNT(*) as count
     FROM users
     WHERE role = 'Customer' AND is_active = true`
  );

  // Total products
  const totalProductsResult = await query(
    `SELECT COUNT(*) as count
     FROM products
     WHERE is_active = true`
  );

  return {
    today: {
      orders_count: parseInt(todayStats.rows[0].orders_count),
      revenue: parseFloat(todayStats.rows[0].revenue)
    },
    low_stock_count: parseInt(lowStockResult.rows[0].count),
    new_users_today: parseInt(newUsersResult.rows[0].count),
    pending_orders: parseInt(pendingOrdersResult.rows[0].count),
    totals: {
      customers: parseInt(totalCustomersResult.rows[0].count),
      products: parseInt(totalProductsResult.rows[0].count)
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

  let dateFormat;
  let groupBy;

  switch (period) {
    case 'daily':
      dateFormat = 'YYYY-MM-DD';
      groupBy = 'DATE(created_at)';
      break;
    case 'monthly':
      dateFormat = 'YYYY-MM';
      groupBy = "TO_CHAR(created_at, 'YYYY-MM')";
      break;
    case 'yearly':
      dateFormat = 'YYYY';
      groupBy = "TO_CHAR(created_at, 'YYYY')";
      break;
    default:
      dateFormat = 'YYYY-MM-DD';
      groupBy = 'DATE(created_at)';
  }

  let whereClause = "WHERE status != 'Cancelled'";
  const params = [];

  if (start_date) {
    params.push(start_date);
    whereClause += ` AND DATE(created_at) >= $${params.length}`;
  }

  if (end_date) {
    params.push(end_date);
    whereClause += ` AND DATE(created_at) <= $${params.length}`;
  }

  const result = await query(
    `SELECT ${groupBy} as period,
            COUNT(*) as orders_count,
            COALESCE(SUM(total_products_price), 0) as products_revenue,
            COALESCE(SUM(shipping_fees), 0) as shipping_revenue,
            COALESCE(SUM(discount_amount), 0) as total_discount,
            COALESCE(SUM(final_total), 0) as total_revenue
     FROM orders
     ${whereClause}
     GROUP BY ${groupBy}
     ORDER BY period DESC
     LIMIT 100`,
    params
  );

  return result.rows.map(row => ({
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

  let whereClause = "WHERE o.status != 'Cancelled'";
  const params = [];

  if (start_date) {
    params.push(start_date);
    whereClause += ` AND DATE(o.created_at) >= $${params.length}`;
  }

  if (end_date) {
    params.push(end_date);
    whereClause += ` AND DATE(o.created_at) <= $${params.length}`;
  }

  params.push(limit);

  const result = await query(
    `SELECT p.product_id, p.name, p.sale_type, p.price, p.image_url,
            SUM(oi.quantity) as total_quantity,
            COUNT(DISTINCT o.order_id) as orders_count,
            SUM(oi.quantity * oi.price_at_purchase) as total_revenue
     FROM order_items oi
     INNER JOIN orders o ON oi.order_id = o.order_id
     INNER JOIN products p ON oi.product_id = p.product_id
     ${whereClause}
     GROUP BY p.product_id, p.name, p.sale_type, p.price, p.image_url
     ORDER BY total_quantity DESC
     LIMIT $${params.length}`,
    params
  );

  return result.rows.map(row => ({
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
  const result = await query(
    `SELECT p.product_id, p.name, p.sale_type, p.stock_quantity, p.price,
            c.name as category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.category_id
     WHERE p.is_active = true AND p.stock_quantity < $1
     ORDER BY p.stock_quantity ASC`,
    [threshold]
  );

  return result.rows.map(row => ({
    product_id: row.product_id,
    name: row.name,
    sale_type: row.sale_type,
    stock_quantity: parseFloat(row.stock_quantity),
    price: parseFloat(row.price),
    category_name: row.category_name
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

  let groupBy;

  switch (period) {
    case 'daily':
      groupBy = 'DATE(o.created_at)';
      break;
    case 'monthly':
      groupBy = "TO_CHAR(o.created_at, 'YYYY-MM')";
      break;
    case 'yearly':
      groupBy = "TO_CHAR(o.created_at, 'YYYY')";
      break;
    default:
      groupBy = 'DATE(o.created_at)';
  }

  let whereClause = "WHERE o.status != 'Cancelled'";
  const params = [];

  if (start_date) {
    params.push(start_date);
    whereClause += ` AND DATE(o.created_at) >= $${params.length}`;
  }

  if (end_date) {
    params.push(end_date);
    whereClause += ` AND DATE(o.created_at) <= $${params.length}`;
  }

  const result = await query(
    `SELECT ${groupBy} as period,
            COUNT(DISTINCT o.order_id) as orders_count,
            SUM(oi.quantity) as total_quantity,
            SUM(oi.quantity * oi.price_at_purchase) as total_revenue,
            SUM(oi.quantity * oi.cost_price_at_purchase) as total_cost,
            SUM(oi.quantity * (oi.price_at_purchase - oi.cost_price_at_purchase)) as total_profit
     FROM order_items oi
     INNER JOIN orders o ON oi.order_id = o.order_id
     ${whereClause}
     GROUP BY ${groupBy}
     ORDER BY period DESC
     LIMIT 100`,
    params
  );

  return result.rows.map(row => ({
    period: row.period,
    orders_count: parseInt(row.orders_count),
    total_quantity: parseFloat(row.total_quantity),
    total_revenue: parseFloat(row.total_revenue),
    total_cost: parseFloat(row.total_cost),
    total_profit: parseFloat(row.total_profit),
    profit_margin: parseFloat(row.total_revenue) > 0 
      ? ((parseFloat(row.total_profit) / parseFloat(row.total_revenue)) * 100).toFixed(2)
      : 0
  }));
};

/**
 * Get category sales breakdown
 * @param {Object} options - Date range options
 * @returns {Array} Category sales data
 */
const getCategorySales = async (options = {}) => {
  const { start_date, end_date } = options;

  let whereClause = "WHERE o.status != 'Cancelled'";
  const params = [];

  if (start_date) {
    params.push(start_date);
    whereClause += ` AND DATE(o.created_at) >= $${params.length}`;
  }

  if (end_date) {
    params.push(end_date);
    whereClause += ` AND DATE(o.created_at) <= $${params.length}`;
  }

  const result = await query(
    `SELECT c.category_id, c.name as category_name,
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
    params
  );

  return result.rows.map(row => ({
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
  const result = await query(
    `SELECT status, COUNT(*) as count
     FROM orders
     GROUP BY status
     ORDER BY count DESC`
  );

  const distribution = {};
  result.rows.forEach(row => {
    distribution[row.status] = parseInt(row.count);
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
