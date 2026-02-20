const prisma = require('../../config/prisma');
const { getPaginationParams, buildPaginatedResponse, getSortParams } = require('../../utils/pagination');

/**
 * Products Service
 * Handles all product-related database operations
 */

/**
 * Get all products with filtering, sorting, and pagination
 * @param {Object} options - Query options
 * @returns {Object} Paginated products list
 */
const getProducts = async (options) => {
  const { search, category_id, sale_type, sort, order, page, limit } = options;
  const { skip, take } = { 
    skip: (parseInt(page) - 1) * parseInt(limit), 
    take: parseInt(limit) 
  };

  // Build where clause
  const where = { is_active: true };

  // Search filter
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } }
    ];
  }

  // Sale type filter
  if (sale_type) {
    where.sale_type = sale_type;
  }

  // Category filter (including subcategories)
  if (category_id) {
    const categoryIds = await prisma.$queryRaw`
      WITH RECURSIVE category_tree AS (
        SELECT category_id FROM categories WHERE category_id = ${parseInt(category_id)}
        UNION
        SELECT c.category_id FROM categories c
        INNER JOIN category_tree ct ON c.parent_id = ct.category_id
      )
      SELECT category_id FROM category_tree
    `;
    where.category_id = { in: categoryIds.map(c => c.category_id) };
  }

  // Get total count
  const totalItems = await prisma.product.count({ where });

  // Determine sort
  const sortField = sort || 'created_at';
  const sortOrder = (order || 'desc').toLowerCase();

  // Get paginated products
  const products = await prisma.product.findMany({
    where,
    select: {
      product_id: true,
      name: true,
      description: true,
      price: true,
      cost_price: true,
      sale_type: true,
      stock_quantity: true,
      image_url: true,
      average_rating: true,
      reviews_count: true,
      category_id: true,
      created_at: true,
      category: {
        select: { name: true }
      }
    },
    orderBy: { [sortField]: sortOrder },
    skip,
    take
  });

  // Transform to match original format
  const transformedProducts = products.map(p => ({
    ...p,
    price: parseFloat(p.price),
    cost_price: parseFloat(p.cost_price),
    stock_quantity: parseFloat(p.stock_quantity),
    average_rating: parseFloat(p.average_rating),
    category_name: p.category?.name || null
  }));

  return buildPaginatedResponse(transformedProducts, totalItems, parseInt(page) || 1, parseInt(limit) || 20);
};

/**
 * Get product by ID
 * @param {number} product_id - Product ID
 * @returns {Object} Product details
 */
const getProductById = async (product_id) => {
  const product = await prisma.product.findFirst({
    where: {
      product_id,
      is_active: true
    },
    select: {
      product_id: true,
      name: true,
      description: true,
      price: true,
      cost_price: true,
      sale_type: true,
      stock_quantity: true,
      image_url: true,
      average_rating: true,
      reviews_count: true,
      category_id: true,
      created_at: true,
      category: {
        select: { name: true }
      }
    }
  });

  if (!product) {
    throw new Error('Product not found');
  }

  return {
    ...product,
    price: parseFloat(product.price),
    cost_price: parseFloat(product.cost_price),
    stock_quantity: parseFloat(product.stock_quantity),
    average_rating: parseFloat(product.average_rating),
    category_name: product.category?.name || null
  };
};

/**
 * Create new product (admin only)
 * @param {Object} productData - Product data
 * @returns {Object} Created product
 */
const createProduct = async (productData) => {
  const { name, description, price, cost_price, sale_type, stock_quantity, category_id, image_url } = productData;

  // Service-level validation for sale_type (critical for DB constraint)
  if (!['kg', 'piece'].includes(sale_type)) {
    throw new Error("sale_type must be 'kg' or 'piece'");
  }

  // Verify category exists
  const category = await prisma.category.findUnique({
    where: { category_id }
  });

  if (!category) {
    throw new Error('Category not found');
  }

  // Create product
  const product = await prisma.product.create({
    data: {
      name,
      description: description || null,
      price,
      cost_price: cost_price || 0,
      sale_type,
      stock_quantity: stock_quantity || 0,
      category_id,
      image_url: image_url || null
    },
    select: {
      product_id: true,
      name: true,
      description: true,
      price: true,
      cost_price: true,
      sale_type: true,
      stock_quantity: true,
      category_id: true,
      image_url: true,
      created_at: true
    }
  });

  // Log initial stock if > 0
  if (stock_quantity && stock_quantity > 0) {
    await prisma.stockTransaction.create({
      data: {
        product_id: product.product_id,
        quantity_change: stock_quantity,
        reason: 'admin_add'
      }
    });
  }

  return {
    ...product,
    price: parseFloat(product.price),
    cost_price: parseFloat(product.cost_price),
    stock_quantity: parseFloat(product.stock_quantity)
  };
};

