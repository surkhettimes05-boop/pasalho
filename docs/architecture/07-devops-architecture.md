# Deployment & DevOps Architecture

## FMCG Distribution Operating System — DigitalOcean Production Blueprint

## 1. Deployment Philosophy

Start simple, but not careless.

The system should begin as:

```text
1 production server
1 staging server
managed PostgreSQL
managed/object storage
Redis
Dockerized services
CI/CD pipeline
automated backups
basic monitoring
```

Do **not** start with Kubernetes. Too much complexity.

Recommended initial architecture:

```text
Docker Compose on DigitalOcean Droplet
+
Managed PostgreSQL
+
Managed Redis or Redis container
+
DigitalOcean Spaces
+
GitHub Actions CI/CD
```

---

# 2. Deployment Topology

## Initial Production Topology

```text
Users
 ↓
Cloudflare / DNS / CDN
 ↓
Nginx Reverse Proxy
 ↓
Docker Network
 ├── Next.js Frontend
 ├── Node/NestJS Backend API
 ├── Queue Worker
 ├── WebSocket Service
 └── Redis
 ↓
Managed PostgreSQL
 ↓
DigitalOcean Spaces
```

---

# 3. Recommended Environments

## Development

Local developer machine.

```text
Docker Compose local
local PostgreSQL
local Redis
local object storage emulator optional
```

## Staging

Mirrors production but smaller.

Used for:

* testing migrations
* testing releases
* testing printer/offline flows
* QA before production

## Production

Real business system.

Must have:

* backups
* monitoring
* logs
* SSL
* rollback path

---

# 4. Recommended Droplet Sizes

## Stage 1 — Pilot: 10 Stores

```text
Production Droplet:
2 vCPU
4 GB RAM
80 GB SSD
```

Backend, frontend, worker, Redis can run on this initially.

Use managed PostgreSQL separately if budget allows.

## Staging

```text
1 vCPU
1 GB or 2 GB RAM
```

Enough for QA.

## Stage 2 — 50+ Stores

```text
App Server:
4 vCPU
8 GB RAM

Separate Worker Server:
2 vCPU
4 GB RAM
```

## Stage 3 — 100+ Stores

Split:

```text
Frontend server
API server
Worker server
WebSocket server
Managed Redis
Managed PostgreSQL with read replica
```

---

# 5. Docker Architecture

Use Docker Compose initially.

Services:

```text
nginx
frontend
backend-api
worker
websocket
redis
```

Recommended containers:

```text
frontend:
  Next.js production build

backend-api:
  NestJS API

worker:
  BullMQ processors

websocket:
  Socket.IO gateway if separated later

redis:
  cache + queues

nginx:
  reverse proxy + SSL routing
```

PostgreSQL should preferably be managed, not inside the same droplet for production.

---

# 6. Server Structure

On droplet:

```text
/opt/fmcg-os/
  docker-compose.yml
  .env.production
  nginx/
    nginx.conf
    sites/
  scripts/
    deploy.sh
    backup-check.sh
    health-check.sh
  logs/
  releases/
```

Do not manually edit production code on server.

Deployment should happen from CI/CD only.

---

# 7. Environment Separation

Use separate variables:

```text
.env.development
.env.staging
.env.production
```

Never reuse production database in staging.

Environment variables:

```text
DATABASE_URL
REDIS_URL
JWT_SECRET
REFRESH_TOKEN_SECRET
OBJECT_STORAGE_KEY
OBJECT_STORAGE_SECRET
OBJECT_STORAGE_BUCKET
APP_ENV
API_URL
FRONTEND_URL
SENTRY_DSN
SMTP_CONFIG
```

Production secrets must not be committed to GitHub.

---

# 8. Backup Architecture

Backup must cover:

```text
PostgreSQL database
object storage files
environment secrets
deployment configs
invoice PDFs
audit logs
```

## Database Backup

Use:

```text
Daily automated backup
Weekly full backup
Point-in-time recovery if managed DB supports it
```

Retention:

```text
Daily backups: 7–14 days
Weekly backups: 4–8 weeks
Monthly backups: 6–12 months
```

## Object Storage Backup

DigitalOcean Spaces should store:

```text
invoice PDFs
delivery proof images
product images
stock count evidence
reports
```

Enable:

* versioning if available
* lifecycle policy
* periodic backup to another bucket later

---

# 9. Monitoring Stack

Initial low-cost monitoring:

```text
Uptime Kuma
Sentry
DigitalOcean monitoring
PostgreSQL metrics
Redis metrics
```

Monitor:

```text
API uptime
frontend uptime
database CPU/RAM
disk usage
Redis memory
queue failures
failed jobs
slow API responses
failed logins
sync conflicts
```

Later:

```text
Prometheus
Grafana
Loki
Alertmanager
```

---

# 10. Logging Architecture

Use structured JSON logs.

Backend logs:

```text
request_id
user_id
branch_id
device_id
route
method
status
duration_ms
error_code
```

Log levels:

```text
debug
info
warn
error
fatal
```

Critical events:

```text
invoice posted
payment received
stock transfer dispatched
stock adjustment posted
sync conflict
failed job
migration failure
permission denied
```

Initial setup:

```text
Docker logs + log rotation
Sentry for errors
```

Later:

```text
Loki + Grafana
```

---

# 11. Scaling Strategy

## Phase 1

Single app droplet:

```text
frontend + backend + worker + Redis
```

## Phase 2

Separate database and Redis:

```text
managed PostgreSQL
managed Redis
app droplet
```

