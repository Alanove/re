---
name: E-commerce Platform Implementation
overview: Build a complete e-commerce platform with separate admin and public interfaces, including product management, shopping cart, checkout, order management, discounts, customer accounts with OAuth, and payment integration (NetCommerce API + Cash on Delivery).
todos:
  - id: db-schema
    content: Create comprehensive database schema migration script for all e-commerce tables (products, categories, variants, orders, discounts, etc.)
    status: completed
  - id: core-services
    content: "Implement core service layer: productService, categoryService, cartService, orderService, discountService, shippingService, paymentService"
    status: completed
    dependencies:
      - db-schema
  - id: public-product-catalog
    content: "Build public product catalog: product listing, search, filtering, product detail page with variants, images, reviews"
    status: completed
    dependencies:
      - core-services
  - id: shopping-cart
    content: Implement shopping cart functionality with session persistence and customer sync
    status: completed
    dependencies:
      - core-services
  - id: checkout-process
    content: Build multi-step checkout process with guest/member options, shipping, discounts, and payment selection
    status: completed
    dependencies:
      - shopping-cart
  - id: customer-accounts
    content: Create customer account system with registration, login, profile, order history, addresses, wishlist
    status: completed
    dependencies:
      - core-services
  - id: oauth-integration
    content: Implement OAuth login for Google, Office 365, and Facebook (for both customers and admin)
    status: completed
    dependencies:
      - customer-accounts
  - id: admin-product-management
    content: "Build admin product management: CRUD, featured flag, bulk import/export, variant management, image upload, inventory tracking"
    status: completed
    dependencies:
      - core-services
  - id: admin-order-management
    content: "Create admin order management: order list, status workflow, manual orders, invoices, refunds"
    status: completed
    dependencies:
      - core-services
  - id: admin-discount-management
    content: "Build admin discount management: code creation, campaigns, usage tracking, analytics"
    status: completed
    dependencies:
      - core-services
  - id: admin-customer-management
    content: Create admin customer management interface with customer details and order history
    status: completed
    dependencies:
      - customer-accounts
  - id: admin-settings
    content: "Add e-commerce settings to admin: shipping zones, payment gateway config, email templates, currency/tax"
    status: completed
    dependencies:
      - core-services
  - id: admin-reports
    content: "Build admin reports and analytics: sales reports, product performance, customer analytics, low stock alerts"
    status: completed
    dependencies:
      - admin-order-management
  - id: payment-integration
    content: Implement payment service abstraction and NetCommerce sandbox integration for credit card processing
    status: completed
    dependencies:
      - checkout-process
  - id: cash-on-delivery
    content: Implement Cash on Delivery payment option
    status: completed
    dependencies:
      - payment-integration
  - id: email-system
    content: Create email service with templates for order confirmations, shipping updates, and notifications
    status: completed
    dependencies:
      - checkout-process
  - id: ui-public
    content: Adapt MultiShop template to existing design, implement dynamic product listings, responsive UI with Bootstrap modals
    status: completed
    dependencies:
      - public-product-catalog
      - shopping-cart
      - checkout-process
  - id: ui-admin
    content: Build admin UI for all e-commerce management features, extend existing admin design patterns
    status: completed
    dependencies:
      - admin-product-management
      - admin-order-management
      - admin-discount-management
  - id: translations
    content: Add all e-commerce translation keys to en.json, ru.json, and ar.json files
    status: completed
  - id: admin-menu
    content: "Update admin menu (data/admin-menu.json) with e-commerce sections: Products, Categories, Orders, Customers, Discounts, Reports, Settings"
    status: completed
  - id: admin-category-management
    content: "Build admin category management: CRUD, featured flag, hierarchical structure, category images"
    status: completed
    dependencies:
      - core-services
---

# E-commer

ce Platform Implementation Plan

## Architecture Overview

The e-commerce system will be built following the existing MVC pattern:

- **Controllers**: Handle HTTP requests/responses (`src/controllers/` for public, `admin/controllers/` for admin)
- **Services**: Business logic and data operations (`src/services/` and `admin/services/`)
- **Views**: EJS templates (`views/` for public, `admin/views/` for admin)
- **Database**: MySQL with migration scripts in `data-migration/`
- **Design**: MultiShop template as base, adapted to existing site branding

