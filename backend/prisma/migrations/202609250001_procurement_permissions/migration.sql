INSERT INTO "Permission" ("id", "code", "module", "action", "description", "createdAt") VALUES
  ('86ca0297-398e-4ed4-95f2-0d6f90750001', 'suppliers.view', 'suppliers', 'view', 'View suppliers', CURRENT_TIMESTAMP),
  ('86ca0297-398e-4ed4-95f2-0d6f90750002', 'suppliers.create', 'suppliers', 'create', 'Create suppliers', CURRENT_TIMESTAMP),
  ('86ca0297-398e-4ed4-95f2-0d6f90750003', 'suppliers.update', 'suppliers', 'update', 'Update and deactivate suppliers', CURRENT_TIMESTAMP),
  ('86ca0297-398e-4ed4-95f2-0d6f90750004', 'purchases.view', 'purchases', 'view', 'View purchase orders and receipts', CURRENT_TIMESTAMP),
  ('86ca0297-398e-4ed4-95f2-0d6f90750005', 'purchases.create', 'purchases', 'create', 'Create purchase orders', CURRENT_TIMESTAMP),
  ('86ca0297-398e-4ed4-95f2-0d6f90750006', 'purchases.confirm', 'purchases', 'confirm', 'Confirm and cancel purchase orders', CURRENT_TIMESTAMP),
  ('86ca0297-398e-4ed4-95f2-0d6f90750007', 'purchases.receive', 'purchases', 'receive', 'Receive supplier goods into warehouse stock', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
CROSS JOIN "Permission" p
WHERE
  (r."code" IN ('SUPER_ADMIN', 'ADMIN') AND p."code" IN (
    'suppliers.view', 'suppliers.create', 'suppliers.update',
    'purchases.view', 'purchases.create', 'purchases.confirm', 'purchases.receive'
  ))
  OR
  (r."code" IN ('BRANCH_MANAGER', 'WAREHOUSE_MANAGER') AND p."code" IN (
    'suppliers.view', 'purchases.view', 'purchases.create', 'purchases.confirm', 'purchases.receive'
  ))
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
