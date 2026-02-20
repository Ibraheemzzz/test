const prisma = require('../../config/prisma');

/**
 * Wishlist Service
 * Handles all wishlist-related database operations
 */

/**
 * Get user's wishlist
 * @param {number} user_id - User ID
 * @returns {Array} Wishlist items
 */
const getWishlist = async (user_id) => {
  const items = await prisma.wishlist.findMany({
    where: { user_id },
    select: {
      product_id: true,
      created_at: true,
      product: {
        select: {
          name: true,
          price: true,
          sale_type: true,
          stock_quantity: true,
          image_url: true,
          average_rating: true,
          reviews_count: true,
          is_active: true,
          category: {
            select: { name: true }
          }
        }
      }
    },
    orderBy: { created_at: 'desc' }
  });

  // Filter out inactive products
  return items
    .filter(item => item.product.is_active)
    .map(item => ({
      product_id: item.product_id,
      created_at: item.created_at,
      name: item.product.name,
      price: parseFloat(item.product.price),
      sale_type: item.product.sale_type,
      stock_quantity: parseFloat(item.product.stock_quantity),
      image_url: item.product.image_url,
      average_rating: parseFloat(item.product.average_rating),
      reviews_count: item.product.reviews_count,
      category_name: item.product.category?.name || null
    }));
};

/**
 * Check if product is in wishlist
 * @param {number} user_id - User ID
 * @param {number} product_id - Product ID
 * @returns {Object} Wishlist status
 */
const checkWishlist = async (user_id, product_id) => {
  const item = await prisma.wishlist.findUnique({
    where: {
      user_id_product_id: {
        user_id,
        product_id
      }
    },
    select: { product_id: true, created_at: true }
  });

  return item;
};

/**
 * Add product to wishlist
 * @param {number} user_id - User ID
 * @param {number} product_id - Product ID
 * @returns {Object} Added item
 */
const addToWishlist = async (user_id, product_id) => {
  // Verify product exists and is active
  const product = await prisma.product.findFirst({
    where: { product_id, is_active: true },
    select: { product_id: true, name: true }
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // Check if already in wishlist
  const existingItem = await prisma.wishlist.findUnique({
    where: {
      user_id_product_id: {
        user_id,
        product_id
      }
    },
    select: { product_id: true }
  });

  if (existingItem) {
    throw new Error('Product already in wishlist');
  }

  // Add to wishlist
  await prisma.wishlist.create({
    data: { user_id, product_id }
  });

  return {
    product_id,
    name: product.name,
    added: true
  };
};

/**
 * Remove product from wishlist
 * @param {number} user_id - User ID
 * @param {number} product_id - Product ID
 * @returns {Object} Removed item info
 */
const removeFromWishlist = async (user_id, product_id) => {
  const deleted = await prisma.wishlist.delete({
    where: {
      user_id_product_id: {
        user_id,
        product_id
      }
    },
    select: { product_id: true }
  }).catch(() => null);

  if (!deleted) {
    throw new Error('Product not found in wishlist');
  }

  return {
    product_id,
    removed: true
  };
};

/**
 * Toggle product in wishlist
 * @param {number} user_id - User ID
 * @param {number} product_id - Product ID
 * @returns {Object} Toggle result
 */
const toggleWishlist = async (user_id, product_id) => {
  // Verify product exists
  const product = await prisma.product.findFirst({
    where: { product_id, is_active: true },
    select: { product_id: true }
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // Check if in wishlist
  const existingItem = await prisma.wishlist.findUnique({
    where: {
      user_id_product_id: {
        user_id,
        product_id
      }
    },
    select: { product_id: true }
  });

  if (existingItem) {
    // Remove from wishlist
    await prisma.wishlist.delete({
      where: {
        user_id_product_id: {
          user_id,
          product_id
        }
      }
    });

    return {
      product_id,
      in_wishlist: false,
      message: 'Removed from wishlist'
    };
  } else {
    // Add to wishlist
    await prisma.wishlist.create({
      data: { user_id, product_id }
    });

    return {
      product_id,
      in_wishlist: true,
      message: 'Added to wishlist'
    };
  }
};

/**
 * Clear entire wishlist
 * @param {number} user_id - User ID
 * @returns {Object} Clear result
 */
const clearWishlist = async (user_id) => {
  const result = await prisma.wishlist.deleteMany({
    where: { user_id }
  });

  return {
    cleared: true,
    count: result.count
  };
};

/**
 * Get wishlist count
 * @param {number} user_id - User ID
 * @returns {Object} Count
 */
const getWishlistCount = async (user_id) => {
  const count = await prisma.wishlist.count({
    where: { user_id }
  });

  return { count };
};

module.exports = {
  getWishlist,
  checkWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  clearWishlist,
  getWishlistCount
};
