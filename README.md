# Oracle

Fresh root-level Oracle admin console scaffold.

## Why this exists

This app is intentionally separate from `api/oracle/frontend`.
It follows the same high-level patterns as `my/`:

- one SPA
- same-origin `/api/*`
- route + auth guard
- left-sidebar shell
- section-based navigation

But it starts clean so the admin surface can evolve without inheriting old bugs.

## Scripts

```bash
cd oracle
npm install
npm run dev
```

Set `ORACLE_API_URL` to point Vite at the Oracle backend in local dev.

Recommended local setup:

```bash
# api/oracle/.env
PORT=4300
DB_DRIVER=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_SSL=false
DB_NAME_ORACLE=oracle
DB_NAME_ACCOUNTS=accounts
APP_URL=http://localhost:5173
ACCOUNTS_URL=http://localhost:8000
INTERNAL_SHARED_SECRET=

# oracle/.env
ORACLE_API_URL=http://localhost:4300
```
