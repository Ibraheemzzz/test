const { query } = require('../../config/db');

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
  let cartResult = await query(
    'SELECT cart_id, created_at, updated_at FROM carts WHERE user_id = $1',
    [user_id]
  );

  if (cartResult.rows.length > 0) {
    return cartResult.rows[0];
  }

  // Create new cart
  cartResult = await query(
    'INSERT INTO carts (user_id) VALUES ($1) RETURNING cart_id, created_at, updated_at',
    [user_id]
  );

  return cartResult.rows[0];
};

/**
 * Get cart with items and totals
 * @param {number} user_id - User ID
 * @returns {Object} Cart with items and calculated totals
 */
const getCart = async (user_id) => {
  const cart = await getOrCreateCart(user_id);

  // Get cart items with product details
  const itemsResult = await query(
    `SELECT ci.product_id, ci.quantity, 
            p.name, p.price, p.sale_type, p.stock_quantity, p.image_url,
            (ci.quantity * p.price) as subtotal
     FROM cart_items ci
     INNER JOIN products p ON ci.product_id = p.product_id
     WHERE ci.cart_id = $1 AND p.is_active = true`,
    [cart.cart_id]
  );

  const items = itemsResult.rows;
  
  // Calculate totals
  let total_items = 0;
  let total_price = 0;

  items.forEach(item => {
    total_items += parseFloat(item.quantity);
    total_price += parseFloat(item.subtotal);
  });

  return {
    cart_id: cart.cart_id,
    items,
    summary: {
      total_items,
      total_price: parseFloat(total_price.toFixed(2)),
      items_count: items.length
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
  const productResult = await query(
    'SELECT product_id, name, price, sale_type, stock_quantity FROM products WHERE product_id = $1 AND is_active = true',
    [product_id]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found or unavailable');
  }

  const product = productResult.rows[0];

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
  const existingItem = await query(
    'SELECT quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
    [cart.cart_id, product_id]
  );

  const currentQty = existingItem.rows.length > 0 ? parseFloat(existingItem.rows[0].quantity) : 0;
  const newQty = currentQty + parseFloat(quantity);

  // Validate stock
  if (newQty > parseFloat(product.stock_quantity)) {
    throw new Error(`Insufficient stock. Available: ${product.stock_quantity} ${product.sale_type}`);
  }

  if (existingItem.rows.length > 0) {
    // Update existing item
    await query(
      'UPDATE cart_items SET quantity = $1 WHERE cart_id = $2 AND product_id = $3',
      [newQty, cart.cart_id, product_id]
    );
  } else {
    // Insert new item
    await query(
      'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)',
      [cart.cart_id, product_id, quantity]
    );
  }

  return {
    product_id,
    name: product.name,
    quantity: newQty,
    price: product.price,
    sale_type: product.sale_type,
    subtotal: parseFloat((newQty * product.price).toFixed(2))
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
  const cartResult = await query(
    'SELECT cart_id FROM carts WHERE user_id = $1',
    [user_id]
  );

  if (cartResult.rows.length === 0) {
    throw new Error('Cart not found');
  }

  const cart = cartResult.rows[0];

  // Check if item exists in cart
  const itemResult = await query(
    `SELECT ci.quantity, p.name, p.price, p.sale_type, p.stock_quantity
     FROM cart_items ci
     INNER JOIN products p ON ci.product_id = p.product_id
     WHERE ci.cart_id = $1 AND ci.product_id = $2`,
    [cart.cart_id, product_id]
  );

  if (itemResult.rows.length === 0) {
    throw new Error('Item not found in cart');
  }

  const item = itemResult.rows[0];

  // If quantity is 0 or less, remove item
  if (quantity <= 0) {
    await query(
      'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2',
      [cart.cart_id, product_id]
    );

    return {
      product_id,
      removed: true,
      message: 'Item removed from cart'
    };
  }

  // Validate stock
  if (quantity > parseFloat(item.stock_quantity)) {
    throw new Error(`Insufficient stock. Available: ${item.stock_quantity} ${item.sale_type}`);
  }

  // Update quantity
  await query(
    'UPDATE cart_items SET quantity = $1 WHERE cart_id = $2 AND product_id = $3',
    [quantity, cart.cart_id, product_id]
  );

  return {
    product_id,
    name: item.name,
    quantity,
    price: item.price,
    sale_type: item.sale_type,
    subtotal: parseFloat((quantity * item.price).toFixed(2))
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
  const cartResult = await query(
    'SELECT cart_id FROM carts WHERE user_id = $1',
    [user_id]
  );

  if (cartResult.rows.length === 0) {
    throw new Error('Cart not found');
  }

  const cart = cartResult.rows[0];

  // Delete item
  const deleteResult = await query(
    'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2 RETURNING product_id',
    [cart.cart_id, product_id]
  );

  if (deleteResult.rows.length === 0) {
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
  const cartResult = await query(
    'SELECT cart_id FROM carts WHERE user_id = $1',
    [user_id]
  );

  if (cartResult.rows.length === 0) {
    throw new Error('Cart not found');
  }

  const cart = cartResult.rows[0];

  // Clear all items
  await query(
    'DELETE FROM cart_items WHERE cart_id = $1',
    [cart.cart_id]
  );

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
