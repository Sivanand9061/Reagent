import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all routes (specifically allowing Vite development server on port 5173)
app.use(cors({
  origin: '*', // For development flexibility; can restrict to specific domains in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-key', 'x-groq-key']
}));

// Express middleware
app.use(express.json({ limit: '50mb' })); // support large payloads for raw text transfers
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Reagent server is healthy and running.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({ 
    error: 'An unexpected error occurred on the server. Please check terminal logs.',
    details: err.message 
  });
});

// Start listening
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 REAGENT BACKEND RUNNING ON PORT: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
