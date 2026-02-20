-- =========================================
-- EXTENSIONS
-- =========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================
-- USERS
-- =========================================
CREATE TABLE users (
  user_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(100),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  role VARCHAR(20) NOT NULL DEFAULT 'Customer',
  points INT DEFAULT 0 CHECK (points >= 0),
  daily_streak INT DEFAULT 0 CHECK (daily_streak >= 0),
  last_login_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT role_check CHECK (role IN ('Admin', 'Customer'))
);

-- =========================================
-- OTP CODES
-- =========================================
CREATE TABLE otp_codes (
  otp_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT otp_not_expired CHECK (expires_at > created_at)
);

CREATE INDEX idx_otp_phone ON otp_codes(phone_number);

-- =========================================
-- GUESTS
-- =========================================
CREATE TABLE guests (
  guest_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_guests_phone ON guests(phone_number);

-- =========================================
-- CATEGORIES
-- =========================================
CREATE TABLE categories (
  category_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id INT,
  FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX unique_category_per_parent
ON categories(name, parent_id);

-- =========================================
-- PRODUCTS
-- =========================================
CREATE TABLE products (
  product_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sale_type VARCHAR(10) NOT NULL,
  stock_quantity NUMERIC(12,3) NOT NULL CHECK (stock_quantity >= 0),
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  average_rating NUMERIC(3,2) DEFAULT 0 CHECK (average_rating >= 0 AND average_rating <= 5),
  reviews_count INT DEFAULT 0 CHECK (reviews_count >= 0),
  category_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT sale_type_check CHECK (sale_type IN ('kg', 'piece')),
  FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE
);

CREATE INDEX idx_products_category ON products(category_id);

-- =========================================
-- STOCK TRANSACTIONS
-- =========================================
CREATE TABLE stock_transactions (
  transaction_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id INT NOT NULL,
  quantity_change NUMERIC(12,3) NOT NULL,
  reason VARCHAR(50) NOT NULL,
  related_order_id INT,
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT stock_reason_check CHECK (reason IN ('purchase', 'admin_add', 'admin_remove', 'cancellation')),
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- =========================================
-- CART
-- =========================================
CREATE TABLE carts (
  cart_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE cart_items (
  cart_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),

  PRIMARY KEY (cart_id, product_id),
  FOREIGN KEY (cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- =========================================
-- COUPONS
-- =========================================
CREATE TABLE coupons (
  coupon_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL,
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value >= 0),
  min_order_amount NUMERIC(12,2) DEFAULT 0 CHECK (min_order_amount >= 0),
  points_cost INT DEFAULT 0 CHECK (points_cost >= 0),
  max_total_quantity INT CHECK (max_total_quantity > 0),
  used_count INT DEFAULT 0 CHECK (used_count >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT discount_type_check CHECK (discount_type IN ('percentage', 'fixed')),
  CONSTRAINT date_check CHECK (valid_until >= valid_from)
);

-- =========================================
-- USER COUPONS
-- =========================================
CREATE TABLE user_coupons (
  user_coupon_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL,
  coupon_id INT NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (coupon_id) REFERENCES coupons(coupon_id) ON DELETE CASCADE
);

CREATE INDEX idx_user_coupon_unused
ON user_coupons(user_id, coupon_id)
WHERE is_used = FALSE;

-- =========================================
-- ORDERS
-- =========================================
CREATE TABLE orders (
  order_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT,
  guest_id INT,
  status VARCHAR(20) NOT NULL DEFAULT 'Created',
  total_products_price NUMERIC(12,2) NOT NULL CHECK (total_products_price >= 0),
  shipping_fees NUMERIC(12,2) DEFAULT 0 CHECK (shipping_fees >= 0),
  discount_amount NUMERIC(12,2) DEFAULT 0 CHECK (discount_amount >= 0),
  final_total NUMERIC(12,2) NOT NULL CHECK (final_total >= 0),
  user_coupon_id INT,
  shipping_city VARCHAR(100),
  shipping_street VARCHAR(255),
  shipping_building VARCHAR(100),
  shipping_phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT now(),
  delivered_at TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (guest_id) REFERENCES guests(guest_id),
  FOREIGN KEY (user_coupon_id) REFERENCES user_coupons(user_coupon_id),

  CONSTRAINT order_status_check CHECK (status IN ('Created','Shipped','Delivered','Cancelled')),
  CONSTRAINT check_user_or_guest CHECK (
    (user_id IS NOT NULL AND guest_id IS NULL)
    OR
    (user_id IS NULL AND guest_id IS NOT NULL)
  )
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- =========================================
-- ORDER STATUS HISTORY
-- =========================================
CREATE TABLE order_status_history (
  history_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id INT NOT NULL,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- =========================================
-- ORDER ITEMS
-- =========================================
CREATE TABLE order_items (
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  price_at_purchase NUMERIC(12,2) NOT NULL CHECK (price_at_purchase >= 0),
  cost_price_at_purchase NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost_price_at_purchase >= 0),

  PRIMARY KEY (order_id, product_id),
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE INDEX idx_order_items_product ON order_items(product_id);

-- =========================================
-- PAYMENTS
-- =========================================
CREATE TABLE payments (
  payment_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id INT NOT NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cash_on_delivery',
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  transaction_reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT payment_status_check CHECK (status IN ('Pending','Completed','Failed','Refunded'))
);

-- =========================================
-- REVIEWS
-- =========================================
CREATE TABLE product_reviews (
  review_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  rating NUMERIC(2,1) NOT NULL,
  comment TEXT,
  is_approved BOOLEAN DEFAULT TRUE,
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,

  CONSTRAINT rating_check CHECK (
    rating >= 1 AND rating <= 5
    AND rating * 2 = FLOOR(rating * 2)
  )
);

CREATE UNIQUE INDEX unique_user_product_review
ON product_reviews(user_id, product_id);

-- =========================================
-- WISHLIST
-- =========================================
CREATE TABLE wishlist (
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),

  PRIMARY KEY (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- =========================================
-- POINTS TRANSACTIONS
-- =========================================
CREATE TABLE points_transactions (
  transaction_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL,
  points INT NOT NULL,
  reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- =========================================
-- TRIGGERS FOR updated_at
-- =========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cart_updated_at
BEFORE UPDATE ON carts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_review_updated_at
BEFORE UPDATE ON product_reviews
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();