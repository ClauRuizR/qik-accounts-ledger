# Qik Accounts & Ledger Service

Technical assessment for **Qik Banco Digital**: a bank-account and ledger service with a
GraphQL API (NestJS, PostgreSQL, Redis) and a React Native mobile app (Expo).

Users register, open accounts in DOP/USD/EUR, credit and debit them, browse a filterable
transaction history and see a balance summary. The emphasis is on **financial correctness**:
exact decimal arithmetic, atomic postings, row-level locking against race conditions,
idempotent retries and an append-only ledger.

---

## Contents

1. [Project overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Technology stack](#3-technology-stack)
4. [Prerequisites](#4-prerequisites)
5. [Installation](#5-installation)
6. [Environment configuration](#6-environment-configuration)
7. [Starting PostgreSQL and Redis](#7-starting-postgresql-and-redis-docker-compose)
8. [Database migrations](#8-database-migrations)
9. [Running the backend](#9-running-the-backend)
10. [Running the mobile app](#10-running-the-mobile-app)
11. [GraphQL examples](#11-graphql-examples)
12. [Authentication](#12-authentication)
13. [Running the tests](#13-running-the-tests)
14. [Design decisions and tradeoffs](#14-design-decisions-and-tradeoffs)
15. [Known limitations](#15-known-limitations)
16. [Future improvements](#16-future-improvements)

**Quick start** (details in the sections below):

```bash
npm run setup                                   # install both apps (npm ci)
cp .env.example .env                            # set POSTGRES_PASSWORD
cp apps/api/.env.example apps/api/.env          # same password + a JWT_SECRET
npm run db:up                                   # PostgreSQL + Redis (waits for healthy)
npm run db:migrate                              # apply migrations
npm run api:dev                                 # API on http://localhost:3000/graphql
npm run mobile:start                            # Expo dev server (separate terminal)
```

---

## 1. Project overview

| Capability | Where |
|---|---|
| Register / log in (JWT) | `register`, `login`, `me` |
| Create, list and view accounts; current balance | `createAccount`, `myAccounts`, `account`, `accountBalance` |
| Credit / debit with overdraft prevention and idempotency keys | `creditAccount`, `debitAccount` |
| Transaction history: type + date filters, sorting, cursor pagination | `accountTransactions` |
| Balance summary: balance, total credits/debits, count, balance history (Redis-cached) | `accountBalanceSummary` |
| Mobile app: 7 screens covering all of the above | `apps/mobile` |

```text
qik-accounts-ledger/
├── docker-compose.yml        PostgreSQL 17 + Redis 7 (named volumes, health checks)
├── .env.example              compose variables
├── apps/
│   ├── api/                  NestJS GraphQL API
│   └── mobile/               Expo / React Native app
└── package.json              convenience scripts for the whole repo
```

Transfers between accounts and double-entry bookkeeping are **out of scope**, as the
assessment brief specifies (see [§16](#16-future-improvements)).

---

## 2. Architecture

### Backend: Clean Architecture per module

```text
apps/api/src/
├── main.ts / bootstrap.ts / app.module.ts
├── config/                 zod-validated environment (fails fast, never echoes values)
├── database/               TypeORM options, hand-written SQL migrations
├── common/
│   ├── auth/               @Public, @CurrentUser, request helpers
│   ├── cache/              CacheStore port + fail-open Redis adapter
│   ├── errors/             DomainError + stable error codes
│   └── graphql/            Decimal scalar, error formatter, domain-error filter
└── modules/
    ├── users/              domain · infrastructure
    ├── auth/               application (use cases, ports) · infrastructure (argon2, JWT) · presentation (resolver, global guard)
    ├── accounts/           domain · application · infrastructure · presentation
    ├── ledger/             domain (Money, posting rules, cursors) · application · infrastructure · presentation
    └── health/             GET /health (REST + Swagger)
```

| Layer | Contains | Depends on |
|---|---|---|
| **Domain** | Entities and value objects (`Account`, `Money`, `LedgerEntry`), pure rules (`applyPosting`), repository **ports** (abstract classes), domain errors | nothing (no Nest, no TypeORM) |
| **Application** | Use cases (`PostTransactionUseCase`, `ListTransactionsUseCase`, …) and ports for infrastructure (`LedgerUnitOfWork`, `PasswordHasher`, `TokenService`) | domain |
| **Infrastructure** | TypeORM entities and repositories, SQL, Redis, argon2, JWT | application + domain |
| **Presentation** | GraphQL resolvers, input/output types, guard | application |

Resolvers stay thin: they validate input and call one use case. Ports are abstract classes
used directly as Nest DI tokens, so there are no string tokens and no generic repository
framework.

### How a credit/debit is posted

```text
creditAccount / debitAccount
  │  validate amount (Money: > 0, ≤ 2 decimals, ≤ 1,000,000,000.00)   ← before any lock
  ▼
BEGIN (READ COMMITTED, lock_timeout 5s)
  SELECT … FROM accounts WHERE id = $1 FOR UPDATE      ← serializes postings per account
  ownership + ACTIVE checks
  idempotency key already used? → return original entry (or IDEMPOTENCY_CONFLICT)
  new balance = applyPosting(balance, type, amount)    ← INSUFFICIENT_FUNDS if < 0
  INSERT ledger_entries (…, balance_after)
  UPDATE accounts SET balance, version = version + 1
COMMIT                                                 ← any error rolls back both writes
  ▼
after commit: evict the previous cached summary (never inside the transaction)
```

The database enforces the same invariants independently (see
[migrations](apps/api/src/database/migrations)):

- `CHECK (balance >= 0)` and `CHECK (amount > 0)`.
- `UNIQUE (account_id, idempotency_key)`.
- A **trigger that rejects UPDATE, DELETE and TRUNCATE on `ledger_entries`**, so posted
  entries are immutable.

### Database schema

| Table | Key columns and constraints |
|---|---|
| `users` | `id uuid`, `email` (unique on `lower(email)`), `password_hash` (argon2id) |
| `accounts` | `id uuid`, `user_id → users`, `account_number varchar(12) UNIQUE` (Luhn check digit), `currency CHECK IN (DOP,USD,EUR)`, `balance numeric(20,2) CHECK ≥ 0`, `status`, `version` |
| `ledger_entries` | `id uuid`, `seq bigint identity`, `account_id → accounts`, `type CHECK IN (CREDIT,DEBIT)`, `amount numeric(20,2) CHECK > 0`, `balance_after numeric(20,2) CHECK ≥ 0`, `description`, `idempotency_key`, `created_at` (default `clock_timestamp()`); index `(account_id, created_at DESC, seq DESC)`; append-only trigger |

### Mobile app

```text
apps/mobile/src/
├── navigation/     separate auth / app stacks; render gated on token hydration
├── screens/        auth/ · accounts/ · transactions/   (presentational)
├── hooks/          all data logic: useAccounts, usePostTransaction, useTransactions, …
├── components/     common/ (Button, TextField, States, MoneyText, …) · accounts/ · transactions/
├── services/       graphql/ (client, operations, error mapping) · auth/ (SecureStore, session)
├── auth/           AuthProvider (session + Apollo client)
├── utils/          money (BigInt cents, no floats), dates, validation
└── theme/          design tokens
```

---

## 3. Technology stack

| Area | Choice |
|---|---|
| API | NestJS 12, TypeScript 6 (ESM), Apollo Server 5, GraphQL code-first (`@nestjs/graphql` 14) |
| Persistence | PostgreSQL 17, TypeORM 0.3 (hand-written SQL migrations) |
| Cache | Redis 7, `redis` (node-redis) 5 |
| Money | PostgreSQL `NUMERIC(20,2)` + `decimal.js`; strings end to end |
| Auth | argon2id (`argon2`), JWT HS256 (`@nestjs/jwt`) |
| Validation | `class-validator` (GraphQL inputs), `zod` (environment) |
| REST docs | Swagger (`@nestjs/swagger`) for `GET /health` at `/docs` |
| API tests | Vitest 4 + Supertest, against real PostgreSQL and Redis |
| Mobile | Expo SDK 58, React Native 0.88, React 19, React Navigation 7, Apollo Client 4, `expo-secure-store`, `expo-crypto` |
| Mobile tests | Jest 30 (`jest-expo`) + React Native Testing Library 14 |
| Quality | ESLint (typescript-eslint / eslint-config-expo) + Prettier |

---

## 4. Prerequisites

- **Node.js 22.13+ or 24.3+**, the range Expo SDK 58 / React Native 0.88 require (NestJS 12
  needs ≥ 20). Developed on Node 24.10, npm 11.
- **Docker** with Docker Compose v2 (for PostgreSQL and Redis).
- For the mobile app, one of:
  - **iOS Simulator** (macOS with Xcode),
  - an **Android emulator**,
  - or a physical phone with **Expo Go** (SDK 58) on the same network.

The API and the mobile app run on the host. Only PostgreSQL and Redis run in Docker.

---

## 5. Installation

```bash
git clone <repository-url> qik-accounts-ledger
cd qik-accounts-ledger
npm run setup        # = npm ci in apps/api and apps/mobile (exact lockfile versions)
```

> npm 11 may print `install-scripts` warnings for packages such as `argon2`. No approval is
> needed: `argon2` ships prebuilt binaries for macOS, Linux and Windows.

---

## 6. Environment configuration

There are three `.env` files, each with a committed `.env.example`. Real `.env` files are
git-ignored.

**`./.env`**, read by Docker Compose:

| Variable | Default | Notes |
|---|---|---|
| `POSTGRES_USER` | `qik_user` | |
| `POSTGRES_PASSWORD` | *(required)* | compose refuses to start without it |
| `POSTGRES_DB` | `qik_ledger` | |
| `POSTGRES_PORT` | `5432` | host port; change it if a local PostgreSQL already uses 5432 |
| `REDIS_PORT` | `6379` | host port |

**`apps/api/.env`**, read by the API (validated at startup; it fails fast and lists only
variable names, never values):

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` disables GraphiQL, introspection and Swagger |
| `PORT` | `3000` | |
| `DATABASE_HOST` / `DATABASE_PORT` | `localhost` / `5432` | must match `POSTGRES_PORT` |
| `DATABASE_USER` / `DATABASE_PASSWORD` / `DATABASE_NAME` | — | must match the compose values |
| `DATABASE_TEST_NAME` | `qik_ledger_test` | integration-test database (created automatically) |
| `REDIS_URL` | `redis://localhost:6379` | |
| `SUMMARY_CACHE_TTL_SECONDS` | `300` | |
| `JWT_SECRET` | *(required, ≥ 32 chars)* | e.g. `openssl rand -base64 48` |
| `JWT_EXPIRES_IN_SECONDS` | `3600` | |
| `CORS_ORIGINS` | *(empty)* | comma-separated; empty means any origin outside production (native apps don't need CORS) |

**`apps/mobile/.env`** (optional):

| Variable | Default |
|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000/graphql` |

Set it according to where the app runs:

| Where the app runs | `EXPO_PUBLIC_API_URL` |
|---|---|
| iOS simulator | `http://localhost:3000/graphql` (default) |
| Android emulator | `http://10.0.2.2:3000/graphql` |
| Physical device | `http://<your-computer-LAN-IP>:3000/graphql` |

Restart `expo start` after changing it, because the value is inlined at bundle time.

Example setup:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env   # optional
# Edit .env and apps/api/.env: same database password in both,
# and a JWT_SECRET of at least 32 characters in apps/api/.env.
```

---

## 7. Starting PostgreSQL and Redis (Docker Compose)

```bash
npm run db:up        # docker compose up -d --wait  (returns once both are healthy)
docker compose ps    # both services should be "healthy"
npm run db:down      # stop (data is kept in the postgres_data / redis_data volumes)
```

To wipe all data, run `docker compose down -v`.

---

## 8. Database migrations

Migrations are hand-written SQL (`apps/api/src/database/migrations`). Schema
synchronization is disabled.

```bash
npm run db:migrate                            # build + apply pending migrations
npm --prefix apps/api run migration:show      # list applied/pending
npm --prefix apps/api run migration:revert    # revert the last one
```

New migrations must be registered in `src/database/migrations/index.ts`. The list is
explicit, so the CLI, the app and the tests always load the same set.

---

## 9. Running the backend

```bash
npm run api:dev                               # watch mode
# or
npm --prefix apps/api run build && npm --prefix apps/api run start:prod
```

| URL | What |
|---|---|
| `http://localhost:3000/graphql` | GraphQL endpoint (GraphiQL in a browser outside production) |
| `http://localhost:3000/health` | `{"status":"ok","database":"up","redis":"up"}`. Returns 503 if PostgreSQL is down, and 200 with `"degraded"` if only Redis is down |
| `http://localhost:3000/docs` | Swagger UI for the REST endpoint |

In development the generated SDL is written to [`apps/api/schema.graphql`](apps/api/schema.graphql),
which is committed. The mobile test suite validates every client operation against it.

---

## 10. Running the mobile app

The API must be running first.

```bash
npm run mobile:start        # = expo start
```

- **iOS simulator:** press `i` in the Expo terminal, or open the simulator and scan or enter
  the `exp://` URL in Expo Go.
- **Android emulator:** press `a`, and set `EXPO_PUBLIC_API_URL` to `http://10.0.2.2:3000/graphql`.
- **Physical device:** scan the QR code with Expo Go, and set `EXPO_PUBLIC_API_URL` to your
  computer's LAN IP.

The app uses only modules bundled in **Expo Go** (no custom native code), so no development
build is needed.

**Screens:**
1. Sign in / Create account
2. My accounts
3. New account
4. Account details
5. Credit / Debit
6. Transactions (filters and infinite scroll)
7. Balance summary

<details>
<summary><strong>Troubleshooting: <code>xcrun simctl</code> errors or the Simulator not opening (macOS)</strong></summary>

If `xcode-select -p` prints `/Library/Developer/CommandLineTools`, Expo's iOS shortcuts
cannot find `simctl`. Either select Xcode:

```bash
sudo xcode-select -s /Applications/Xcode.app
```

…or keep the setting and point individual commands at Xcode:

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcrun simctl list devices available                   # pick a device
xcrun simctl boot <UDID>
npx expo start                                        # without --ios
xcrun simctl openurl <UDID> exp://127.0.0.1:8081       # then tap "Open" in the prompt
```

`expo start --ios` can also exit after bundling if it fails to bring the Simulator window to
the front. Starting without `--ios` and opening the URL as shown avoids this.

</details>

---

## 11. GraphQL examples

All operations except `register`, `login` and `health` need `Authorization: Bearer <token>`.
Money values are **strings** (`"150.25"`). JSON numbers are rejected so amounts never pass
through floating point.

```bash
API=http://localhost:3000/graphql
gql() { curl -s "$API" -H 'content-type: application/json' -H "authorization: Bearer ${TOKEN:-}" -d "$1"; echo; }
```

**Register (or `login` with the same input) and keep the token:**

```graphql
mutation {
  register(input: { email: "ana@example.com", password: "a-strong-password" }) {
    accessToken
    user { id email }
  }
}
```

```bash
TOKEN=$(gql '{"query":"mutation { register(input:{email:\"ana@example.com\", password:\"a-strong-password\"}) { accessToken } }"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.register.accessToken')
```

**Create an account and list accounts:**

```graphql
mutation { createAccount(input: { currency: DOP }) { id accountNumber currency balance status } }

query { myAccounts { id accountNumber currency balance } }
```

**Credit and debit.** The `idempotencyKey` is optional; retrying with the same key returns
the original transaction instead of posting twice:

```graphql
mutation Credit($input: PostTransactionInput!) {
  creditAccount(input: $input) { id type amount balanceAfter createdAt }
}
# variables
{ "input": { "accountId": "<id>", "amount": "1500.00", "description": "Salary",
             "idempotencyKey": "6f1c2b9e-0d7a-4f43-9a51-2f0f8f6f5b1e" } }

mutation Debit($input: PostTransactionInput!) {
  debitAccount(input: $input) { id amount balanceAfter }
}
# variables
{ "input": { "accountId": "<id>", "amount": "250.75", "description": "Rent" } }
```

**Balance:**

```graphql
query { accountBalance(accountId: "<id>") { balance currency asOf } }
```

**Transaction history** (all filters optional, both dates inclusive, `first` from 1 to 100):

```graphql
query History($id: ID!, $filters: TransactionFilterInput) {
  accountTransactions(accountId: $id, filters: $filters) {
    items { id type amount balanceAfter description createdAt }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}
# variables: debits in November, newest first, 20 per page
{ "id": "<id>", "filters": { "type": "DEBIT",
    "startDate": "2026-11-01T00:00:00Z", "endDate": "2026-11-30T23:59:59Z",
    "sortOrder": "DESC", "first": 20 } }
# next page: add  "after": "<endCursor from the previous response>"
```

**Balance summary:**

```graphql
query {
  accountBalanceSummary(accountId: "<id>") {
    currentBalance totalCredits totalDebits transactionCount
    history(limit: 10) { at balance }
  }
}
```

**Errors.** Every error carries a stable `extensions.code`:

```json
{ "errors": [{ "message": "Insufficient funds for this debit",
               "path": ["debitAccount"], "extensions": { "code": "INSUFFICIENT_FUNDS" } }],
  "data": null }
```

| Code | When |
|---|---|
| `UNAUTHENTICATED` | missing, invalid or expired token |
| `INVALID_CREDENTIALS` / `EMAIL_ALREADY_REGISTERED` | login / registration |
| `ACCOUNT_NOT_FOUND` | the account doesn't exist **or belongs to another user** (existence isn't revealed) |
| `ACCOUNT_INACTIVE` | posting to an inactive account |
| `INSUFFICIENT_FUNDS` | the debit would overdraw the account |
| `INVALID_AMOUNT` | ≤ 0, more than 2 decimals, or over 1,000,000,000.00 |
| `INVALID_DATE_RANGE` / `INVALID_CURSOR` | history filters |
| `IDEMPOTENCY_CONFLICT` | the key was already used for a different request |
| `BAD_USER_INPUT` | input validation; `extensions.details` lists the field messages |
| `INTERNAL_ERROR` | anything unexpected; logged server-side, with no SQL or stack trace in the response |

---

## 12. Authentication

1. `register` or `login` returns `accessToken`, a JWT (HS256, `sub` = user id) valid for
   `JWT_EXPIRES_IN_SECONDS` (1 h by default).
2. Send it as `Authorization: Bearer <accessToken>`.
3. A **global guard** protects every operation by default. Only operations marked `@Public()`
   (register, login, health) are open.
4. Ownership is enforced in one place (`GetOwnedAccountUseCase`) and reused by every
   account-scoped query and by the posting transaction itself.

**Security details:**
- Passwords are hashed with argon2id.
- Emails are case-insensitive and unique.
- Login returns the same error, after one hash check, whether or not the email exists, so
  responses don't reveal which emails are registered.
- Only `HS256` tokens are accepted.

**Mobile:**
- The token is stored in **`expo-secure-store`** (iOS Keychain / Android Keystore), never
  AsyncStorage.
- On launch, nothing renders until the stored token has been read.
- Signing out, or any `UNAUTHENTICATED` response, deletes the token and clears the Apollo
  cache.

---

## 13. Running the tests

Integration tests need PostgreSQL and Redis running (`npm run db:up`). They use a separate
database (`qik_ledger_test`) and Redis logical database `1`, so development data is never
touched.

```bash
npm test                                  # everything: API unit + API integration + mobile
npm run lint                              # ESLint in both apps

# API (apps/api)
npm --prefix apps/api test                # unit tests: domain + use cases with in-memory ports
npm --prefix apps/api run test:e2e        # integration: real PostgreSQL + Redis via GraphQL/Supertest
npm --prefix apps/api run test:cov        # unit coverage
npm --prefix apps/api run test:cov:e2e    # integration coverage

# Mobile (apps/mobile)
npm --prefix apps/mobile test
npm --prefix apps/mobile run test:cov
npm --prefix apps/mobile run typecheck
```

| Suite | Tests | Highlights |
|---|---|---|
| API unit | 135 | `Money` arithmetic and limits; posting rules; every use case (credit, debit, insufficient funds, invalid amounts, ownership, idempotency, rollback); cursors and date ranges; cache-aside behavior; JWT tampering and expiry; error sanitization |
| API integration | 90 | **two concurrent 80.00 debits on 100.00 → exactly one succeeds, balance 20.00** (10 rounds); a proof that a posting waits for the row lock; 20-way concurrent debit stress; mixed concurrent load with ledger invariants checked; rollback on constraint violation and mid-transaction crash; concurrent idempotent retries; DB constraints and immutability trigger; full pagination traversal; cache invalidation and Redis-down fallback; hardening (CSRF, GET mutations, batching, unknown fields) |
| Mobile | 100 | every screen's loading, empty, error and data states; form validation; idempotency key reuse on retry; filters and pagination; Apollo auth/error links; navigation gating; schema contract test |

The concurrency tests were checked against a **negative control**: with the `FOR UPDATE`
lock removed, all four of them fail.

> The test reset bypasses the ledger immutability trigger with `session_replication_role`,
> which needs a superuser. The Docker Compose user is one.

---

## 14. Design decisions and tradeoffs

**Concurrency: pessimistic row lock + READ COMMITTED.**
`SELECT … FOR UPDATE` on the account row serializes postings per account, while postings on
different accounts run in parallel. Statements after the lock see the latest committed
balance.
- *Alternatives:* `SERIALIZABLE` or optimistic version checks both need client retry loops.
  A single atomic `UPDATE … WHERE balance >= amount` can't easily also record
  `balance_after` and handle idempotency in the same step.
- *Tradeoff:* a very hot single account becomes a queue. `lock_timeout` bounds the wait.

**Money as decimal strings everywhere.**
- The database uses `NUMERIC(20,2)`, the API uses `decimal.js` inside a `Money` value object,
  and the mobile app uses BigInt cents.
- GraphQL has a `Decimal` scalar that accepts **strings only**.
- Amounts with more than 2 decimals are **rejected rather than rounded**, so nothing is
  silently changed.

**Single-entry ledger with a balance column.**
- Each posting writes an immutable entry with `balance_after` and updates the balance in the
  same transaction.
- Reads stay O(1), and the entries remain the audit trail: tests check
  `balance = Σ credits − Σ debits = last balance_after`.
- Double-entry is the right model once transfers exist; the brief excludes them.

**Defense in depth for invariants.** The application checks the business rules, and CHECK
constraints, unique indexes and the immutability trigger enforce them again in PostgreSQL.

**Idempotency keys are optional and scoped per account.**
- The key is checked **while the account lock is held**, so two concurrent retries can't both
  post. A unique index backs this up.
- A failed request doesn't use up its key.
- The mobile app keeps one key per intended transaction: it's reused on retry and replaced
  when the values change.

**Redis caches only the balance summary, with versioned keys.**
- Key format: `ledger:summary:{accountId}:v{version}`, with a TTL of
  `SUMMARY_CACHE_TTL_SECONDS`.
- `version` is incremented in the **same transaction** as every posting, and readers always
  look up the current version first. A stale summary therefore can't be served; it doesn't
  depend on invalidation timing.
- After a commit, the previous version's key is deleted; the TTL cleans up anything missed.
- The summary itself is computed from one `REPEATABLE READ` snapshot, so balance, totals and
  history agree.
- `account` and `accountBalance` are **never cached**. They are cheap primary-key reads, and
  the ownership check runs on every request anyway.
- Redis **fails open**: commands time out after 250 ms, nothing is queued while disconnected,
  and the app falls back to PostgreSQL.
- There is no Redis locking. PostgreSQL alone guarantees consistency.

**Ordering and pagination.**
- History uses keyset pagination on `(created_at, seq)` with opaque cursors that keep the
  database's microsecond timestamps, so pages are stable even when timestamps tie.
- `created_at` defaults to `clock_timestamp()`, the time of the insert while the lock is
  held, rather than `now()`, the transaction's start time. This makes date order match
  posting order even under lock contention.

**Errors.** Foreign accounts return `ACCOUNT_NOT_FOUND`, so the API never confirms that an
account exists. Unknown errors are logged and returned as `INTERNAL_ERROR`. Expected business
errors aren't logged as errors.

**Tooling.**
- **Vitest on the backend:** NestJS 12 is ESM-only, and Jest's ESM support is still
  experimental. Supertest is used as planned.
- **Jest (`jest-expo`) on mobile**, as specified.
- **React Navigation** as specified. Expo Router is built on it but wasn't needed.
- **Migrations are hand-written SQL**, so the constraints and trigger are explicit and
  reviewable.
- **NestJS Observe** was removed from the scaffold: it sends telemetry to an outside service
  and needed keys.

---

## 15. Known limitations

- **Session lifetime:** no refresh tokens. A session is a single access token (1 h), and the
  user signs in again when it expires.
- **No rate limiting** on `login` or `register`.
- **Deleted users:** a still-valid token for a user who no longer exists gets an
  `INTERNAL_ERROR` from `createAccount`. The API has no user deletion, so this can't
  currently happen.
- **Inactive accounts:** `INACTIVE` exists in the schema and is enforced, but there is no
  operation to close an account.
- **Summary on a cache miss** aggregates every entry of the account (`SUM`, `COUNT`), which is
  fine at this scale. Very large ledgers would want running totals stored on the account.
- **`totalCount`** in history uses `COUNT(*)` with the same filters.
- **Mobile date filters** are typed text (`YYYY-MM-DD`, local calendar days, validated)
  rather than a native date picker.
- **Verified platforms:**
  - The mobile app was run in Expo Go on the iOS simulator (iOS 27).
  - Android was verified only through a successful Metro bundle export and the test suite,
    not on an emulator.
  - Web is not supported.
- **Local only:** HTTP, no TLS. No deployment, CI/CD or Kubernetes, as the brief specifies.
- **`npm audit`** reports moderate advisories in transitive **development-only** tooling
  (Jest dependencies). The suggested `--force` fix downgrades major versions, so it wasn't
  applied.

---

## 16. Future improvements

- **Transfers between accounts** using **double-entry** postings: one transaction locking
  both accounts in a fixed order to avoid deadlocks.
- **Refresh tokens** with rotation, a server-side session list and revocation;
  **rate limiting** (`@nestjs/throttler`) on authentication.
- **Running totals** (`total_credits`, `total_debits`) maintained by the posting transaction,
  making summaries O(1) without a cache.
- **Transactional outbox** for ledger events (notifications, analytics) instead of in-process
  hooks.
- **GraphQL codegen** for typed client operations; query complexity limits.
- **Mobile:** native date picker, Spanish localization, optimistic updates, offline queueing
  of postings using the existing idempotency keys, and Detox/Maestro end-to-end tests.
- **Operations:** CI running lint and all test suites with service containers; structured
  logging and metrics; account statements (PDF/CSV export).