/**
 * Update product (admin only)
 * @param {number} product_id - Product ID
 * @param {Object} updateData - Data to update
 * @returns {Object} Updated product
 */
const updateProduct = async (product_id, updateData) => {
  const { name, description, price, cost_price, sale_type, category_id, image_url } = updateData;

  // Service-level validation for sale_type if provided (critical for DB constraint)
  if (sale_type && !['kg', 'piece'].includes(sale_type)) {
    throw new Error("sale_type must be 'kg' or 'piece'");
  }

  // Check if product exists
  const existingProduct = await prisma.product.findUnique({
    where: { product_id }
  });

  if (!existingProduct) {
    throw new Error('Product not found');
  }

  // If category_id provided, verify it exists
  if (category_id) {
    const category = await prisma.category.findUnique({
      where: { category_id }
    });

    if (!category) {
      throw new Error('Category not found');
    }
  }

  // Build update data
  const updatePayload = {};
  if (name !== undefined) updatePayload.name = name;
  if (description !== undefined) updatePayload.description = description;
  if (price !== undefined) updatePayload.price = price;
  if (cost_price !== undefined) updatePayload.cost_price = cost_price;
  if (sale_type !== undefined) updatePayload.sale_type = sale_type;
  if (category_id !== undefined) updatePayload.category_id = category_id;
  if (image_url !== undefined) updatePayload.image_url = image_url;

  const product = await prisma.product.update({
    where: { product_id },
    data: updatePayload,
    select: {
      product_id: true,
      name: true,
      description: true,
      price: true,
      cost_price: true,
      sale_type: true,
      stock_quantity: true,
      category_id: true,
      image_url: true
    }
  });

  return {
    ...product,
    price: parseFloat(product.price),
    cost_price: parseFloat(product.cost_price),
    stock_quantity: parseFloat(product.stock_quantity)
  };
};

/**
 * Soft delete product (admin only)
 * @param {number} product_id - Product ID
 * @returns {Object} Deleted product info
 */
const deleteProduct = async (product_id) => {
  const product = await prisma.product.updateMany({
    where: {
      product_id,
      is_active: true
    },
    data: { is_active: false }
  });

  if (product.count === 0) {
    throw new Error('Product not found or already deleted');
  }

  return { product_id, deleted: true };
};

/**
 * Adjust stock quantity (admin only)
 * @param {number} product_id - Product ID
 * @param {Object} stockData - Stock adjustment data
 * @returns {Object} Updated product
 */
const adjustStock = async (product_id, stockData) => {
  const { quantity_change, reason } = stockData;

  // Verify valid reason
  if (!['admin_add', 'admin_remove'].includes(reason)) {
    throw new Error('Invalid reason. Must be admin_add or admin_remove');
  }

  // Check current stock
  const product = await prisma.product.findFirst({
    where: { product_id, is_active: true },
    select: { product_id: true, stock_quantity: true }
  });

  if (!product) {
    throw new Error('Product not found');
  }

  const currentStock = parseFloat(product.stock_quantity);
  const change = parseFloat(quantity_change);
  const newStock = currentStock + change;

  // Check if stock would go negative
  if (newStock < 0) {
    throw new Error(`Insufficient stock. Current: ${currentStock}, Attempted change: ${change}`);
  }

  // Update stock and log transaction
  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { product_id },
      data: { stock_quantity: newStock }
    });

    await tx.stockTransaction.create({
      data: {
        product_id,
        quantity_change: change,
        reason
      }
    });
  });

  return {
    product_id,
    previous_stock: currentStock,
    quantity_change: change,
    new_stock: newStock
  };
};

