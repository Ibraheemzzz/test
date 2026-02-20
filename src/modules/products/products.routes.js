const express = require('express');
const router = express.Router();
const productsController = require('./products.controller');
const { authenticate, requireAdmin } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { uploadProductImage, handleMulterError } = require('../../config/multer');
const productsValidators = require('./products.validators');

/**
 * Products Routes
 */

/**
 * @route   GET /api/products
 * @desc    Get all products with filtering, sorting, and pagination
 * @access  Public
 */
router.get('/', productsController.getProducts);

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID
 * @access  Public
 */
router.get('/:id', productsController.getProductById);

/**
 * Admin Routes
 */

/**
 * @route   GET /api/admin/products
 * @desc    Get all products (including inactive)
 * @access  Private (admin only)
 */
router.get('/admin/products', authenticate, requireAdmin, productsController.getAllProductsAdmin);

/**
 * @route   POST /api/admin/products
 * @desc    Create new product with image upload
 * @access  Private (admin only)
 */
router.post(
  '/admin/products',
  authenticate,
  requireAdmin,
  uploadProductImage.single('image'),
  handleMulterError,
  productsValidators.create,
  validate,
  productsController.createProduct
);

/**
 * @route   PUT /api/admin/products/:id
 * @desc    Update product with optional image upload
 * @access  Private (admin only)
 */
router.put(
  '/admin/products/:id',
  authenticate,
  requireAdmin,
  uploadProductImage.single('image'),
  handleMulterError,
  productsValidators.update,
  validate,
  productsController.updateProduct
);

/**
 * @route   DELETE /api/admin/products/:id
 * @desc    Soft delete product
 * @access  Private (admin only)
 */
router.delete('/admin/products/:id', authenticate, requireAdmin, productsController.deleteProduct);

/**
 * @route   POST /api/admin/products/:id/stock
 * @desc    Adjust product stock
 * @access  Private (admin only)
 */
router.post('/admin/products/:id/stock', authenticate, requireAdmin, productsValidators.adjustStock, validate, productsController.adjustStock);

/**
 * @route   GET /api/admin/products/:id/stock-history
 * @desc    Get product stock transaction history
 * @access  Private (admin only)
 */
router.get('/admin/products/:id/stock-history', authenticate, requireAdmin, productsController.getStockHistory);

module.exports = router;
