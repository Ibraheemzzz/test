const prisma = require('../../config/prisma');

/**
 * Cart Service
 * Handles all cart-related database operations
 * Note: Guests do not have a cart in the database - guest cart lives in the browser
 */

/**
 * Get or create cart for user
 * @param {number} user_id - User ID
 * @returns {Object} Cart info
 */
const getOrCreateCart = async (user_id) => {
  // Try to get existing cart
  let cart = await prisma.cart.findUnique({
    where: { user_id },
    select: {
      cart_id: true,
      created_at: true,
      updated_at: true
    }
  });

  if (cart) {
    return cart;
  }

  // Create new cart
  cart = await prisma.cart.create({
    data: { user_id },
    select: {
      cart_id: true,
      created_at: true,
      updated_at: true
    }
  });

  return cart;
};

/**
 * Get cart with items and totals
 * @param {number} user_id - User ID
 * @returns {Object} Cart with items and calculated totals
 */
const getCart = async (user_id) => {
  const cart = await getOrCreateCart(user_id);

  // Get cart items with product details
  const items = await prisma.cartItem.findMany({
    where: { cart_id: cart.cart_id },
    select: {
      product_id: true,
      quantity: true,
      product: {
        select: {
          name: true,
          price: true,
          sale_type: true,
          stock_quantity: true,
          image_url: true,
          is_active: true
        }
      }
    }
  });

  // Filter out inactive products and calculate totals
  const activeItems = items.filter(item => item.product.is_active);
  
  let total_items = 0;
  let total_price = 0;

  const formattedItems = activeItems.map(item => {
    const quantity = parseFloat(item.quantity);
    const price = parseFloat(item.product.price);
    const subtotal = quantity * price;

    total_items += quantity;
    total_price += subtotal;

    return {
      product_id: item.product_id,
      quantity,
      name: item.product.name,
      price,
      sale_type: item.product.sale_type,
      stock_quantity: parseFloat(item.product.stock_quantity),
      image_url: item.product.image_url,
      subtotal: parseFloat(subtotal.toFixed(2))
    };
  });

  return {
    cart_id: cart.cart_id,
    items: formattedItems,
    summary: {
      total_items: parseFloat(total_items.toFixed(3)),
      total_price: parseFloat(total_price.toFixed(2)),
      items_count: formattedItems.length
    },
    updated_at: cart.updated_at
  };
};

/**
 * Add item to cart
 * @param {number} user_id - User ID
 * @param {Object} itemData - Item data
 * @returns {Object} Added item
 */
const addToCart = async (user_id, itemData) => {
  const { product_id, quantity } = itemData;

  // Verify product exists and is active
  const product = await prisma.product.findFirst({
    where: { product_id, is_active: true },
    select: {
      product_id: true,
      name: true,
      price: true,
      sale_type: true,
      stock_quantity: true
    }
  });

  if (!product) {
    throw new Error('Product not found or unavailable');
  }

  // Validate quantity
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }

  // Validate quantity precision for kg
  if (product.sale_type === 'kg' && quantity > 1000) {
    throw new Error('Maximum quantity for weight-based products is 1000 kg');
  }

  // Get or create cart
  const cart = await getOrCreateCart(user_id);

  // Check existing item quantity
  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cart_id_product_id: {
        cart_id: cart.cart_id,
        product_id
      }
    },
    select: { quantity: true }
  });

  const currentQty = existingItem ? parseFloat(existingItem.quantity) : 0;
  const newQty = currentQty + parseFloat(quantity);

  // Validate stock
  if (newQty > parseFloat(product.stock_quantity)) {
    throw new Error(`Insufficient stock. Available: ${product.stock_quantity} ${product.sale_type}`);
  }

  if (existingItem) {
    // Update existing item
    await prisma.cartItem.update({
      where: {
        cart_id_product_id: {
          cart_id: cart.cart_id,
          product_id
        }
      },
      data: { quantity: newQty }
    });
  } else {
    // Insert new item
    await prisma.cartItem.create({
      data: {
        cart_id: cart.cart_id,
        product_id,
        quantity
      }
    });
  }

  return {
    product_id,
    name: product.name,
    quantity: newQty,
    price: parseFloat(product.price),
    sale_type: product.sale_type,
    subtotal: parseFloat((newQty * parseFloat(product.price)).toFixed(2))
  };
};

