# Image Validation Platform - Backend

This is the backend for the Image Validation Platform built with Node.js, Express, TypeScript, and PostgreSQL.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   Copy `.env.example` to `.env` and fill in the values

3. Set up the database:
   ```bash
   npm run prisma:migrate
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Available Scripts

- `dev`: Start development server with ts-node-dev
- `build`: Build the TypeScript code
- `start`: Start the production server
- `prisma:generate`: Generate Prisma client
- `prisma:migrate`: Run Prisma migrations
