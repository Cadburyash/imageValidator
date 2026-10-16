import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Import and use image routes
import { imageRouter } from './routes/images';
app.use('/api/v1/images', imageRouter);

// Global error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});