## Database Schema

### Core Tables

- `products` - Product catalog with variants support
- `is_featured` BOOLEAN - Flag to mark featured products (for homepage display)
- `product_categories` - Hierarchical categories (unlimited depth via parent_id)
- `is_featured` BOOLEAN - Flag to mark featured categories (for homepage display)
- `product_variants` - Variant attributes (size, color, material, etc.)
- `product_images` - Multiple images per product/variant
- `product_reviews` - Customer reviews and ratings
- `size_charts` - Customizable size charts (product/category level)
- `customers` - Customer accounts (extends users table with role='customer')
- `customer_addresses` - Saved shipping addresses
- `wishlists` - Customer wishlists
- `shopping_carts` - Session-based and customer carts
- `cart_items` - Cart line items
- `orders` - Order master records
- `order_items` - Order line items with variant details
- `order_status_history` - Order status tracking
- `discounts` - Discount codes and campaigns
- `discount_usage` - Track discount code usage
- `shipping_zones` - Shipping configuration
- `shipping_rates` - Shipping cost calculation
- `payment_methods` - Payment gateway configuration
- `transactions` - Payment transaction records

### Migration Strategy

- Create migration script: `data-migration/YYYY-MM-DD-ecommerce-schema.ts`
- Include rollback instructions
- Test on development database first

## Implementation Phases

### Phase 1: Database & Core Services

#### 1.1 Database Schema Migration

- Create comprehensive MySQL schema for all e-commerce tables
- Add foreign key constraints and indexes
- Migration script in `data-migration/` directory
- Update `src/database/schema.sql` for reference

#### 1.2 Core Service Layer

Create services following existing patterns:

- `src/services/productService.ts` - Product catalog operations
- `src/services/categoryService.ts` - Category hierarchy management (with featured flag support)
- `src/services/cartService.ts` - Shopping cart operations (session + database)
- `src/services/orderService.ts` - Order creation and management
- `src/services/discountService.ts` - Discount calculation and validation
- `src/services/shippingService.ts` - Shipping calculation
- `src/services/paymentService.ts` - Payment processing abstraction
- `admin/services/productManagementService.ts` - Admin product CRUD
- `admin/services/categoryManagementService.ts` - Admin category management
- `admin/services/orderManagementService.ts` - Admin order management
- `admin/services/discountManagementService.ts` - Admin discount management
- `admin/services/customerService.ts` - Customer management

### Phase 2: Public-Facing Features

#### 2.1 Product Catalog

- **Controller**: Extend `src/controllers/shopController.ts`
- **Views**: Update `views/shop.ejs`, `views/detail.ejs`
- Features:
- Product listing with pagination
- Category filtering (nested categories)
- Search with autocomplete
- Advanced filtering (price, attributes, ratings)
- Product detail page with:
    - Image gallery with zoom (using existing MultiShop components)
    - Variant selector (color, size, material)
    - Variant-specific images
    - Size chart display
    - Stock indicators
    - Related products
    - Customer reviews section

#### 2.2 Shopping Cart

- **Controller**: Add cart methods to `src/controllers/shopController.ts`
- **View**: Update `views/cart.ejs`
- Features:
- Add/remove items
- Quantity updates
- Variant selection
- Session persistence
- Customer cart sync on login

#### 2.3 Checkout Process

- **Controller**: Extend checkout in `src/controllers/shopController.ts`
- **View**: Update `views/checkout.ejs`
- Features:
- Multi-step checkout (cart → shipping → payment → review)
- Guest checkout option
- Member checkout with saved addresses
- Shipping method selection
- Discount code application
- Order summary
- Payment method selection (Cash on Delivery / Credit Card)

#### 2.4 Customer Accounts

- **Controller**: `src/controllers/customerController.ts` (new)
- **Views**: `views/customer/` directory (new)
- Features:
- Registration/login
- OAuth integration (Google, Office 365, Facebook)
- Profile management
- Order history with tracking
- Saved addresses
- Wishlist
- Account settings

### Phase 3: Admin Dashboard

#### 3.1 Product Management

- **Controller**: `admin/controllers/productsController.ts` (new)
- **Service**: `admin/services/productManagementService.ts`
- **Views**: `admin/views/products/` (new)
- Features:
- Product CRUD with rich editor
- Bulk import/export (CSV)
- Variant management UI
- Image upload with compression
- Category assignment
- Size chart assignment
- Inventory tracking
- Low stock alerts

