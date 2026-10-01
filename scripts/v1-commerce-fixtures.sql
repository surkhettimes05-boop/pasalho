-- Deterministic CI-only prerequisites for the real staff login and catalog sync.
-- Product, customer, order and inventory fixtures are created by A-J itself.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM products) OR EXISTS (SELECT 1 FROM web_orders) THEN
    RAISE EXCEPTION 'Acceptance requires a fresh Commerce database';
  END IF;
END $$;

INSERT INTO organizations (id, organization_name, legal_name, country_code,
  default_currency_code, default_locale, default_timezone, tax_regime,
  payment_providers, feature_flags)
VALUES ('11111111-1111-4111-a111-111111111111', 'Pasalho Acceptance',
  'Pasalho Acceptance', 'NP', 'NPR', 'en-NP', 'Asia/Kathmandu', 'IRD',
  '["cash"]'::jsonb, '{"ENABLE_VAT_TAX": true}'::jsonb);

INSERT INTO stores (id, name_en, address_en, phone, email, status, published_at,
  created_by, organization_id, country_code, currency_code, locale, timezone,
  tax_regime, payment_providers, feature_flags)
VALUES ('22222222-2222-4222-a222-222222222222', 'Acceptance Staff Store',
  'Surkhet', '9800000004', 'staff@example.invalid', 'PUBLISHED',
  '2026-01-01T00:00:00Z', 'v1-acceptance',
  '11111111-1111-4111-a111-111111111111', 'NP', 'NPR', 'en-NP',
  'Asia/Kathmandu', 'IRD', '["cash"]'::jsonb, '{"ENABLE_VAT_TAX": true}'::jsonb);
