const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();
const baseUrl = 'http://localhost:3000/api/v1';

async function request(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function verify() {
  console.log('--- Starting Verification ---');
  try {
    // 1. Login
    console.log('1. Logging in...');
    const loginRes = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'superadmin@pasalo.com', password: 'Admin@1234' })
    });
    const token = loginRes.data.accessToken;
    console.log('Token received:', !!token);
    const authHeaders = { 'Authorization': `Bearer ${token}` };

    // 2. Fetch categories and units
    const cats = await request('/catalog/categories', { headers: authHeaders });
    const units = await request('/catalog/units', { headers: authHeaders });
    const categoryId = cats.data[0].id;
    const unitId = units.data[0].id;

    // 4. Create Product
    console.log('3. Creating product...');
    const prodRes = await request('/catalog/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        name: 'Test Product ' + Date.now(),
        skuCode: 'TEST-SKU-' + Date.now(),
        categoryId,
        defaultUnitId: unitId,
        costPrice: 100,
        mrp: 150,
        sellingPrice: 120,
        stock: 10,
        isActive: true,
        isBatchTracked: false,
        isExpiryTracked: false
      })
    });
    const productId = prodRes.id;
    console.log('Product created with ID:', productId);

    // 5. Edit Product
    console.log('4. Editing product...');
    const editRes = await request(`/catalog/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ sellingPrice: 130 })
    });
    console.log('Product updated, new selling price:', editRes.sellingPrice);

    // 6. Delete Product
    console.log('5. Deleting product...');
    await request(`/catalog/products/${productId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    console.log('Product deleted via API.');

    // 7. Verify in DB
    console.log('6. Verifying DB deletedAt field...');
    const dbProduct = await prisma.product.findUnique({ where: { id: productId } });
    console.log('Product deletedAt:', dbProduct.deletedAt);
    if (dbProduct.deletedAt) {
      console.log('SUCCESS! Soft delete worked.');
    } else {
      console.log('FAILED! Soft delete did not set deletedAt.');
    }

  } catch (err) {
    console.error('Verification failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