#### 3.1.1 Category Management

- **Controller**: `admin/controllers/categoriesController.ts` (new)
- **Service**: `admin/services/categoryManagementService.ts` (new)
- **Views**: `admin/views/categories/` (new)
- Features:
- Category CRUD with hierarchical structure
- Featured category flag (for future homepage use)
- Category image upload
- Drag-and-drop category ordering (optional)
- Category assignment to products

#### 3.2 Order Management

- **Controller**: `admin/controllers/ordersController.ts` (new)
- **Service**: `admin/services/orderManagementService.ts`
- **Views**: `admin/views/orders/` (new)
- Features:
- Order list with filtering
- Order detail view
- Status workflow management
- Manual order creation
- Order notes
- Invoice/packing slip generation
- Refund management

#### 3.3 Discount Management

- **Controller**: `admin/controllers/discountsController.ts` (new)
- **Service**: `admin/services/discountManagementService.ts`
- **Views**: `admin/views/discounts/` (new)
- Features:
- Discount code creation
- Campaign scheduling
- Usage tracking
- Analytics

#### 3.4 Customer Management

- **Controller**: Extend `admin/controllers/usersController.ts` or create `admin/controllers/customersController.ts`
- **Views**: `admin/views/customers/` (new)
- Features:
- Customer list
- Customer details
- Order history per customer
- Manual customer creation

#### 3.5 Settings & Configuration

- **Controller**: Extend `admin/controllers/siteSettingsController.ts`
- **Views**: `admin/views/settings/` (new sections)
- Features:
- E-commerce settings (currency, tax)
- Shipping zones/rates configuration
- Payment gateway settings (NetCommerce sandbox)
- Email template customization

#### 3.6 Reports & Analytics

- **Controller**: `admin/controllers/reportsController.ts` (new)
- **Service**: `admin/services/reportsService.ts` (new)
- **Views**: `admin/views/reports/` (new)
- Features:
- Sales reports (daily/weekly/monthly)
- Product performance
- Customer analytics
- Low stock reports
- Discount usage reports

### Phase 4: Payment Integration

#### 4.1 Payment Service Abstraction

- **Service**: `src/services/paymentService.ts`
- Abstract payment processing to support multiple gateways
- Implement payment method interface

#### 4.2 NetCommerce Integration

- **Service**: `src/services/paymentGateways/netcommerceService.ts` (new)
- Sandbox configuration
- Credit card processing flow
- Transaction recording

#### 4.3 Cash on Delivery

- **Service**: `src/services/paymentGateways/cashOnDeliveryService.ts` (new)
- Simple COD flow
- Order confirmation without payment processing

### Phase 5: Email System

#### 5.1 Email Service

- **Service**: `src/services/emailService.ts` (new)
- Use Node.js email library (nodemailer or similar)
- Template system for emails
- SMTP configuration

#### 5.2 Email Templates

- Order confirmation
- Shipping updates
- Password reset
- Welcome emails
- Admin notifications

### Phase 6: OAuth Integration

#### 6.1 OAuth Service

- **Service**: `src/services/oauthService.ts` (new)
- Support Google, Office 365, Facebook
- User account linking
- Works for both customers and admin users

#### 6.2 OAuth Routes

- **Controller**: `src/controllers/authController.ts` (new or extend)
- OAuth callback handlers
- Account linking logic

### Phase 7: UI/UX Implementation

#### 7.1 Public Interface

- Adapt MultiShop template to existing design
- Use SCSS variables from `public/css/_variables.scss`
- Dynamic product listings
- Responsive design
- Loading states and feedback
- Bootstrap modals (no alerts/confirms)

#### 7.2 Admin Interface

- Extend existing admin design
- Product management UI
- Order management dashboard
- Reports visualization
- All CSS in `admin/public/css/custom.css`
- All JS in `admin/public/js/custom.js`

#### 7.3 Translation Support

- Add e-commerce translation keys to `data/locales/en.json`, `ru.json`, `ar.json`
- Use translation pattern in all views
- Admin interface fully translated

### Phase 8: Admin Menu Integration

#### 8.1 Menu Items

