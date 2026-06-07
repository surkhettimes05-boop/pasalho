const http = require('http');

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      hostname: 'localhost', port: 3000, ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => resolve({ status: res.statusCode, body: chunks }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  // Login
  const login = await req({ method: 'POST', path: '/api/v1/auth/login' }, {
    login: 'superadmin@pasalo.com', password: 'Admin@1234',
  });
  const { accessToken } = JSON.parse(login.body).data;
  const auth = { Authorization: 'Bearer ' + accessToken };

  const endpoints = [
    ['GET', '/api/v1/auth/me'],
    ['GET', '/api/v1/users'],
    ['GET', '/api/v1/branches'],
    ['GET', '/api/v1/warehouses'],
    ['GET', '/api/v1/catalog/products'],
    ['GET', '/api/v1/catalog/categories'],
    ['GET', '/api/v1/catalog/units'],
    ['GET', '/api/v1/retailers'],
    ['GET', '/api/v1/invoices'],
    ['GET', '/api/v1/dashboard/summary'],
    ['GET', '/api/v1/health'],
    ['GET', '/api/v1/inventory/snapshots?locationId='],
  ];

  for (const [method, path] of endpoints) {
    const r = await req({ method, path, headers: auth });
    const ok = r.status >= 200 && r.status < 300;
    const snippet = r.body.substring(0, 100).replace(/\n/g, ' ');
    console.log(`${ok ? '✅' : '❌'} ${method} ${path} → ${r.status}  ${snippet}`);
  }
})();
