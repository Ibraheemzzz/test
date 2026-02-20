const categoriesService = require('./categories.service');
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  createdResponse,
  serverErrorResponse
} = require('../../utils/response');

/**
 * Categories Controller
 * Handles HTTP request and response for category endpoints
 */

/**
 * Get category tree (hierarchical)
 * GET /api/categories
 * Public route
 */
const getCategoryTree = async (req, res) => {
  try {
    const categories = await categoriesService.getCategoryTree();

    return successResponse(res, categories, 'Categories retrieved successfully');
  } catch (error) {
    console.error('Get category tree error:', error);
    return serverErrorResponse(res, 'Failed to get categories');
  }
};

/**
 * Get all categories (flat list)
 * GET /api/categories/list
 * Public route
 */
const getAllCategories = async (req, res) => {
  try {
    const categories = await categoriesService.getAllCategories();

    return successResponse(res, categories, 'Categories retrieved successfully');
  } catch (error) {
    console.error('Get all categories error:', error);
    return serverErrorResponse(res, 'Failed to get categories');
  }
};

/**
 * Get category by ID
 * GET /api/categories/:id
 * Public route
 */
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid category ID', 400);
    }

    const category = await categoriesService.getCategoryById(parseInt(id));
    const path = await categoriesService.getCategoryPath(parseInt(id));

    return successResponse(res, {
      ...category,
      path
    }, 'Category retrieved successfully');
  } catch (error) {
    if (error.message === 'Category not found') {
      return notFoundResponse(res, 'Category');
    }
    console.error('Get category error:', error);
    return serverErrorResponse(res, 'Failed to get category');
  }
};

/**
 * Create category (admin only)
 * POST /api/admin/categories
 */
const createCategory = async (req, res) => {
  try {
    const { name, parent_id } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return errorResponse(res, 'Category name is required', 400);
    }

    const category = await categoriesService.createCategory({
      name: name.trim(),
      parent_id: parent_id || null
    });

    return createdResponse(res, category, 'Category created successfully');
  } catch (error) {
    if (error.message === 'Category with this name already exists at this level') {
      return errorResponse(res, error.message, 409);
    }
    if (error.message === 'Parent category not found') {
      return errorResponse(res, error.message, 404);
    }
    console.error('Create category error:', error);
    return serverErrorResponse(res, 'Failed to create category');
  }
};

/**
 * Update category (admin only)
 * PUT /api/admin/categories/:id
 */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parent_id } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid category ID', 400);
    }

    // At least one field must be provided
    if (!name && parent_id === undefined) {
      return errorResponse(res, 'At least one field (name or parent_id) must be provided', 400);
    }

    const category = await categoriesService.updateCategory(parseInt(id), {
      name: name ? name.trim() : undefined,
      parent_id
    });

    return successResponse(res, category, 'Category updated successfully');
  } catch (error) {
    if (error.message === 'Category not found') {
      return notFoundResponse(res, 'Category');
    }
    if (error.message === 'Parent category not found') {
      return errorResponse(res, error.message, 404);
    }
    if (error.message === 'Category cannot be its own parent' || 
        error.message === 'Cannot set a descendant category as parent' ||
        error.message === 'Category with this name already exists at this level') {
      return errorResponse(res, error.message, 400);
    }
    console.error('Update category error:', error);
    return serverErrorResponse(res, 'Failed to update category');
  }
};

/**
 * Delete category (admin only)
 * DELETE /api/admin/categories/:id
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid category ID', 400);
    }

    const category = await categoriesService.deleteCategory(parseInt(id));

    return successResponse(res, category, 'Category deleted successfully');
  } catch (error) {
    if (error.message === 'Category not found') {
      return notFoundResponse(res, 'Category');
    }
    if (error.message === 'Cannot delete category with active products' ||
        error.message === 'Cannot delete category with subcategories. Delete subcategories first.') {
      return errorResponse(res, error.message, 400);
    }
    console.error('Delete category error:', error);
    return serverErrorResponse(res, 'Failed to delete category');
  }
};

module.exports = {
  getCategoryTree,
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};