## Phase 3

Separate workers:

```text
API server
worker server
websocket server
```

## Phase 4

Load balancing:

```text
DigitalOcean Load Balancer
multiple API droplets
multiple worker processes
read replica
CDN
```

---

# 12. Queue Worker Strategy

Use BullMQ workers for:

```text
offline sync processing
invoice PDF generation
report aggregation
expiry detection
low-stock alerts
notification delivery
backup verification
analytics precomputation
```

Worker deployment:

```text
worker container
same codebase
different start command
```

Scale workers horizontally later:

```text
worker-1
worker-2
worker-3
```

Important: jobs must be idempotent.

---

# 13. WebSocket Deployment

Initial:

```text
WebSocket inside backend API
```

Later:

```text
separate websocket service
Redis adapter for Socket.IO
```

Why Redis adapter matters:

When multiple API instances exist, WebSocket events must reach users connected to any server.

Channels:

```text
branch:{id}
warehouse:{id}
store:{id}
user:{id}
```

---

# 14. CDN Strategy

Use Cloudflare in front.

Benefits:

```text
DNS management
SSL
static asset caching
basic DDoS protection
image optimization
low bandwidth improvement
```

Cache:

```text
Next.js static assets
images
public files
```

Do not cache:

```text
authenticated API responses
invoices
private documents
inventory data
```

---

# 15. SSL Strategy

Use:

```text
Cloudflare SSL
+
Nginx SSL with Let's Encrypt
```

Recommended:

```text
Full strict SSL mode
```

Renew certificates automatically.

---

# 16. Secret Management

For low-cost stage:

```text
DigitalOcean environment variables
GitHub Actions secrets
server .env.production with restricted permissions
```

Rules:

```text
Never commit .env
Never expose service keys in frontend
Rotate secrets after staff/developer changes
Use separate staging/production secrets
```

Later:

```text
Doppler / 1Password Secrets / Vault
```

---

# 17. Zero-Downtime Deployment

Initial Docker Compose deployment may have small downtime.

Better strategy:

```text
build new image
pull image
start new container
health check
switch Nginx upstream
stop old container
```

For early stage, acceptable:

```text
short maintenance window at night
```

Later:

```text
blue-green deployment
```

---

# 18. CI/CD Flow

Use GitHub Actions.

Flow:

```text
Developer pushes to GitHub
↓
Run lint
↓
Run type check
↓
Run tests
↓
Build Docker images
↓
Push images to registry
↓
Deploy to staging
↓
Run smoke tests
↓
Manual approval
↓
Deploy to production
```

Branches:

```text
main = production
staging = staging
feature/* = development
```

---

# 19. Migration Flow

Database migrations are dangerous.

Use Prisma migrations.

Flow:

```text
create migration locally
test locally
apply to staging
run smoke tests
backup production DB
apply production migration
deploy app
verify health
```

Rules:

```text
Never run destructive migration directly
Never drop columns immediately
Use expand-and-contract strategy
```

Example safe change:

```text
1. Add nullable column
2. Deploy code writing both old/new fields
3. Backfill data
4. Switch reads to new field
5. Later remove old field
```

---

# 20. Rollback Strategy

Rollback must cover:

```text
application rollback
database rollback
configuration rollback
```

## Application Rollback

Keep previous Docker image.

```text
docker pull previous-image
docker compose up -d
```

## Database Rollback

Harder.

Do not rely on automatic DB rollback after migration.

Use:

```text
pre-migration backup
reversible migrations where possible
manual rollback script
```

Critical production rule:

> If migration changes data, test restore first in staging.

---

# 21. Release Strategy

Use phased releases.

## Release Types

```text
patch release: bug fixes
minor release: new feature behind flag
major release: schema/workflow change
```

Use feature flags for:

```text
production module
AI forecasting
offline sync
Bluetooth printing
advanced analytics
```

Do not release all features to all branches at once.

Rollout:

```text
staging
↓
internal admin users
↓
one branch
↓
all branches
```

---

# 22. Disaster Recovery

Define RPO/RTO.

Initial realistic targets:

```text
RPO: maximum 24 hours data loss
RTO: restore within 4–8 hours
```

Better later:

```text
RPO: 15 minutes
RTO: under 1 hour
```

Must periodically test:

```text
restore database backup
restore object storage files
restore app server from Docker images
```

Untested backup is not a backup.

---

# 23. Cost Optimization

Start lean:

```text
1 production droplet
1 staging droplet
managed PostgreSQL if possible
Spaces object storage
Cloudflare free
GitHub Actions
Uptime Kuma
Sentry free tier
```

Avoid early:

```text
Kubernetes
multiple load balancers
complex observability stack
expensive analytics warehouse
managed everything
```

Spend money first on:

```text
database safety
backups
monitoring
operational reliability
```

not fancy infra.

---

# 24. Production Checklist

Before launch:

```text
SSL active
database backup enabled
object storage configured
health endpoint working
logs visible
Sentry active
admin user created
staging tested
migration applied
rollback image available
rate limiting enabled
CORS configured
environment variables locked
```

---

# Final DevOps Position

Recommended production architecture:

```text
DigitalOcean Droplet
Docker Compose
Nginx
Next.js container
NestJS API container
BullMQ worker container
Redis
Managed PostgreSQL
DigitalOcean Spaces
Cloudflare
GitHub Actions CI/CD
Sentry + Uptime monitoring
Automated backups
```

Start simple.
Make database safe.
Make backups real.
Make deployments repeatable.
Scale only when traffic and operations prove the need.