/**
 * Update cart item quantity
 * @param {number} user_id - User ID
 * @param {number} product_id - Product ID
 * @param {number} quantity - New quantity
 * @returns {Object} Updated item
 */
const updateCartItem = async (user_id, product_id, quantity) => {
  // Get cart
  const cart = await prisma.cart.findUnique({
    where: { user_id },
    select: { cart_id: true }
  });

  if (!cart) {
    throw new Error('Cart not found');
  }

  // Check if item exists in cart
  const item = await prisma.cartItem.findUnique({
    where: {
      cart_id_product_id: {
        cart_id: cart.cart_id,
        product_id
      }
    },
    select: {
      quantity: true,
      product: {
        select: {
          name: true,
          price: true,
          sale_type: true,
          stock_quantity: true
        }
      }
    }
  });

  if (!item) {
    throw new Error('Item not found in cart');
  }

  // If quantity is 0 or less, remove item
  if (quantity <= 0) {
    await prisma.cartItem.delete({
      where: {
        cart_id_product_id: {
          cart_id: cart.cart_id,
          product_id
        }
      }
    });

    return {
      product_id,
      removed: true,
      message: 'Item removed from cart'
    };
  }

  // Validate stock
  if (quantity > parseFloat(item.product.stock_quantity)) {
    throw new Error(`Insufficient stock. Available: ${item.product.stock_quantity} ${item.product.sale_type}`);
  }

  // Update quantity
  await prisma.cartItem.update({
    where: {
      cart_id_product_id: {
        cart_id: cart.cart_id,
        product_id
      }
    },
    data: { quantity }
  });

  return {
    product_id,
    name: item.product.name,
    quantity,
    price: parseFloat(item.product.price),
    sale_type: item.product.sale_type,
    subtotal: parseFloat((quantity * parseFloat(item.product.price)).toFixed(2))
  };
};

/**
 * Remove item from cart
 * @param {number} user_id - User ID
 * @param {number} product_id - Product ID
 * @returns {Object} Removed item info
 */
const removeFromCart = async (user_id, product_id) => {
  // Get cart
  const cart = await prisma.cart.findUnique({
    where: { user_id },
    select: { cart_id: true }
  });

  if (!cart) {
    throw new Error('Cart not found');
  }

  // Delete item
  const deletedItem = await prisma.cartItem.delete({
    where: {
      cart_id_product_id: {
        cart_id: cart.cart_id,
        product_id
      }
    },
    select: { product_id: true }
  }).catch(() => null);

  if (!deletedItem) {
    throw new Error('Item not found in cart');
  }

  return {
    product_id,
    removed: true
  };
};

/**
 * Clear all items from cart
 * @param {number} user_id - User ID
 * @returns {Object} Success info
 */
const clearCart = async (user_id) => {
  // Get cart
  const cart = await prisma.cart.findUnique({
    where: { user_id },
    select: { cart_id: true }
  });

  if (!cart) {
    throw new Error('Cart not found');
  }

  // Clear all items
  await prisma.cartItem.deleteMany({
    where: { cart_id: cart.cart_id }
  });

  return {
    cleared: true
  };
};

/**
 * Validate cart items against stock
 * @param {number} user_id - User ID
 * @returns {Object} Validation result
 */
const validateCart = async (user_id) => {
  const cart = await getCart(user_id);
  const invalidItems = [];

  cart.items.forEach(item => {
    if (item.quantity > item.stock_quantity) {
      invalidItems.push({
        product_id: item.product_id,
        name: item.name,
        requested: item.quantity,
        available: item.stock_quantity
      });
    }
  });

  return {
    valid: invalidItems.length === 0,
    invalid_items: invalidItems
  };
};

module.exports = {
  getOrCreateCart,
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  validateCart
};
