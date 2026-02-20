const express = require('express');
const router = express.Router();
const reportsController = require('./reports.controller');
const { authenticate, requireAdmin } = require('../../middlewares/auth.middleware');

/**
 * Reports Routes (Admin Only)
 */

/**
 * @route   GET /api/admin/reports/dashboard-summary
 * @desc    Get dashboard summary (today's orders, revenue, low stock, new users)
 * @access  Private (admin only)
 */
router.get('/admin/reports/dashboard-summary', authenticate, requireAdmin, reportsController.getDashboardSummary);

/**
 * @route   GET /api/admin/reports/sales
 * @desc    Get sales report grouped by period
 * @access  Private (admin only)
 */
router.get('/admin/reports/sales', authenticate, requireAdmin, reportsController.getSalesReport);

/**
 * @route   GET /api/admin/reports/top-products
 * @desc    Get top selling products by quantity
 * @access  Private (admin only)
 */
router.get('/admin/reports/top-products', authenticate, requireAdmin, reportsController.getTopProducts);

/**
 * @route   GET /api/admin/reports/low-stock
 * @desc    Get products below stock threshold
 * @access  Private (admin only)
 */
router.get('/admin/reports/low-stock', authenticate, requireAdmin, reportsController.getLowStockProducts);

/**
 * @route   GET /api/admin/reports/profit
 * @desc    Get profit report grouped by period
 * @access  Private (admin only)
 */
router.get('/admin/reports/profit', authenticate, requireAdmin, reportsController.getProfitReport);

/**
 * @route   GET /api/admin/reports/category-sales
 * @desc    Get sales breakdown by category
 * @access  Private (admin only)
 */
router.get('/admin/reports/category-sales', authenticate, requireAdmin, reportsController.getCategorySales);

/**
 * @route   GET /api/admin/reports/order-status
 * @desc    Get order status distribution
 * @access  Private (admin only)
 */
router.get('/admin/reports/order-status', authenticate, requireAdmin, reportsController.getOrderStatusDistribution);

module.exports = router;