- Update `data/admin-menu.json` with e-commerce sections:
- Products
- Categories
- Orders
- Customers
- Discounts
- Reports
- E-commerce Settings

## Technical Implementation Details

### File Structure

```javascript
src/
  controllers/
    shopController.ts (extend)
    customerController.ts (new)
    authController.ts (new)
  services/
    productService.ts (new)
    categoryService.ts (new)
    cartService.ts (new)
    orderService.ts (new)
    discountService.ts (new)
    shippingService.ts (new)
    paymentService.ts (new)
    paymentGateways/
      netcommerceService.ts (new)
      cashOnDeliveryService.ts (new)
    emailService.ts (new)
    oauthService.ts (new)

admin/
  controllers/
    productsController.ts (new)
    categoriesController.ts (new)
    ordersController.ts (new)
    discountsController.ts (new)
    customersController.ts (new)
    reportsController.ts (new)
  services/
    productManagementService.ts (new)
    orderManagementService.ts (new)
    discountManagementService.ts (new)
    customerService.ts (new)
    reportsService.ts (new)
  views/
    products/ (new)
    categories/ (new)
    orders/ (new)
    discounts/ (new)
    customers/ (new)
    reports/ (new)

views/
  shop.ejs (update)
  detail.ejs (update)
  cart.ejs (update)
  checkout.ejs (update)
  customer/ (new)

data-migration/
  YYYY-MM-DD-ecommerce-schema.ts (new)
```

### Key Technologies

- **Image Processing**: Multer (existing) + sharp for compression
- **Search**: MySQL FULLTEXT or basic LIKE queries (can upgrade to Elasticsearch later)
- **Session Management**: Express-session (existing)
- **OAuth**: Passport.js or direct OAuth2 implementation
- **Email**: Nodemailer
- **CSV Import/Export**: csv-parse (already in dependencies)

### Security Considerations

- SQL injection prevention (parameterized queries - already in use)
- Password hashing (bcrypt - extend existing usersService)
- CSRF protection (existing csurf middleware)
- XSS prevention (input sanitization)
- Role-based access control (extend existing roleMiddleware)

### Performance Optimizations

- Database indexes on frequently queried columns
- Image optimization and lazy loading
- Pagination for product listings
- Caching for categories and static data
- Session-based cart (no DB hit until checkout)

## Dependencies to Add

```json
{
  "dependencies": {
    "nodemailer": "^6.9.0",
    "sharp": "^0.33.0",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "passport-microsoft": "^0.1.0",
    "passport-facebook": "^3.0.0",
    "bcrypt": "^5.1.1",
    "csv-stringify": "^6.4.0"
  },
  "devDependencies": {
    "@types/nodemailer": "^6.4.0",
    "@types/passport": "^1.0.0",
    "@types/bcrypt": "^5.0.0"
  }
}
```

## Testing Strategy

- Unit tests for services (in `tests/` directory)
- Integration tests for checkout flow
- Admin functionality tests
- Payment gateway sandbox testing

## Migration & Rollout

1. Run database migration on development
2. Test all features in development
3. Create backup before production migration
4. Deploy in phases (database → services → controllers → views)
5. Monitor for issues

## Implementation Status

### ✅ Completed (Phase 1-6 Core Infrastructure)

1. **Database Schema** ✅

   - Migration script created and executed successfully
   - All 20 e-commerce tables created
   - Payment methods initialized
   - User OAuth table for social login

2. **Core Services** ✅

   - ProductService - Product catalog with featured flag support
   - CategoryService - Hierarchical categories with featured flag
   - CartService - Session and customer cart management
   - OrderService - Order creation and workflow
   - DiscountService - Discount validation and calculation
   - ShippingService - Shipping rate calculation
   - PaymentService - Payment abstraction with gateway registration
   - EmailService - Email templates and sending
   - OAuthService - Social login integration

3. **Payment Gateways** ✅

   - CashOnDeliveryService - Manual payment method
   - NetCommerceService - Lebanon gateway (sandbox mode)
   - Auto-registered on app startup

4. **Admin Services** ✅

   - ProductManagementService - CRUD, variants, images, inventory
   - OrderManagementService - Order management and statistics
   - DiscountManagementService - Discount code management
   - CategoryManagementService - Category management

