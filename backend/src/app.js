import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import readingsRoutes from './routes/readingsRoutes.js';
import recordsRoutes from './routes/recordsRoutes.js';
import medsRoutes from './routes/medsRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import coachRoutes from './routes/coachRoutes.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/readings', readingsRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/meds', medsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/coach', coachRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

export default app;
