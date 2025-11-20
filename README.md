# krypt-vault

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Hono** - Lightweight, performant server framework
- **Node.js** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Tauri** - Build native desktop applications
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```
## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:
```bash
pnpm run db:push
```

## S3/MinIO Configuration

This project uses S3-compatible storage (MinIO) for file storage with a **dual-client architecture** to properly handle presigned URLs in production.

### Architecture

The server uses **two separate S3 clients**:

1. **`s3Client`** - Uses internal Docker endpoint (`http://minio:9000`)
   - Used for server-side operations (delete, list, etc.)
   - Communicates directly with MinIO container

2. **`s3Presigner`** - Uses public endpoint (`https://s3.ayushk.me`)
   - Used ONLY for generating presigned URLs
   - Ensures cryptographic signatures match the public hostname
   - Prevents "SignatureDoesNotMatch" errors

### Environment Variables

In your `apps/server/.env` file, configure:

```bash
# Internal S3 endpoint (used by server to communicate with MinIO)
AWS_S3_ENDPOINT=http://minio:9000  # For Docker, or http://localhost:9200 for local dev

# Public S3 endpoint (used in presigned URLs for client access)
PUBLIC_S3_ENDPOINT=https://s3.ayushk.me  # Your public S3/MinIO URL
```

**Important for Production:**
- `AWS_S3_ENDPOINT`: Internal Docker service name or internal network address
- `PUBLIC_S3_ENDPOINT`: **Must** be the publicly accessible URL that browsers/clients can reach
- The presigner client uses `PUBLIC_S3_ENDPOINT` to generate cryptographically valid URLs

### CORS Configuration

The MinIO service is configured with CORS to allow cross-origin requests:

```yaml
MINIO_API_CORS_ALLOW_ORIGIN: "*"
```

For production, replace `"*"` with your specific domains (e.g., `"https://your-app.com,https://tauri.localhost"`).


Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).







## Project Structure

```
krypt-vault/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   └── server/      # Backend API (Hono)
├── packages/
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:server`: Start only the server
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run db:push`: Push schema changes to database
- `pnpm run db:studio`: Open database studio UI
- `cd apps/web && pnpm run desktop:dev`: Start Tauri desktop app in development
- `cd apps/web && pnpm run desktop:build`: Build Tauri desktop app
