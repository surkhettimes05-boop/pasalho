# Customer Commerce Implementation Plan

Source of truth: `surkhettimes05-boop/Blinkit-style-pasal-ho/TECHNICAL_IMPLEMENTATION_SPEC.md`.

## Current branch

`feat/blinkit-commerce-p0-foundation`

## Active batch

- P0-01 storefront guardrails
- P0-02 customer phone/OTP auth and addresses
- P0-03 serviceability and fulfillment routing

## Next batch

Only after this branch is validated:

- P0-04 store-scoped catalog/pricing/availability
- P0-05 FEFO reservations and concurrency hardening
- P0-06 server cart
- P0-07 atomic idempotent checkout

## Architecture invariants

1. New commerce code must not read `Product.stock`.
2. Customer auth is separate from employee JWT/RBAC.
3. Only explicitly mapped active STORE inventory locations may fulfill P0 customer orders.
4. No separate ecommerce inventory ledger or order database is allowed.
5. All migrations are forward-only and additive.
