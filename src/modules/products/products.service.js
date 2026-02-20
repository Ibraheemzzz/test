const { query } = require('../../config/db');
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
  const { offset } = getPaginationParams({ page, limit });
  
  // Allowed sort fields
  const allowedSortFields = ['name', 'price', 'stock_quantity', 'created_at', 'average_rating'];
  const { sortBy, sortOrder } = getSortParams(
    { sort, order },
    'created_at',
    'DESC',
    allowedSortFields
  );

  let whereClause = 'WHERE p.is_active = true';
  const params = [];
  let paramIndex = 1;

  // Search filter
  if (search) {
    whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Category filter (including subcategories)
  if (category_id) {
    whereClause += ` AND p.category_id IN (
      WITH RECURSIVE category_tree AS (
        SELECT category_id FROM categories WHERE category_id = $${paramIndex}
        UNION
        SELECT c.category_id FROM categories c
        INNER JOIN category_tree ct ON c.parent_id = ct.category_id
      )
      SELECT category_id FROM category_tree
    )`;
    params.push(category_id);
    paramIndex++;
  }

  // Sale type filter
  if (sale_type) {
    whereClause += ` AND p.sale_type = $${paramIndex}`;
    params.push(sale_type);
    paramIndex++;
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM products p ${whereClause}`,
    params
  );
  const totalItems = parseInt(countResult.rows[0].total);

  // Get paginated products
  params.push(limit, offset);
  const result = await query(
    `SELECT p.product_id, p.name, p.description, p.price, p.cost_price, p.sale_type,
            p.stock_quantity, p.image_url, p.average_rating, p.reviews_count,
            p.category_id, c.name as category_name, p.created_at
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.category_id
     ${whereClause}
     ORDER BY p.${sortBy} ${sortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return buildPaginatedResponse(result.rows, totalItems, parseInt(page) || 1, parseInt(limit) || 20);
};

/**
 * Get product by ID
 * @param {number} product_id - Product ID
 * @returns {Object} Product details
 */
const getProductById = async (product_id) => {
  const result = await query(
    `SELECT p.product_id, p.name, p.description, p.price, p.cost_price, p.sale_type,
            p.stock_quantity, p.image_url, p.average_rating, p.reviews_count,
            p.category_id, c.name as category_name, p.created_at
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.category_id
     WHERE p.product_id = $1 AND p.is_active = true`,
    [product_id]
  );

  if (result.rows.length === 0) {
    throw new Error('Product not found');
  }

  return result.rows[0];
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
  const categoryResult = await query(
    'SELECT category_id FROM categories WHERE category_id = $1',
    [category_id]
  );

  if (categoryResult.rows.length === 0) {
    throw new Error('Category not found');
  }

  const result = await query(
    `INSERT INTO products (name, description, price, cost_price, sale_type, stock_quantity, category_id, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING product_id, name, description, price, cost_price, sale_type, stock_quantity, category_id, image_url, created_at`,
    [name, description || null, price, cost_price || 0, sale_type, stock_quantity || 0, category_id, image_url || null]
  );

  // Log initial stock if > 0
  if (stock_quantity && stock_quantity > 0) {
    await query(
      `INSERT INTO stock_transactions (product_id, quantity_change, reason)
       VALUES ($1, $2, 'admin_add')`,
      [result.rows[0].product_id, stock_quantity]
    );
  }

  return result.rows[0];
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
  const existingProduct = await query(
    'SELECT product_id FROM products WHERE product_id = $1',
    [product_id]
  );

  if (existingProduct.rows.length === 0) {
    throw new Error('Product not found');
  }

  // If category_id provided, verify it exists
  if (category_id) {
    const categoryResult = await query(
      'SELECT category_id FROM categories WHERE category_id = $1',
      [category_id]
    );

    if (categoryResult.rows.length === 0) {
      throw new Error('Category not found');
    }
  }

  const result = await query(
    `UPDATE products 
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         price = COALESCE($3, price),
         cost_price = COALESCE($4, cost_price),
         sale_type = COALESCE($5, sale_type),
         category_id = COALESCE($6, category_id),
         image_url = CASE WHEN $7::text IS NOT NULL THEN $7 ELSE image_url END
     WHERE product_id = $8
     RETURNING product_id, name, description, price, cost_price, sale_type, stock_quantity, category_id, image_url`,
    [name, description, price, cost_price, sale_type, category_id, image_url === undefined ? null : image_url, product_id]
  );

  return result.rows[0];
};

/**
 * Soft delete product (admin only)
 * @param {number} product_id - Product ID
 * @returns {Object} Deleted product info
 */
const deleteProduct = async (product_id) => {
  const result = await query(
    `UPDATE products 
     SET is_active = false
     WHERE product_id = $1 AND is_active = true
     RETURNING product_id, name`,
    [product_id]
  );

  if (result.rows.length === 0) {
    throw new Error('Product not found or already deleted');
  }

  return result.rows[0];
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
  const productResult = await query(
    'SELECT product_id, stock_quantity FROM products WHERE product_id = $1 AND is_active = true',
    [product_id]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found');
  }

  const currentStock = parseFloat(productResult.rows[0].stock_quantity);
  const newStock = currentStock + quantity_change;

  // Check if stock would go negative
  if (newStock < 0) {
    throw new Error(`Insufficient stock. Current: ${currentStock}, Attempted change: ${quantity_change}`);
  }

  // Update stock and log transaction
  await query('BEGIN');

  try {
    await query(
      'UPDATE products SET stock_quantity = $1 WHERE product_id = $2',
      [newStock, product_id]
    );

    await query(
      `INSERT INTO stock_transactions (product_id, quantity_change, reason)
       VALUES ($1, $2, $3)`,
      [product_id, quantity_change, reason]
    );

    await query('COMMIT');
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }

  return {
    product_id,
    previous_stock: currentStock,
    quantity_change,
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
  const { offset } = getPaginationParams({ page, limit });

  // Verify product exists
  const productResult = await query(
    'SELECT product_id, name FROM products WHERE product_id = $1',
    [product_id]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found');
  }

  // Get total count
  const countResult = await query(
    'SELECT COUNT(*) as total FROM stock_transactions WHERE product_id = $1',
    [product_id]
  );
  const totalItems = parseInt(countResult.rows[0].total);

  // Get paginated history
  const result = await query(
    `SELECT st.transaction_id, st.quantity_change, st.reason, st.related_order_id, st.created_at
     FROM stock_transactions st
     WHERE st.product_id = $1
     ORDER BY st.created_at DESC
     LIMIT $2 OFFSET $3`,
    [product_id, limit, offset]
  );

  return {
    product: productResult.rows[0],
    ...buildPaginatedResponse(result.rows, totalItems, parseInt(page) || 1, parseInt(limit) || 20)
  };
};

/**
 * Get all products for admin (including inactive)
 * @param {Object} options - Query options
 * @returns {Object} Paginated products list
 */
const getAllProductsAdmin = async (options) => {
  const { search, category_id, sale_type, is_active, sort, order, page, limit } = options;
  const { offset } = getPaginationParams({ page, limit });
  
  const allowedSortFields = ['name', 'price', 'stock_quantity', 'created_at'];
  const { sortBy, sortOrder } = getSortParams(
    { sort, order },
    'created_at',
    'DESC',
    allowedSortFields
  );

  let whereClause = 'WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  // Search filter
  if (search) {
    whereClause += ` AND (p.name ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Category filter
  if (category_id) {
    whereClause += ` AND p.category_id = $${paramIndex}`;
    params.push(category_id);
    paramIndex++;
  }

  // Sale type filter
  if (sale_type) {
    whereClause += ` AND p.sale_type = $${paramIndex}`;
    params.push(sale_type);
    paramIndex++;
  }

  // Active status filter
  if (is_active !== undefined) {
    whereClause += ` AND p.is_active = $${paramIndex}`;
    params.push(is_active === 'true');
    paramIndex++;
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM products p ${whereClause}`,
    params
  );
  const totalItems = parseInt(countResult.rows[0].total);

  // Get paginated products
  params.push(limit, offset);
  const result = await query(
    `SELECT p.product_id, p.name, p.price, p.cost_price, p.sale_type,
            p.stock_quantity, p.image_url, p.is_active, p.average_rating, p.reviews_count,
            p.category_id, c.name as category_name, p.created_at
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.category_id
     ${whereClause}
     ORDER BY p.${sortBy} ${sortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return buildPaginatedResponse(result.rows, totalItems, parseInt(page) || 1, parseInt(limit) || 20);
};

/**
 * Get product with category info
 * @param {number} product_id - Product ID
 * @returns {Object} Product with category
 */
const getProductWithCategory = async (product_id) => {
  const result = await query(
    `SELECT p.*, c.name as category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.category_id
     WHERE p.product_id = $1`,
    [product_id]
  );

  if (result.rows.length === 0) {
    throw new Error('Product not found');
  }

  return result.rows[0];
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
