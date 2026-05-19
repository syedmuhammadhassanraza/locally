const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

dotenv.config();

const { connectDB, sequelize } = require('./config/db');
const { setupTrackerSocket } = require('./socket/tracker.socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth.routes');
const bookingRoutes = require('./routes/booking.routes');
const chatRoutes = require('./routes/chat.routes');
const paymentRoutes = require('./routes/payment.routes');
const providerRoutes = require('./routes/provider.routes');
const reviewRoutes = require('./routes/review.routes');
const trackerRoutes = require('./routes/tracker.routes');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/trackers', trackerRoutes);

// Simple Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'LOCALLY API Server is running' });
});

// Setup Tracker Socket listeners
setupTrackerSocket(io);

const PORT = process.env.PORT || 5000;

// Connect to TiDB and sync models
const startServer = async () => {
  try {
    await connectDB();
    
    // Sync models to database
    await sequelize.sync();
    console.log('TiDB database synced successfully.');

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
