const productsService = require('./products.service');
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  createdResponse,
  serverErrorResponse
} = require('../../utils/response');

/**
 * Products Controller
 * Handles HTTP request and response for product endpoints
 */

/**
 * Get all products
 * GET /api/products
 * Public route
 */
const getProducts = async (req, res) => {
  try {
    const { search, category_id, sale_type, sort, order, page, limit } = req.query;

    // Validate sale_type if provided
    if (sale_type && !['kg', 'piece'].includes(sale_type)) {
      return errorResponse(res, 'Invalid sale_type. Must be "kg" or "piece"', 400);
    }

    const result = await productsService.getProducts({
      search,
      category_id,
      sale_type,
      sort,
      order,
      page: page || 1,
      limit: limit || 20
    });

    return successResponse(res, result, 'Products retrieved successfully');
  } catch (error) {
    console.error('Get products error:', error);
    return serverErrorResponse(res, 'Failed to get products');
  }
};

/**
 * Get product by ID
 * GET /api/products/:id
 * Public route
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid product ID', 400);
    }

    const product = await productsService.getProductById(parseInt(id));

    return successResponse(res, product, 'Product retrieved successfully');
  } catch (error) {
    if (error.message === 'Product not found') {
      return notFoundResponse(res, 'Product');
    }
    console.error('Get product error:', error);
    return serverErrorResponse(res, 'Failed to get product');
  }
};

/**
 * Create product (admin only)
 * POST /api/admin/products
 */
const createProduct = async (req, res) => {
  try {
    const { name, description, price, cost_price, sale_type, stock_quantity, category_id } = req.body;

    // Validate required fields
    if (!name || !price || !sale_type || !category_id) {
      return errorResponse(res, 'Name, price, sale_type, and category_id are required', 400);
    }

    // Validate sale_type
    if (!['kg', 'piece'].includes(sale_type)) {
      return errorResponse(res, 'sale_type must be "kg" or "piece"', 400);
    }

    // Validate price
    if (parseFloat(price) < 0) {
      return errorResponse(res, 'Price cannot be negative', 400);
    }

    // Get image URL from uploaded file
    const image_url = req.file ? `/uploads/products/${req.file.filename}` : null;

    const product = await productsService.createProduct({
      name: name.trim(),
      description,
      price: parseFloat(price),
      cost_price: cost_price ? parseFloat(cost_price) : 0,
      sale_type,
      stock_quantity: stock_quantity ? parseFloat(stock_quantity) : 0,
      category_id: parseInt(category_id),
      image_url
    });

    return createdResponse(res, product, 'Product created successfully');
  } catch (error) {
    if (error.message === 'Category not found') {
      return errorResponse(res, error.message, 404);
    }
    console.error('Create product error:', error);
    return serverErrorResponse(res, 'Failed to create product');
  }
};

/**
 * Update product (admin only)
 * PUT /api/admin/products/:id
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, cost_price, sale_type, category_id } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid product ID', 400);
    }

    // Validate sale_type if provided
    if (sale_type && !['kg', 'piece'].includes(sale_type)) {
      return errorResponse(res, 'sale_type must be "kg" or "piece"', 400);
    }

    // Validate price if provided
    if (price !== undefined && parseFloat(price) < 0) {
      return errorResponse(res, 'Price cannot be negative', 400);
    }

    // Get image URL from uploaded file if exists
    const image_url = req.file ? `/uploads/products/${req.file.filename}` : undefined;

    const product = await productsService.updateProduct(parseInt(id), {
      name: name ? name.trim() : undefined,
      description,
      price: price ? parseFloat(price) : undefined,
      cost_price: cost_price !== undefined ? parseFloat(cost_price) : undefined,
      sale_type,
      category_id: category_id ? parseInt(category_id) : undefined,
      image_url
    });

    return successResponse(res, product, 'Product updated successfully');
  } catch (error) {
    if (error.message === 'Product not found') {
      return notFoundResponse(res, 'Product');
    }
    if (error.message === 'Category not found') {
      return errorResponse(res, error.message, 404);
    }
    console.error('Update product error:', error);
    return serverErrorResponse(res, 'Failed to update product');
  }
};

/**
 * Delete product (soft delete, admin only)
 * DELETE /api/admin/products/:id
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid product ID', 400);
    }

    const product = await productsService.deleteProduct(parseInt(id));

    return successResponse(res, product, 'Product deleted successfully');
  } catch (error) {
    if (error.message === 'Product not found or already deleted') {
      return notFoundResponse(res, 'Product');
    }
    console.error('Delete product error:', error);
    return serverErrorResponse(res, 'Failed to delete product');
  }
};

/**
 * Adjust stock quantity (admin only)
 * POST /api/admin/products/:id/stock
 */
const adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity_change, reason } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid product ID', 400);
    }

    // Validate required fields
    if (quantity_change === undefined || !reason) {
      return errorResponse(res, 'quantity_change and reason are required', 400);
    }

    // Validate quantity_change is a number
    if (isNaN(parseFloat(quantity_change))) {
      return errorResponse(res, 'quantity_change must be a number', 400);
    }

    const result = await productsService.adjustStock(parseInt(id), {
      quantity_change: parseFloat(quantity_change),
      reason
    });

    return successResponse(res, result, 'Stock adjusted successfully');
  } catch (error) {
    if (error.message === 'Product not found') {
      return notFoundResponse(res, 'Product');
    }
    if (error.message === 'Invalid reason. Must be admin_add or admin_remove') {
      return errorResponse(res, error.message, 400);
    }
    if (error.message.startsWith('Insufficient stock')) {
      return errorResponse(res, error.message, 400);
    }
    console.error('Adjust stock error:', error);
    return serverErrorResponse(res, 'Failed to adjust stock');
  }
};

/**
 * Get stock history (admin only)
 * GET /api/admin/products/:id/stock-history
 */
const getStockHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;

    if (!id || isNaN(parseInt(id))) {
      return errorResponse(res, 'Invalid product ID', 400);
    }

    const result = await productsService.getStockHistory(parseInt(id), {
      page: page || 1,
      limit: limit || 20
    });

    return successResponse(res, result, 'Stock history retrieved successfully');
  } catch (error) {
    if (error.message === 'Product not found') {
      return notFoundResponse(res, 'Product');
    }
    console.error('Get stock history error:', error);
    return serverErrorResponse(res, 'Failed to get stock history');
  }
};

/**
 * Get all products for admin (including inactive)
 * GET /api/admin/products
 */
const getAllProductsAdmin = async (req, res) => {
  try {
    const { search, category_id, sale_type, is_active, sort, order, page, limit } = req.query;

    const result = await productsService.getAllProductsAdmin({
      search,
      category_id,
      sale_type,
      is_active,
      sort,
      order,
      page: page || 1,
      limit: limit || 20
    });

    return successResponse(res, result, 'Products retrieved successfully');
  } catch (error) {
    console.error('Get all products admin error:', error);
    return serverErrorResponse(res, 'Failed to get products');
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getStockHistory,
  getAllProductsAdmin
};
