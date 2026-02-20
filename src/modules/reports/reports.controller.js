const reportsService = require('./reports.service');
const {
  successResponse,
  errorResponse,
  serverErrorResponse
} = require('../../utils/response');

/**
 * Reports Controller
 * Handles HTTP request and response for admin report endpoints
 */

/**
 * Get dashboard summary
 * GET /api/admin/reports/dashboard-summary
 */
const getDashboardSummary = async (req, res) => {
  try {
    const summary = await reportsService.getDashboardSummary();

    return successResponse(res, summary, 'Dashboard summary retrieved successfully');
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    return serverErrorResponse(res, 'Failed to get dashboard summary');
  }
};

/**
 * Get sales report
 * GET /api/admin/reports/sales
 */
const getSalesReport = async (req, res) => {
  try {
    const { period = 'daily', start_date, end_date } = req.query;

    // Validate period
    if (!['daily', 'monthly', 'yearly'].includes(period)) {
      return errorResponse(res, 'Invalid period. Must be daily, monthly, or yearly', 400);
    }

    const report = await reportsService.getSalesReport(period, { start_date, end_date });

    return successResponse(res, report, 'Sales report retrieved successfully');
  } catch (error) {
    console.error('Get sales report error:', error);
    return serverErrorResponse(res, 'Failed to get sales report');
  }
};

/**
 * Get top products
 * GET /api/admin/reports/top-products
 */
const getTopProducts = async (req, res) => {
  try {
    const { limit, start_date, end_date } = req.query;

    const products = await reportsService.getTopProducts({
      limit: parseInt(limit) || 10,
      start_date,
      end_date
    });

    return successResponse(res, products, 'Top products retrieved successfully');
  } catch (error) {
    console.error('Get top products error:', error);
    return serverErrorResponse(res, 'Failed to get top products');
  }
};

/**
 * Get low stock products
 * GET /api/admin/reports/low-stock
 */
const getLowStockProducts = async (req, res) => {
  try {
    const { threshold = 10 } = req.query;

    if (isNaN(parseInt(threshold)) || parseInt(threshold) < 0) {
      return errorResponse(res, 'Threshold must be a positive number', 400);
    }

    const products = await reportsService.getLowStockProducts(parseInt(threshold));

    return successResponse(res, products, 'Low stock products retrieved successfully');
  } catch (error) {
    console.error('Get low stock products error:', error);
    return serverErrorResponse(res, 'Failed to get low stock products');
  }
};

/**
 * Get profit report
 * GET /api/admin/reports/profit
 */
const getProfitReport = async (req, res) => {
  try {
    const { period = 'daily', start_date, end_date } = req.query;

    // Validate period
    if (!['daily', 'monthly', 'yearly'].includes(period)) {
      return errorResponse(res, 'Invalid period. Must be daily, monthly, or yearly', 400);
    }

    const report = await reportsService.getProfitReport(period, { start_date, end_date });

    return successResponse(res, report, 'Profit report retrieved successfully');
  } catch (error) {
    console.error('Get profit report error:', error);
    return serverErrorResponse(res, 'Failed to get profit report');
  }
};

/**
 * Get category sales breakdown
 * GET /api/admin/reports/category-sales
 */
const getCategorySales = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const report = await reportsService.getCategorySales({ start_date, end_date });

    return successResponse(res, report, 'Category sales retrieved successfully');
  } catch (error) {
    console.error('Get category sales error:', error);
    return serverErrorResponse(res, 'Failed to get category sales');
  }
};

/**
 * Get order status distribution
 * GET /api/admin/reports/order-status
 */
const getOrderStatusDistribution = async (req, res) => {
  try {
    const distribution = await reportsService.getOrderStatusDistribution();

    return successResponse(res, distribution, 'Order status distribution retrieved successfully');
  } catch (error) {
    console.error('Get order status distribution error:', error);
    return serverErrorResponse(res, 'Failed to get order status distribution');
  }
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
