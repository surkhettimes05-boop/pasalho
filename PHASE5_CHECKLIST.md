# PASALO OS — Phase 5 Implementation Checklist

## Phase 5: Retailer Ordering Ecosystem

### Objective
Digitize retailer ordering gradually through self-service portal, WhatsApp-assisted ordering, and intelligent recommendations.

---

## ✅ Completed

### Schema — New Models
- [x] `RetailerSession` — retailerId, tokenHash, refreshTokenHash, expiresAt, revokedAt, device tracking
- [x] `RetailerDevice` — retailerId, deviceId, deviceType, userAgent, ipAddress, isTrusted, lastActiveAt
- [x] `RetailerNotification` — retailerId, branchId, type (ORDER_CONFIRMED/ORDER_SHIPPED/DELIVERY_UPDATE/PAYMENT_RECEIVED/PROMOTIONAL), status (UNREAD/READ), title, message, entityType, entityId, metadata
- [x] `RetailerOrderPreference` — retailerId, preferredDay, notes, autoReorder, notifyBySms
- [x] `RetailerNotificationType` enum
- [x] `RetailerNotificationStatus` enum
- [x] `Retailer.pinHash` field added for PIN-based authentication
- [x] New `AuditAction` values: RETAILER_LOGIN, RETAILER_PIN_SET, RETAILER_ORDER_PLACED, RETAILER_ORDER_CANCELLED, RETAILER_DEVICE_REGISTERED, RETAILER_NOTIFICATION_SENT
- [x] New `ReferenceType` values: RETAILER_PORTAL, RETAILER_NOTIFICATION

### Backend — Retailer Authentication
- [x] `RetailerAuthService` — login(phone, pin), initPin, setPin, changePin, logout, validateSession, getProfile
- [x] PIN-based authentication with bcrypt hashing
- [x] JWT token generation with retailer-specific payload
- [x] Session management with refresh tokens
- [x] Device registration and tracking
- [x] `RetailerAuthController` — POST /login, POST /init-pin, POST /set-pin, POST /change-pin, POST /logout, GET /me
- [x] `RetailerJwtStrategy` — JWT authentication guard for retailer endpoints
- [x] `CurrentRetailer` decorator for dependency injection

### Backend — Retailer Orders
- [x] `RetailerOrderService` — placeOrder, listOrders, getOrder, cancelOrder
- [x] Order creation with automatic confirmation
- [x] Transaction-safe order item creation
- [x] Auto-notification on order placement
- [x] Order cancellation with status validation
- [x] `RetailerOrderController` — GET /, GET /:id, POST /, POST /:id/cancel
- [x] Integration with existing SalesOrder model

### Backend — Retailer Notifications
- [x] `RetailerNotificationService` — list, markRead, markAllRead, unreadCount, create
- [x] Notification filtering by status
- [x] Bulk read operations
- [x] Unread count tracking
- [x] `RetailerNotificationController` — GET /, POST /:id/read, POST /mark-all-read, GET /unread-count

### Backend — Retailer Recommendations
- [x] `RetailerRecommendationService` — getQuickReorder, getReorderSuggestions
- [x] Quick reorder based on 30-day order history
- [x] Frequency-based suggestions from 90-day history
- [x] Product filtering for active products only
- [x] `RetailerRecommendationController` — GET /quick-reorder, GET /suggestions

### Backend — WhatsApp Ordering
- [x] `WhatsAppOrderService` — processWhatsAppMessage
- [x] Message parsing (format: "5 Product Name" or "Product Name 5")
- [x] Product name matching (exact and partial)
- [x] Order creation from parsed items
- [x] Notification on WhatsApp order receipt
- [x] `WhatsAppOrderController` — POST /incoming

### Backend — Module Integration
- [x] `RetailerPortalModule` — complete module with all services, controllers, and dependencies
- [x] Registered in `AppModule`
- [x] JWT configuration with retailer-specific secret
- [x] Integration with SalesModule, FinanceModule, AuditModule

### Frontend — Retailer Portal Layout
- [x] `/retailer/layout.tsx` — authentication context, protected routes, mobile-first navigation
- [x] Bottom navigation bar (Dashboard, Orders, Invoices, Profile)
- [x] Token and profile persistence in localStorage
- [x] Auto-redirect to login for unauthenticated users
- [x] Public routes: /retailer/login, /retailer/set-pin

### Frontend — Authentication
- [x] `/retailer/login` — phone + PIN login form, logout functionality
- [x] `/retailer/set-pin` — first-time PIN initialization with confirmation
- [x] `retailerAuthApi` — login, initPin, setPin, changePin, logout, getProfile
- [x] Automatic token refresh and 401 handling

### Frontend — Dashboard
- [x] `/retailer/dashboard` — retailer welcome screen
- [x] Outstanding balance display with credit limit usage
- [x] Order count summary
- [x] Unread notification count
- [x] Quick action buttons (New Order, Quick Reorder)
- [x] Quick reorder suggestions (top 5)

### Frontend — Orders
- [x] `/retailer/orders` — order list with status filter
- [x] `/retailer/orders/new` — product search, cart management, order submission
- [x] `/retailer/orders/[id]` — order detail view
- [x] Cart with quantity adjustment, price editing, item removal
- [x] Real-time cart total calculation
- [x] `retailerOrderApi` — list, findById, create, cancel

