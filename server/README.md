'# Image Validation Platform - Backend

This is the backend for the Image Validation Platform, built with Node.js, Express, TypeScript, PostgreSQL, and Prisma.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up the environment variables:
   - Copy `.env.example` to `.env` and fill in the values.
   - Ensure you have a running PostgreSQL instance and update the `DATABASE_URL` accordingly.

3. Run Prisma migrations:
   ```bash
   npm run prisma:migrate
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   Or build and start:
   ```bash
   npm run build
   npm run start
   ```

## API Endpoints

- `GET /api/v1/health` - Health check
- `POST /api/v1/images` - Upload an image (multipart/form-data, field name `image`)
- `GET /api/v1/images` - Get paginated list of images
- `GET /api/v1/images/:id` - Get image by ID
- `DELETE /api/v1/images/:id` - Delete an image

## Project Structure

- `src/` - Source code
  - `controllers/` - Request handlers
  - `routes/` - API route definitions
  - `services/` - Business logic (if any)
  - `middleware/` - Custom middleware
  - `validators/` - Input validation schemas
  - `index.ts` - Express app setup
- `prisma/` - Prisma schema and migrations
- `uploads/` - Directory for storing uploaded files (outside source directory)

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Port to run the server on (default: 3001)
- `CLIENT_ORIGIN`: Allowed origin for CORS (default: http://localhost:5173)
- `UPLOAD_DIR`: Directory to store uploaded files (relative to server directory, default: ../uploads)
- `MAX_FILE_SIZE_MB`: Maximum file size in megabytes (default: 10)
'