5. **Controllers** ✅

   - ShopController - Public shop, cart, checkout (extended)
   - CustomerController - Accounts, orders, addresses, wishlist
   - ProductsController - Admin product management
   - OrdersController - Admin order management
   - DiscountsController - Admin discount management
   - CategoriesController - Admin category management

6. **Routes** ✅

   - Public e-commerce routes configured
   - Admin e-commerce routes configured
   - API endpoints for cart, checkout, customer operations

7. **Admin Menu** ✅

   - Updated with Products, Categories, Orders, Discounts sections

8. **Translations** ✅

   - E-commerce keys added to en.json, ru.json, ar.json

9. **Dependencies** ✅

   - All required packages added to package.json
   - nodemailer, sharp, bcrypt, csv-stringify installed

### 🚧 In Progress / Next Steps

1. **Public Product Catalog UI** ✅

   - Controller logic complete
   - Shop listing page enhanced with:
     - Dynamic product listings with filters (category, price, search)
     - Pagination
     - Sorting options
     - Stock status indicators
     - Add to cart/wishlist buttons
   - Product detail page enhanced with:
     - Dynamic image gallery with carousel and thumbnails
     - Variant selector UI (size, color, etc.)
     - Stock status indicators
     - Add to cart with quantity selector
     - Related products display
     - Reviews section (UI ready, API pending)
     - Social sharing buttons
   - Translation keys added for all UI elements

2. **Admin UI Enhancement** 🚧

   - ✅ Products listing page complete:
     - Filters (search, category, status, featured)
     - Product table with images, pricing, stock status
     - Pagination
     - Delete confirmation modal
     - Category name and images included in query
   - ✅ Categories listing page complete:
     - Hierarchical category tree display
     - Create/Edit modal form
     - Delete confirmation modal
     - Featured and active status indicators
   - Need to implement:
     - Product create/edit forms (variant management, image upload)
     - Order management dashboard (list, detail, status workflow)
     - Discount management UI (code creation, scheduling)

3. **Customer Management (Admin)** ⏳

   - Service layer ready
   - Need to create:
     - CustomerController for admin
     - Customer list and detail views
     - Order history per customer view

4. **Admin Settings** ⏳

   - Need to extend SiteSettingsController:
     - E-commerce settings section (currency, tax rates)
     - Shipping zones/rates configuration UI
     - Payment gateway configuration (NetCommerce credentials)
     - Email template customization

5. **Reports & Analytics** ⏳

   - Need to create:
     - ReportsController
     - ReportsService
     - Reports views (sales, products, customers, low stock)
     - Data visualization components

6. **OAuth Routes & UI** ⏳

   - OAuthService created
   - Need to implement:
     - OAuth routes in public app
     - OAuth callback handlers
     - Login buttons/links in customer registration page
     - Account linking UI

7. **Email Templates** ⏳

   - EmailService created
   - Need to create email template files:
     - `email-templates/order-confirmation.html`
     - `email-templates/shipping-update.html`
     - `email-templates/password-reset.html`
     - `email-templates/welcome.html`

8. **Public Views Enhancement** ⏳

   - Update `views/shop.ejs` - Product listing with filters
   - Update `views/detail.ejs` - Product detail with gallery
   - Update `views/cart.ejs` - Shopping cart UI
   - Update `views/checkout.ejs` - Multi-step checkout
   - Create `views/customer/` - Account pages

9. **Image Upload & Processing** ⏳

   - Integrate sharp for image compression
   - Add image optimization to product uploads
   - Implement lazy loading for product images

10. **CSV Import/Export** ⏳

    - Implement bulk product import
    - Implement product export functionality
    - Add CSV validation and error handling

11. **Size Charts** ⏳

    - Create size chart management UI
    - Implement size chart display on product pages
    - Add size chart assignment to products/categories

12. **Product Reviews** ⏳

    - Implement review submission form
    - Add review moderation in admin
    - Display reviews on product pages
    - Calculate and update product ratings

13. **Search & Autocomplete** ⏳

    - Enhance search functionality
    - Add autocomplete for product search
    - Implement search suggestions

14. **Wishlist UI** ⏳

    - Create wishlist page for customers
    - Add wishlist button to product pages
    - Display wishlist items

15. **Order Tracking** ⏳

    - Create order tracking page
    - Display order status history
    - Add tracking number support

## Notes