### Frontend — Invoices
- [x] `/retailer/invoices` — invoice history with payment status filter
- [x] Invoice number, date, amount display
- [x] Payment status badges
- [x] Link to invoice detail

### Frontend — Payments
- [x] `/retailer/payments` — payment history
- [x] Payment number, date, amount, method display
- [x] Reference number display

### Frontend — Quick Reorder
- [x] `/retailer/quick-reorder` — reorder suggestions from order history
- [x] One-click add to cart
- [x] Cart management with quantity and price editing
- [x] Order submission from quick reorder
- [x] `retailerRecommendationApi` — getQuickReorder, getReorderSuggestions

### Frontend — API Client
- [x] `lib/api/retailer-portal.ts` — complete API client with interceptors
- [x] Automatic token injection
- [x] 401 auto-logout and redirect
- [x] TypeScript interfaces for all data models

---

## ⏳ Phase 6 Backlog

- Retailer ledger with aging reports
- Credit limit enforcement
- Financial ledger integration
- Cash session management
- Payment allocation engine

---

## Database Migration Applied

Schema migrations have been applied to the database:

```bash
cd backend
npx prisma migrate dev --name phase5_retailer_portal
```

Database schema is up to date.

---

## Validation Metrics (Phase 5 targets)

| Metric | Target |
|---|---|
| Retailer self-order success rate | > 95% |
| Manual call reduction | Measurable decrease |
| Retailer repeat order growth | Positive trend |
| Notification delivery | > 90% |
| Mobile UX stability | < 1% crash rate |

---

## Testing Checklist

### Authentication Flow
- [ ] First-time PIN setup
- [ ] Login with phone + PIN
- [ ] PIN change functionality
- [ ] Session expiration handling
- [ ] Logout and token cleanup

### Order Flow
- [ ] Product search and add to cart
- [ ] Cart quantity adjustment
- [ ] Order submission
- [ ] Order confirmation notification
- [ ] Order cancellation
- [ ] Order history viewing

### Quick Reorder
- [ ] Reorder suggestions display
- [ ] One-click reorder
- [ ] Cart from suggestions
- [ ] Order submission

### Notifications
- [ ] Notification list display
- [ ] Unread count accuracy
- [ ] Mark as read functionality
- [ ] Mark all as read
- [ ] Notification on order placement

### WhatsApp Ordering
- [ ] Message parsing accuracy
- [ ] Product name matching
- [ ] Order creation from WhatsApp
- [ ] Notification on WhatsApp order

---

## Deployment Notes

### Environment Variables Required
- `JWT_RETAILER_SECRET` — JWT secret for retailer tokens (fallback to JWT_SECRET)
- `JWT_RETAILER_EXPIRES_IN` — Token expiration time (default: 30d)

### API Endpoints
- `POST /api/v1/retailer-portal/auth/login` — Retailer login
- `POST /api/v1/retailer-portal/auth/init-pin` — Initialize PIN
- `POST /api/v1/retailer-portal/auth/set-pin` — Set PIN (authenticated)
- `POST /api/v1/retailer-portal/auth/change-pin` — Change PIN (authenticated)
- `POST /api/v1/retailer-portal/auth/logout` — Logout (authenticated)
- `GET /api/v1/retailer-portal/auth/me` — Get profile (authenticated)
- `GET /api/v1/retailer-portal/orders` — List orders (authenticated)
- `POST /api/v1/retailer-portal/orders` — Create order (authenticated)
- `GET /api/v1/retailer-portal/orders/:id` — Get order (authenticated)
- `POST /api/v1/retailer-portal/orders/:id/cancel` — Cancel order (authenticated)
- `GET /api/v1/retailer-portal/notifications` — List notifications (authenticated)
- `POST /api/v1/retailer-portal/notifications/:id/read` — Mark read (authenticated)
- `POST /api/v1/retailer-portal/notifications/mark-all-read` — Mark all read (authenticated)
- `GET /api/v1/retailer-portal/notifications/unread-count` — Unread count (authenticated)
- `GET /api/v1/retailer-portal/recommendations/quick-reorder` — Quick reorder (authenticated)
- `GET /api/v1/retailer-portal/recommendations/suggestions` — Suggestions (authenticated)
- `POST /api/v1/retailer-portal/whatsapp/incoming` — WhatsApp order (webhook)

### Frontend Routes
- `/retailer/login` — Login page
- `/retailer/set-pin` — PIN setup page
- `/retailer/dashboard` — Dashboard
- `/retailer/orders` — Order list
- `/retailer/orders/new` — New order
- `/retailer/orders/[id]` — Order detail
- `/retailer/invoices` — Invoice history
- `/retailer/payments` — Payment history
- `/retailer/quick-reorder` — Quick reorder

---

## Operational Readiness

### Retailer Onboarding
1. Create retailer record in admin panel
2. Share phone number with retailer
3. Retailer visits /retailer/set-pin to initialize PIN
4. Retailer logs in at /retailer/login
5. Retailer can place orders immediately

### Monitoring
- Track retailer login frequency
- Monitor order success rates
- Track notification delivery
- Monitor WhatsApp order parsing accuracy

### Rollback Plan
If retailer portal causes issues:
1. Disable retailer self-order by removing JWT_RETAILER_SECRET
2. Continue with sales rep assisted ordering
3. Retailer sessions will expire naturally
