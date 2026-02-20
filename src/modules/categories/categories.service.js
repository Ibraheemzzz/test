const { query } = require('../../config/db');

/**
 * Categories Service
 * Handles all category-related database operations
 */

/**
 * Get all categories as hierarchical tree
 * @returns {Array} Nested categories with children
 */
const getCategoryTree = async () => {
  // Get all categories
  const result = await query(
    `SELECT category_id, name, parent_id
     FROM categories
     ORDER BY name ASC`
  );

  // Build hierarchical tree
  const categories = result.rows;
  const categoryMap = {};
  const rootCategories = [];

  // First pass: create map and initialize children
  categories.forEach(cat => {
    categoryMap[cat.category_id] = {
      ...cat,
      children: []
    };
  });

  // Second pass: build tree structure
  categories.forEach(cat => {
    const node = categoryMap[cat.category_id];
    if (cat.parent_id === null) {
      rootCategories.push(node);
    } else if (categoryMap[cat.parent_id]) {
      categoryMap[cat.parent_id].children.push(node);
    }
  });

  return rootCategories;
};

/**
 * Get all categories as flat list
 * @returns {Array} Flat list of categories
 */
const getAllCategories = async () => {
  const result = await query(
    `SELECT c.category_id, c.name, c.parent_id,
            p.name as parent_name,
            (SELECT COUNT(*) FROM products WHERE category_id = c.category_id AND is_active = true) as product_count
     FROM categories c
     LEFT JOIN categories p ON c.parent_id = p.category_id
     ORDER BY c.name ASC`
  );

  return result.rows;
};

/**
 * Get category by ID
 * @param {number} category_id - Category ID
 * @returns {Object} Category details
 */
const getCategoryById = async (category_id) => {
  const result = await query(
    `SELECT c.category_id, c.name, c.parent_id,
            p.name as parent_name
     FROM categories c
     LEFT JOIN categories p ON c.parent_id = p.category_id
     WHERE c.category_id = $1`,
    [category_id]
  );

  if (result.rows.length === 0) {
    throw new Error('Category not found');
  }

  return result.rows[0];
};

/**
 * Create new category
 * @param {Object} categoryData - Category data
 * @returns {Object} Created category
 */
const createCategory = async (categoryData) => {
  const { name, parent_id } = categoryData;

  // Check if category with same name exists under same parent
  const existingCategory = await query(
    'SELECT category_id FROM categories WHERE name = $1 AND (parent_id = $2 OR (parent_id IS NULL AND $2 IS NULL))',
    [name, parent_id || null]
  );

  if (existingCategory.rows.length > 0) {
    throw new Error('Category with this name already exists at this level');
  }

  // If parent_id is provided, verify it exists
  if (parent_id) {
    const parentResult = await query(
      'SELECT category_id FROM categories WHERE category_id = $1',
      [parent_id]
    );

    if (parentResult.rows.length === 0) {
      throw new Error('Parent category not found');
    }
  }

  const result = await query(
    `INSERT INTO categories (name, parent_id)
     VALUES ($1, $2)
     RETURNING category_id, name, parent_id`,
    [name, parent_id || null]
  );

  return result.rows[0];
};

/**
 * Update category
 * @param {number} category_id - Category ID
 * @param {Object} updateData - Data to update
 * @returns {Object} Updated category
 */
const updateCategory = async (category_id, updateData) => {
  const { name, parent_id } = updateData;

  // Check if category exists
  const existingCategory = await query(
    'SELECT category_id, parent_id FROM categories WHERE category_id = $1',
    [category_id]
  );

  if (existingCategory.rows.length === 0) {
    throw new Error('Category not found');
  }

  // If setting parent_id, verify it's not creating a cycle
  if (parent_id !== undefined) {
    if (parent_id === category_id) {
      throw new Error('Category cannot be its own parent');
    }

    if (parent_id !== null) {
      // Check if the new parent is a descendant of this category
      const isDescendant = await checkIfDescendant(category_id, parent_id);
      if (isDescendant) {
        throw new Error('Cannot set a descendant category as parent');
      }

      // Verify parent exists
      const parentResult = await query(
        'SELECT category_id FROM categories WHERE category_id = $1',
        [parent_id]
      );

      if (parentResult.rows.length === 0) {
        throw new Error('Parent category not found');
      }
    }
  }

  // Check for duplicate name at same level
  if (name) {
    const duplicateCheck = await query(
      'SELECT category_id FROM categories WHERE name = $1 AND (parent_id = $2 OR (parent_id IS NULL AND $2 IS NULL)) AND category_id != $3',
      [name, parent_id !== undefined ? (parent_id || null) : existingCategory.rows[0].parent_id, category_id]
    );

    if (duplicateCheck.rows.length > 0) {
      throw new Error('Category with this name already exists at this level');
    }
  }

  const result = await query(
    `UPDATE categories 
     SET name = COALESCE($1, name),
         parent_id = CASE WHEN $2::int IS NOT NULL THEN $2 ELSE parent_id END
     WHERE category_id = $3
     RETURNING category_id, name, parent_id`,
    [name, parent_id !== undefined ? parent_id : null, category_id]
  );

  return result.rows[0];
};

/**
 * Delete category
 * @param {number} category_id - Category ID
 * @returns {Object} Deleted category info
 */
const deleteCategory = async (category_id) => {
  // Check if category has products
  const productsResult = await query(
    'SELECT COUNT(*) as count FROM products WHERE category_id = $1 AND is_active = true',
    [category_id]
  );

  if (parseInt(productsResult.rows[0].count) > 0) {
    throw new Error('Cannot delete category with active products');
  }

  // Check if category has children
  const childrenResult = await query(
    'SELECT COUNT(*) as count FROM categories WHERE parent_id = $1',
    [category_id]
  );

  if (parseInt(childrenResult.rows[0].count) > 0) {
    throw new Error('Cannot delete category with subcategories. Delete subcategories first.');
  }

  const result = await query(
    'DELETE FROM categories WHERE category_id = $1 RETURNING category_id, name',
    [category_id]
  );

  if (result.rows.length === 0) {
    throw new Error('Category not found');
  }

  return result.rows[0];
};

/**
 * Check if a category is a descendant of another
 * @param {number} ancestor_id - Potential ancestor ID
 * @param {number} descendant_id - Potential descendant ID
 * @returns {boolean} True if descendant
 */
const checkIfDescendant = async (ancestor_id, descendant_id) => {
  // Recursively check if descendant_id is under ancestor_id
  const result = await query(
    `WITH RECURSIVE category_tree AS (
      SELECT category_id, parent_id FROM categories WHERE category_id = $1
      UNION
      SELECT c.category_id, c.parent_id 
      FROM categories c
      INNER JOIN category_tree ct ON c.parent_id = ct.category_id
    )
    SELECT category_id FROM category_tree WHERE category_id = $2`,
    [ancestor_id, descendant_id]
  );

  return result.rows.length > 0;
};

/**
 * Get category path (breadcrumb)
 * @param {number} category_id - Category ID
 * @returns {Array} Path from root to category
 */
const getCategoryPath = async (category_id) => {
  const result = await query(
    `WITH RECURSIVE category_path AS (
      SELECT category_id, name, parent_id, 1 as depth
      FROM categories
      WHERE category_id = $1
      UNION ALL
      SELECT c.category_id, c.name, c.parent_id, cp.depth + 1
      FROM categories c
      INNER JOIN category_path cp ON c.category_id = cp.parent_id
    )
    SELECT category_id, name FROM category_path ORDER BY depth DESC`,
    [category_id]
  );

  return result.rows;
};

module.exports = {
  getCategoryTree,
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryPath
};
