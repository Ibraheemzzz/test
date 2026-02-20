# Shalabi Market E-Commerce API

A complete REST API for a local supermarket e-commerce platform, built with Node.js, Express.js, and PostgreSQL.

## Features

- **Authentication**: JWT-based authentication for users and guests
- **User Management**: Profile management and admin user controls
- **Categories**: Hierarchical category structure with CRUD operations
- **Products**: Full product management with image upload and stock tracking
- **Cart**: Shopping cart with stock validation
- **Orders**: Complete order processing with transaction safety
- **Reviews**: Product reviews with automatic rating calculation
- **Wishlist**: Product wishlist management
- **Reports**: Admin dashboard with sales, profit, and inventory reports

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **File Upload**: Multer (local storage)
- **DB Driver**: pg (node-postgres) - raw SQL

## Installation

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)

### Setup

1. Clone the repository
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create PostgreSQL database:
   ```sql
   CREATE DATABASE shalabi_market;
   ```

5. Run the database schema:
   ```bash
   psql -U postgres -d shalabi_market -f database_schema.sql
   ```

   **For existing databases**, run the migration:
   ```bash
   psql -U postgres -d shalabi_market -f migrations/001_add_cancellation_reason.sql
   ```

6. Copy environment file and configure:
   ```bash
   cp .env.example .env
   ```

7. Update `.env` with your database credentials and JWT secret

8. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user (protected) |
| POST | `/api/auth/guest` | Create guest session |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/profile` | Get user profile (protected) |
| PUT | `/api/users/profile` | Update profile (protected) |
| GET | `/api/admin/users` | Get all users (admin) |
| PUT | `/api/admin/users/:id/status` | Toggle user status (admin) |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | Get category tree |
| GET | `/api/categories/list` | Get flat category list |
| GET | `/api/categories/:id` | Get category by ID |
| POST | `/api/admin/categories` | Create category (admin) |
| PUT | `/api/admin/categories/:id` | Update category (admin) |
| DELETE | `/api/admin/categories/:id` | Delete category (admin) |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | Get products with filters |
| GET | `/api/products/:id` | Get product by ID |
| POST | `/api/admin/products` | Create product (admin) |
| PUT | `/api/admin/products/:id` | Update product (admin) |
| DELETE | `/api/admin/products/:id` | Soft delete product (admin) |
| POST | `/api/admin/products/:id/stock` | Adjust stock (admin) |
| GET | `/api/admin/products/:id/stock-history` | Stock history (admin) |

### Cart
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cart` | Get cart (protected) |
| POST | `/api/cart/items` | Add item to cart |
| PUT | `/api/cart/items/:productId` | Update item quantity |
| DELETE | `/api/cart/items/:productId` | Remove item |
| DELETE | `/api/cart` | Clear cart |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Place order |
| GET | `/api/orders` | Get user orders |
| GET | `/api/orders/:id` | Get order by ID |
| PUT | `/api/orders/:id/cancel` | Cancel order |
| GET | `/api/admin/orders/all` | Get all orders (admin) |
| PUT | `/api/admin/orders/:id/status` | Change status (admin) |
| GET | `/api/admin/orders/:id/history` | Status history (admin) |

### Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/products/:productId/reviews` | Create review |
| GET | `/api/products/:productId/reviews` | Get product reviews |
| PUT | `/api/reviews/:id` | Update review |
| DELETE | `/api/reviews/:id` | Delete review |
| GET | `/api/admin/reviews` | All reviews (admin) |
| PUT | `/api/admin/reviews/:id/hide` | Toggle visibility (admin) |

### Wishlist
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wishlist` | Get wishlist |
| GET | `/api/wishlist/:productId` | Check wishlist status |
| POST | `/api/wishlist/:productId` | Add to wishlist |
| DELETE | `/api/wishlist/:productId` | Remove from wishlist |

### Reports (Admin Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/reports/dashboard-summary` | Dashboard stats |
| GET | `/api/admin/reports/sales` | Sales report |
| GET | `/api/admin/reports/top-products` | Top products |
| GET | `/api/admin/reports/low-stock` | Low stock products |
| GET | `/api/admin/reports/profit` | Profit report |

