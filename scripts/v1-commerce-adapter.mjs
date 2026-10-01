// Disposable acceptance adapter: imports the checked-out Commerce implementation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const load = (file) => import(pathToFileURL(path.resolve(process.env.COMMERCE_ROOT, 'backend/dist', file)));
const { query, closePool } = await load('database/connection.js');
const { buildApp } = await load('app.js');
const { SessionService } = await load('services/sessionService.js');
const { CustomerService } = await load('services/customerService.js');
const { ShoppingCartService } = await load('services/shoppingCartService.js');
const { CheckoutService } = await load('services/checkoutService.js');
const stateFile = path.resolve(process.env.ACCEPTANCE_EVIDENCE, 'commerce.json');
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : {};
const command = process.argv[2];
const app = await buildApp('node');
try {
  if (command === 'sync') {
    const staff = (await query("SELECT id FROM staff WHERE username = 'ci-admin'")).rows[0];
    assert(staff, 'Disposable acceptance administrator exists');
    const token = app.jwt.sign({ sub: staff.id, mfaVerified: true });
    const response = await app.inject({ method: 'POST', url: '/api/admin/products/sync-pasalo', headers: { cookie: `ops_session=${token}` } });
    assert.equal(response.statusCode, 200, response.body);
    state.product = (await query("SELECT id, pasalo_product_id FROM products WHERE sku = 'V1-BATCH-001'")).rows[0];
    assert.equal(state.product.pasalo_product_id, process.env.CANONICAL_PRODUCT_ID);
    await query("INSERT INTO product_prices(product_id,store_id,price,currency_code) VALUES($1,NULL,125,'NPR')", [state.product.id]);
    const customer = await new CustomerService().createCustomer({ phone: '9812345699', preferred_name: 'Acceptance Customer', enrollment_source: 'ONLINE', enrollment_channel: 'WEB' });
    state.customerId = customer.id;
    state.session = (await new SessionService().createSession({ customer_id: customer.id })).session_token;
  } else if (command === 'order' || command === 'cancel-order') {
    const carts = new ShoppingCartService();
    const cart = await carts.getOrCreateCart({ customer_id: state.customerId });
    await carts.addToCart({ cart_id: cart.id, product_id: state.product.id, quantity: command === 'order' ? 2 : 1 });
    const body = { cart_id: cart.id, idempotency_key: command === 'order' ? 'v1-online-deliver' : 'v1-online-cancel', delivery_type: 'DELIVERY', shipping_name: 'Acceptance Customer', shipping_phone: '9812345678', shipping_address: 'Ward 1', shipping_city: 'Surkhet', shipping_state: 'Karnali', shipping_postal_code: '21700', shipping_country: 'NP' };
    const headers = { cookie: `customer_session=${state.session}; customer_csrf=ci-csrf`, 'x-csrf-token': 'ci-csrf' };
    const response = await app.inject({ method: 'POST', url: '/api/checkout/cod', headers, payload: body });
    assert.equal(response.statusCode, 201, response.body);
    const order = response.json();
    assert.equal(order.store_id, null);
    assert(order.fulfillment_order_id, JSON.stringify(order));
    const replay = await app.inject({ method: 'POST', url: '/api/checkout/cod', headers, payload: body });
    assert.equal(replay.statusCode, 201, replay.body);
    assert.equal(replay.json().id, order.id);
    if (command === 'order') state.deliver = order; else state.cancel = order;
  } else if (command === 'deliver') {
    const result = await new CheckoutService().syncFulfillmentStatus(state.deliver.id, state.customerId);
    assert.equal(result.status, 'DELIVERED');
    const response = await app.inject({ method: 'GET', url: '/api/customer/orders', headers: { cookie: `customer_session=${state.session}` } });
    assert.equal(response.statusCode, 200, response.body);
    assert(response.body.includes(state.deliver.id));
    assert(response.body.includes('DELIVERED'));
  } else if (command === 'cancel') {
    const service = new CheckoutService();
    await service.cancelCustomerOrder(state.cancel.id, state.customerId, 'Acceptance cancellation');
    await service.cancelCustomerOrder(state.cancel.id, state.customerId, 'Acceptance cancellation');
    assert.equal((await query('SELECT status FROM web_orders WHERE id=$1', [state.cancel.id])).rows[0].status, 'CANCELLED');
  } else if (command === 'reconcile') {
    assert.equal(Number((await query('SELECT COUNT(*) AS count FROM web_orders')).rows[0].count), 2);
    assert.equal(Number((await query("SELECT COUNT(*) AS count FROM stock_reservations WHERE status='ACTIVE'")).rows[0].count), 0);
  } else throw new Error(`Unknown acceptance command: ${command}`);
  // Session is saved only on the disposable runner and excluded from uploaded evidence.
  fs.writeFileSync(stateFile, JSON.stringify(state));
  fs.writeFileSync(path.resolve(process.env.ACCEPTANCE_EVIDENCE, 'commerce-public.json'), JSON.stringify({ product: state.product, deliveredOrder: state.deliver?.id, cancelledOrder: state.cancel?.id }));
} finally { await app.close(); await closePool(); }
