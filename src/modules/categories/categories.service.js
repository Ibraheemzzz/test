const prisma = require('../../config/prisma');

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
  const categories = await prisma.category.findMany({
    select: {
      category_id: true,
      name: true,
      parent_id: true
    },
    orderBy: { name: 'asc' }
  });

  // Build hierarchical tree
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
  const categories = await prisma.$queryRaw`
    SELECT c.category_id, c.name, c.parent_id,
           p.name as parent_name,
           (SELECT COUNT(*)::int FROM products WHERE category_id = c.category_id AND is_active = true) as product_count
    FROM categories c
    LEFT JOIN categories p ON c.parent_id = p.category_id
    ORDER BY c.name ASC
  `;

  return categories;
};

/**
 * Get category by ID
 * @param {number} category_id - Category ID
 * @returns {Object} Category details
 */
const getCategoryById = async (category_id) => {
  const category = await prisma.$queryRaw`
    SELECT c.category_id, c.name, c.parent_id,
           p.name as parent_name
    FROM categories c
    LEFT JOIN categories p ON c.parent_id = p.category_id
    WHERE c.category_id = ${category_id}
  `;

  if (!category || category.length === 0) {
    throw new Error('Category not found');
  }

  return category[0];
};

/**
 * Create new category
 * @param {Object} categoryData - Category data
 * @returns {Object} Created category
 */
const createCategory = async (categoryData) => {
  const { name, parent_id } = categoryData;

  // Check if category with same name exists under same parent
  const existingCategory = await prisma.category.findFirst({
    where: {
      name,
      parent_id: parent_id || null
    }
  });

  if (existingCategory) {
    throw new Error('Category with this name already exists at this level');
  }

  // If parent_id is provided, verify it exists
  if (parent_id) {
    const parent = await prisma.category.findUnique({
      where: { category_id: parent_id }
    });

    if (!parent) {
      throw new Error('Parent category not found');
    }
  }

  const category = await prisma.category.create({
    data: {
      name,
      parent_id: parent_id || null
    },
    select: {
      category_id: true,
      name: true,
      parent_id: true
    }
  });

  return category;
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
  const existingCategory = await prisma.category.findUnique({
    where: { category_id }
  });

  if (!existingCategory) {
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
      const parent = await prisma.category.findUnique({
        where: { category_id: parent_id }
      });

      if (!parent) {
        throw new Error('Parent category not found');
      }
    }
  }

  // Check for duplicate name at same level
  if (name) {
    const effectiveParentId = parent_id !== undefined ? (parent_id || null) : existingCategory.parent_id;
    const duplicateCheck = await prisma.category.findFirst({
      where: {
        name,
        parent_id: effectiveParentId,
        NOT: { category_id }
      }
    });

    if (duplicateCheck) {
      throw new Error('Category with this name already exists at this level');
    }
  }

  const updatePayload = {};
  if (name) updatePayload.name = name;
  if (parent_id !== undefined) updatePayload.parent_id = parent_id;

  const category = await prisma.category.update({
    where: { category_id },
    data: updatePayload,
    select: {
      category_id: true,
      name: true,
      parent_id: true
    }
  });

  return category;
};

/**
 * Delete category
 * @param {number} category_id - Category ID
 * @returns {Object} Deleted category info
 */
const deleteCategory = async (category_id) => {
  // Check if category has products
  const productsCount = await prisma.product.count({
    where: {
      category_id,
      is_active: true
    }
  });

  if (productsCount > 0) {
    throw new Error('Cannot delete category with active products');
  }

  // Check if category has children
  const childrenCount = await prisma.category.count({
    where: { parent_id: category_id }
  });

  if (childrenCount > 0) {
    throw new Error('Cannot delete category with subcategories. Delete subcategories first.');
  }

  const category = await prisma.category.delete({
    where: { category_id },
    select: {
      category_id: true,
      name: true
    }
  });

  return category;
};

/**
 * Check if a category is a descendant of another
 * @param {number} ancestor_id - Potential ancestor ID
 * @param {number} descendant_id - Potential descendant ID
 * @returns {boolean} True if descendant
 */
const checkIfDescendant = async (ancestor_id, descendant_id) => {
  const result = await prisma.$queryRaw`
    WITH RECURSIVE category_tree AS (
      SELECT category_id FROM categories WHERE category_id = ${ancestor_id}
      UNION
      SELECT c.category_id 
      FROM categories c
      INNER JOIN category_tree ct ON c.parent_id = ct.category_id
    )
    SELECT category_id FROM category_tree WHERE category_id = ${descendant_id}
  `;

  return result.length > 0;
};

/**
 * Get category path (breadcrumb)
 * @param {number} category_id - Category ID
 * @returns {Array} Path from root to category
 */
const getCategoryPath = async (category_id) => {
  const result = await prisma.$queryRaw`
    WITH RECURSIVE category_path AS (
      SELECT category_id, name, parent_id, 1 as depth
      FROM categories
      WHERE category_id = ${category_id}
      UNION ALL
      SELECT c.category_id, c.name, c.parent_id, cp.depth + 1
      FROM categories c
      INNER JOIN category_path cp ON c.category_id = cp.parent_id
    )
    SELECT category_id, name FROM category_path ORDER BY depth DESC
  `;

  return result;
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