## Response Format

All endpoints return a consistent JSON structure:

**Success:**
```json
{
  "success": true,
  "message": "Human readable message",
  "data": {}
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description",
  "data": null
}
```

**Validation Error:**
```json
{
  "success": false,
  "message": "Validation failed",
  "data": {
    "errors": [
      { "field": "phone_number", "message": "Phone number is required" },
      { "field": "password", "message": "Password must be at least 6 characters" }
    ]
  }
}
```

## Input Validation

All endpoints use `express-validator` for input validation. Validation rules are defined in each module's `*.validators.js` file.

**Validation is applied to:**

| Module | Endpoints | Validation Rules |
|--------|-----------|------------------|
| Auth | `POST /register` | phone_number (required, 10-20 chars), name (required), password (min 6 chars) |
| Auth | `POST /login` | phone_number (required), password (required) |
| Auth | `POST /guest` | phone_number (required, 10-20 chars) |
| Products | `POST /admin/products` | name, price (positive), sale_type (kg/piece), category_id |
| Products | `PUT /admin/products/:id` | Same rules, all optional |
| Categories | `POST /admin/categories` | name (required) |
| Cart | `POST /cart/items` | product_id (required), quantity (> 0) |
| Cart | `PUT /cart/items/:productId` | quantity (>= 0) |
| Orders | `POST /api/orders` | items array, shipping fields required |
| Orders | `PUT /admin/orders/:id/status` | status (Shipped/Delivered/Cancelled) |
| Reviews | `POST /products/:productId/reviews` | rating (1-5, steps of 0.5) |

**Service-level validation** is also applied for critical fields:
- `sale_type` must be "kg" or "piece" (validated in products.service.js)
- `rating` must be 1-5 in steps of 0.5 (validated in reviews.service.js)

## Authentication

Protected routes require the `Authorization` header:
```
Authorization: Bearer <token>
```

## Business Rules

### Order Placement
Order placement runs in a single database transaction:
1. Validate stock for all items
2. Create order record
3. Insert order_items with current prices
4. Decrease product stock
5. Log stock transactions
6. Create payment record
7. Log status history
8. Clear user cart
9. Full rollback on any failure

### Stock Management
- Stock cannot go below zero
- All changes logged in stock_transactions
- Reasons: "purchase", "admin_add", "admin_remove", "cancellation"

### Order Status Transitions
```
Created ──► Shipped ──► Delivered
   │           │
   ▼           ▼
Cancelled   Cancelled (admin only)
```

**Status transition rules:**
- `Created` → `Shipped` or `Cancelled`
- `Shipped` → `Delivered` or `Cancelled` (admin only)
- `Delivered` → (no further transitions)
- `Cancelled` → (no further transitions)

**Important:** Admin cannot set status back to `Created`.

### Profit Calculation
```
profit = (price_at_purchase - cost_price_at_purchase) × quantity
```
Values are stored in order_items and never recalculated.

## Project Structure

```
src/
├── config/
│   ├── db.js           ← PostgreSQL connection
│   └── multer.js       ← File upload config
├── middlewares/
│   ├── auth.middleware.js    ← JWT verification
│   └── validate.middleware.js ← Input validation
├── utils/
│   ├── response.js     ← Unified API response
│   └── pagination.js   ← Pagination helper
└── modules/
    ├── auth/
    ├── users/
    ├── categories/
    ├── products/
    ├── cart/
    ├── orders/
    ├── reviews/
    ├── wishlist/
    └── reports/
```

Each module contains:
- `module.service.js` - Database queries & business logic
- `module.controller.js` - HTTP request handling
- `module.routes.js` - Route definitions
- `module.validators.js` - Input validation rules

## Development

```bash
# Run in development mode
npm run dev

# Run in production mode
npm start
```

## License

MIT
