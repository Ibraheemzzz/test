const express = require('express');
const router = express.Router();
const categoriesController = require('./categories.controller');
const { authenticate, requireAdmin } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const categoriesValidators = require('./categories.validators');

/**
 * Categories Routes
 */

/**
 * @route   GET /api/categories
 * @desc    Get all categories as hierarchical tree
 * @access  Public
 */
router.get('/', categoriesController.getCategoryTree);

/**
 * @route   GET /api/categories/list
 * @desc    Get all categories as flat list
 * @access  Public
 */
router.get('/list', categoriesController.getAllCategories);

/**
 * @route   GET /api/categories/:id
 * @desc    Get category by ID
 * @access  Public
 */
router.get('/:id', categoriesController.getCategoryById);

/**
 * Admin Routes
 */

/**
 * @route   POST /api/admin/categories
 * @desc    Create new category
 * @access  Private (admin only)
 */
router.post('/admin/categories', authenticate, requireAdmin, categoriesValidators.create, validate, categoriesController.createCategory);

/**
 * @route   PUT /api/admin/categories/:id
 * @desc    Update category
 * @access  Private (admin only)
 */
router.put('/admin/categories/:id', authenticate, requireAdmin, categoriesValidators.update, validate, categoriesController.updateCategory);

/**
 * @route   DELETE /api/admin/categories/:id
 * @desc    Delete category
 * @access  Private (admin only)
 */
router.delete('/admin/categories/:id', authenticate, requireAdmin, categoriesController.deleteCategory);

module.exports = router;
