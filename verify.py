import urllib.request
import json

req = urllib.request.Request(
    'http://localhost:3000/api/v1/auth/login',
    data=json.dumps({"login": "superadmin@pasalo.com", "password": "Admin@1234"}).encode(),
    headers={"Content-Type": "application/json"},
)
resp = json.loads(urllib.request.urlopen(req).read())
token = resp['data']['accessToken']
print(f"1. Login OK (token={len(token)} chars)")

def call(path):
    req = urllib.request.Request(
        f'http://localhost:3000/api/v1{path}',
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        r = json.loads(urllib.request.urlopen(req).read())
        d = r.get('data', r)
        if isinstance(d, dict) and 'total' in d:
            n = len(d.get('items', []))
            return f"total={d['total']}, returned={n}"
        if isinstance(d, dict):
            return f"object, keys={list(d.keys())[:5]}"
        if isinstance(d, list):
            return f"list of {len(d)}"
        return str(d)[:80]
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}"

print(f"2. Products:    {call('/catalog/products')}")
print(f"3. Retailers:   {call('/retailers')}")
print(f"4. Warehouses:  {call('/warehouses')}")
print(f"5. Snapshots:   {call('/inventory/snapshots')}")
print(f"6. Movements:   {call('/inventory/movements')}")
print(f"7. Invoices:    {call('/invoices')}")
print(f"8. Adjustments: {call('/inventory/adjustments')}")
print(f"9. Payments:    {call('/payments')}")
print(f"10. Dashboard:  {call('/dashboard/admin-summary')}")