/**
 * Get stock transaction history (admin only)
 * @param {number} product_id - Product ID
 * @param {Object} options - Pagination options
 * @returns {Object} Paginated stock history
 */
const getStockHistory = async (product_id, options) => {
  const { page, limit } = options;
  const { skip, take } = { 
    skip: (parseInt(page) - 1) * parseInt(limit), 
    take: parseInt(limit) 
  };

  // Verify product exists
  const product = await prisma.product.findUnique({
    where: { product_id },
    select: { product_id: true, name: true }
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // Get total count
  const totalItems = await prisma.stockTransaction.count({
    where: { product_id }
  });

  // Get paginated history
  const transactions = await prisma.stockTransaction.findMany({
    where: { product_id },
    select: {
      transaction_id: true,
      quantity_change: true,
      reason: true,
      related_order_id: true,
      created_at: true
    },
    orderBy: { created_at: 'desc' },
    skip,
    take
  });

  return {
    product,
    ...buildPaginatedResponse(
      transactions.map(t => ({
        ...t,
        quantity_change: parseFloat(t.quantity_change)
      })),
      totalItems,
      parseInt(page) || 1,
      parseInt(limit) || 20
    )
  };
};

/**
 * Get all products for admin (including inactive)
 * @param {Object} options - Query options
 * @returns {Object} Paginated products list
 */
const getAllProductsAdmin = async (options) => {
  const { search, category_id, sale_type, is_active, sort, order, page, limit } = options;
  const { skip, take } = { 
    skip: (parseInt(page) - 1) * parseInt(limit), 
    take: parseInt(limit) 
  };

  // Build where clause
  const where = {};

  // Search filter
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  // Category filter
  if (category_id) {
    where.category_id = parseInt(category_id);
  }

  // Sale type filter
  if (sale_type) {
    where.sale_type = sale_type;
  }

  // Active status filter
  if (is_active !== undefined) {
    where.is_active = is_active === 'true';
  }

  // Get total count
  const totalItems = await prisma.product.count({ where });

  // Determine sort
  const sortField = sort || 'created_at';
  const sortOrder = (order || 'desc').toLowerCase();

  // Get paginated products
  const products = await prisma.product.findMany({
    where,
    select: {
      product_id: true,
      name: true,
      price: true,
      cost_price: true,
      sale_type: true,
      stock_quantity: true,
      image_url: true,
      is_active: true,
      average_rating: true,
      reviews_count: true,
      category_id: true,
      created_at: true,
      category: {
        select: { name: true }
      }
    },
    orderBy: { [sortField]: sortOrder },
    skip,
    take
  });

  // Transform to match original format
  const transformedProducts = products.map(p => ({
    ...p,
    price: parseFloat(p.price),
    cost_price: parseFloat(p.cost_price),
    stock_quantity: parseFloat(p.stock_quantity),
    average_rating: parseFloat(p.average_rating),
    category_name: p.category?.name || null
  }));

  return buildPaginatedResponse(transformedProducts, totalItems, parseInt(page) || 1, parseInt(limit) || 20);
};

/**
 * Get product with category info
 * @param {number} product_id - Product ID
 * @returns {Object} Product with category
 */
const getProductWithCategory = async (product_id) => {
  const product = await prisma.product.findUnique({
    where: { product_id },
    select: {
      product_id: true,
      name: true,
      description: true,
      price: true,
      cost_price: true,
      sale_type: true,
      stock_quantity: true,
      image_url: true,
      is_active: true,
      average_rating: true,
      reviews_count: true,
      category_id: true,
      created_at: true,
      category: {
        select: { name: true }
      }
    }
  });

  if (!product) {
    throw new Error('Product not found');
  }

  return {
    ...product,
    price: parseFloat(product.price),
    cost_price: parseFloat(product.cost_price),
    stock_quantity: parseFloat(product.stock_quantity),
    average_rating: parseFloat(product.average_rating),
    category_name: product.category?.name || null
  };
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getStockHistory,
  getAllProductsAdmin,
  getProductWithCategory
};
