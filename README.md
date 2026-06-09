# TalentNest Workforce

TalentNest Workforce is a Next.js workforce-management foundation. The current
implemented business flow is attendance kiosk registration, clock-in/out,
geofence checks, attendance exceptions, and manager review.

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL database

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` and `SHADOW_DATABASE_URL` to PostgreSQL connection URLs.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Apply migrations and validate database connectivity:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. Start the application:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

`npm install` and Prisma Client generation do not require database environment
variables. Database commands and application routes that access Prisma do.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Runtime and database commands | PostgreSQL connection used by the application and Prisma migrations. |
| `SHADOW_DATABASE_URL` | Local migration development | Separate PostgreSQL database used by `prisma migrate dev`. Do not point it at production. |

Never commit real environment values. Employee PINs are hashed with bcrypt
before storage and are not returned by attendance APIs.

## Commands

```bash
npm run dev                 # Start local Next.js development server
npm run build               # Generate Prisma Client and build for production
npm start                   # Run a completed production build
npm run lint                # Run ESLint
npm run prisma:validate     # Validate the Prisma schema
npm run validate            # Run Prisma validation, lint, and production build
npm run db:migrate          # Create/apply migrations in local development
npm run db:migrate:deploy   # Apply committed migrations in deployment
npm run db:seed             # Validate database connectivity without inserts
```

The seed command is intentionally a no-op. It validates database connectivity
without inserting organizations, properties, departments, employees, devices,
shifts, staffing companies, or other records.

## Vercel and Neon Deployment

1. Create a Neon project and database.
2. Use the Neon pooled connection string for `DATABASE_URL`.
3. Create a separate Neon database or branch for `SHADOW_DATABASE_URL` only
   when running migration development. Production deployment does not need a
   shadow database.
4. Add `DATABASE_URL` to the Vercel project's Production, Preview, and
   Development environments as appropriate.
5. Keep the Vercel build command as `npm run build`.
6. Apply committed migrations before or during release:

   ```bash
   DATABASE_URL="..." npm run db:migrate:deploy
   ```

7. Optionally run `npm run db:seed` to validate database connectivity. It does
   not insert records.

Do not run `prisma migrate dev` against Neon production. Use
`prisma migrate deploy` for production releases.

## Current Authentication Boundary

The UI still uses a mock role selector. Attendance admin API routes now enforce
the same permission model on the server through a centralized placeholder
guard. The selected mock role is sent in the `x-talentnest-mock-role` header.
Replace the mock current-user resolver with the real authenticated session when
authentication is introduced.
