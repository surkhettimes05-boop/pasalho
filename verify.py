"""
PASALO OS — Phase 1 End-to-End Verification Script

Verifies all Phase 1 success criteria against a running instance.
Usage: python verify.py [base_url]
"""
import urllib.request
import json
import sys
import time

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
API = f'{BASE_URL}/api/v1'

passed = 0
failed = 0


def ok(msg):
    global passed
    passed += 1
    print(f'  PASS  {msg}')


def fail(msg, detail=''):
    global failed
    failed += 1
    print(f'  FAIL  {msg}  {detail}')


def api(path, method='GET', data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(f'{API}{path}', data=body, headers=headers, method=method)
    try:
        resp = json.loads(urllib.request.urlopen(req).read())
        return resp.get('data', resp)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return {'_error': True, '_status': e.code, '_body': body}
    except Exception as e:
        return {'_error': True, '_message': str(e)}


# ── 1. Health Check ───────────────────────────────────────────────────────
print('\n=== 1. Health Check ===')
r = api('/health')
if r.get('status') == 'ok' or not r.get('_error'):
    ok('Health endpoint responds')
else:
    fail('Health endpoint', str(r))

# ── 2. Authentication ─────────────────────────────────────────────────────
print('\n=== 2. Authentication ===')
r = api('/auth/login', 'POST', {'login': 'superadmin@pasalo.com', 'password': 'Admin@1234'})
if r.get('_error'):
    fail('Login', r.get('_body', r.get('_message', '')))
    print('  (skipping remaining tests — need a running server with seed data)')
    print(f'\n{"=" * 50}\nResults: {passed} passed, {failed} failed\n')
    sys.exit(1)

token = r['accessToken']
ok(f'Login successful (token={len(token)} chars)')

# Get current user info
r = api('/auth/me', token=token)
if r.get('id'):
    ok(f'Auth: get current user ({r["fullName"]})')
else:
    fail('Auth: get current user')

# ── 3. Organization ───────────────────────────────────────────────────────
print('\n=== 3. Organization ===')
r = api('/branches', token=token)
if not r.get('_error'):
    branches = r.get('items', r if isinstance(r, list) else [])
    print(f'  INFO  Branches: {len(branches)} found')
    ok('Branches endpoint accessible')
else:
    fail('Branches endpoint')

r = api('/warehouses', token=token)
if not r.get('_error'):
    ok('Warehouses endpoint accessible')
else:
    fail('Warehouses endpoint')

# ── 4. Catalog ────────────────────────────────────────────────────────────
print('\n=== 4. Catalog ===')
r = api('/catalog/products', token=token)
if not r.get('_error'):
    products = r.get('items', r if isinstance(r, list) else [])
    print(f'  INFO  Products: {len(products)} found')
    ok('Products list works')
else:
    fail('Products list')

r = api('/catalog/categories', token=token)
if not r.get('_error'):
    ok('Categories list works')
else:
    fail('Categories list')

r = api('/catalog/units', token=token)
if not r.get('_error'):
    ok('Units list works')
else:
    fail('Units list')

r = api('/catalog/batches', token=token)
if not r.get('_error'):
    ok('Batches list works')
else:
    fail('Batches list')

# ── 5. Inventory ──────────────────────────────────────────────────────────
print('\n=== 5. Inventory ===')
r = api('/inventory/snapshots', token=token)
if not r.get('_error'):
    snaps = r if isinstance(r, list) else []
    print(f'  INFO  Snapshots: {len(snaps)} found')
    ok('Snapshots endpoint works')
else:
    fail('Snapshots endpoint')

r = api('/inventory/movements', token=token)
if not r.get('_error'):
    movs = r if isinstance(r, list) else []
    print(f'  INFO  Movements: {len(movs)} found')
    ok('Movements endpoint works')
else:
    fail('Movements endpoint')

r = api('/inventory/adjustments', token=token)
if not r.get('_error'):
    ok('Stock adjustments endpoint works')
else:
    fail('Stock adjustments endpoint')

# ── 6. Sales / Invoices ──────────────────────────────────────────────────
print('\n=== 6. Sales / Invoices ===')
r = api('/invoices', token=token)
if not r.get('_error'):
    invoices = r.get('items', r if isinstance(r, list) else [])
    print(f'  INFO  Invoices: {len(invoices)} found')
    ok('Invoices list works')
else:
    fail('Invoices list')

r = api('/retailers', token=token)
if not r.get('_error'):
    retailers = r.get('items', r if isinstance(r, list) else [])
    print(f'  INFO  Retailers: {len(retailers)} found')
    ok('Retailers list works')
else:
    fail('Retailers list')

r = api('/sales-reps', token=token)
if not r.get('_error'):
    reps = r.get('items', r if isinstance(r, list) else [])
    print(f'  INFO  Sales reps: {len(reps)} found')
    ok('Sales reps list works')
else:
    fail('Sales reps list')

r = api('/payments', token=token)
if not r.get('_error'):
    payments = r.get('items', r if isinstance(r, list) else [])
    print(f'  INFO  Payments: {len(payments)} found')
    ok('Payments list works')
else:
    fail('Payments list')

# ── 7. Audit Logs ─────────────────────────────────────────────────────────
print('\n=== 7. Audit Logs ===')
r = api('/audit-logs', token=token)
if not r.get('_error'):
    logs = r.get('items', r if isinstance(r, list) else [])
    print(f'  INFO  Audit logs: {len(logs)} entries found')
    ok('Audit logs endpoint works')
else:
    fail('Audit logs endpoint')

# ── 8. Dashboard ─────────────────────────────────────────────────────────
print('\n=== 8. Dashboard ===')
r = api('/dashboard/admin-summary', token=token)
if not r.get('_error'):
    ok(f'Dashboard: {r["today"]["invoiceCount"]} invoices today, '
       f'{r["today"]["paymentCount"]} payments, '
       f'outstanding={r["outstanding"]["totalRetailerCredit"]}')
else:
    fail('Dashboard endpoint')

# ── Summary ───────────────────────────────────────────────────────────────
print(f'\n{"=" * 50}')
print(f'Results: {passed} passed, {failed} failed')
if failed == 0:
    print('Phase 1 verification: ALL CRITERIA PASSED')
else:
    print('Phase 1 verification: SOME CHECKS FAILED')
