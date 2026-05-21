const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const fs = require('fs');

dotenv.config();

const { connectDB, sequelize } = require('./config/db');
const { setupTrackerSocket } = require('./socket/tracker.socket');
const { requestLogger, logError, LOGS_DIR } = require('./middleware/logging.middleware');
const logRoutes = require('./routes/log.routes');

// Log server boot
const runtimeLogPath = path.join(LOGS_DIR, 'runtime.log');
const logRuntime = (msg) => {
  fs.appendFileSync(runtimeLogPath, `[${new Date().toISOString()}] [Server] ${msg}\n`);
};
logRuntime('Initiating Server Boot sequence...');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});
global.ioInstance = io;

const cookieParser = require('cookie-parser');

// Telemetry & HTTP Request Logging (First in stack)
app.use(requestLogger);
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Serve frontend static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// Serve uploaded profile pictures
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import routes
const authRoutes = require('./routes/auth.routes');
const bookingRoutes = require('./routes/booking.routes');
const chatRoutes = require('./routes/chat.routes');
const paymentRoutes = require('./routes/payment.routes');
const providerRoutes = require('./routes/provider.routes');
const reviewRoutes = require('./routes/review.routes');
const trackerRoutes = require('./routes/tracker.routes');
const userRoutes = require('./routes/user.routes');
const mapsRoutes = require('./routes/maps.routes');

// Mount routes
app.use('/api/logs', logRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/trackers', trackerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/maps', mapsRoutes);

// Simple Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Rozgo API Server is running' });
});

// Setup Tracker Socket listeners
setupTrackerSocket(io);

const PORT = process.env.PORT || 5000;

// Connect to TiDB and sync models
const startServer = async () => {
  try {
    await connectDB();
    
    // Sync base structure (create tables if not exist, no alter)
    await sequelize.sync();
    console.log('TiDB base tables synced.');

    // Safely add missing columns that may not exist yet (won't fail if already exist)
    const safeAddColumn = async (table, column, definition) => {
      try {
        await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        console.log(`Added column ${table}.${column}`);
      } catch (e) {
        // Ignore duplicate column errors (errno 1060)
        if (e.original && e.original.errno === 1060) {
          // Column already exists, skip
        } else {
          console.warn(`Could not add ${table}.${column}:`, e.message);
        }
      }
    };

    // Providers table - add new columns
    await safeAddColumn('Providers', 'phone', 'VARCHAR(255)');
    await safeAddColumn('Providers', 'address', 'VARCHAR(255)');
    await safeAddColumn('Providers', 'dob', 'VARCHAR(255)');
    await safeAddColumn('Providers', 'reliabilityScore', 'FLOAT DEFAULT 100.0');
    await safeAddColumn('Providers', 'cancellationRate', 'FLOAT DEFAULT 0.0');
    await safeAddColumn('Providers', 'hourlyRate', 'INTEGER DEFAULT 800');
    await safeAddColumn('Providers', 'specialization', 'VARCHAR(255)');
    await safeAddColumn('Providers', 'tier', 'INTEGER DEFAULT 1');
    await safeAddColumn('Providers', 'trustBadges', 'TEXT');
    await safeAddColumn('Providers', 'fcmToken', 'VARCHAR(255)');
    await safeAddColumn('Providers', 'emailVerified', 'TINYINT(1) DEFAULT 0');
    await safeAddColumn('Providers', 'phoneVerified', 'TINYINT(1) DEFAULT 0');
    await safeAddColumn('Providers', 'profilePicture', 'VARCHAR(255)');

    // Users table - add new columns
    await safeAddColumn('Users', 'phone', 'VARCHAR(255)');
    await safeAddColumn('Users', 'address', 'VARCHAR(255)');
    await safeAddColumn('Users', 'dob', 'VARCHAR(255)');
    await safeAddColumn('Users', 'cnic', 'VARCHAR(255)');
    await safeAddColumn('Users', 'lat', 'FLOAT');
    await safeAddColumn('Users', 'lng', 'FLOAT');
    await safeAddColumn('Users', 'manualLocation', 'TINYINT(1) DEFAULT 0');
    await safeAddColumn('Users', 'emailVerified', 'TINYINT(1) DEFAULT 0');
    await safeAddColumn('Users', 'phoneVerified', 'TINYINT(1) DEFAULT 0');
    await safeAddColumn('Users', 'profilePicture', 'VARCHAR(255)');

    // Bookings table - add new columns
    await safeAddColumn('Bookings', 'complexityTier', "VARCHAR(255) DEFAULT 'basic'");
    await safeAddColumn('Bookings', 'cancellationFee', 'INTEGER DEFAULT 0');
    await safeAddColumn('Bookings', 'checklist', 'TEXT');
    await safeAddColumn('Bookings', 'evidencePhotos', 'TEXT');
    await safeAddColumn('Bookings', 'scheduledTime', 'VARCHAR(255)');

    // Reviews table - add new columns
    await safeAddColumn('Reviews', 'feedback', 'TEXT');
    await safeAddColumn('Reviews', 'consumerName', 'VARCHAR(255)');

    console.log('TiDB database migration completed successfully.');
    logRuntime('TiDB Database schemas and columns synced successfully.');

    // Mount Error Logger Middleware (Before listening)
    app.use(logError);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      logRuntime(`Server listening successfully on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    logRuntime(`FATAL SERVER CRASH on boot: ${error.message} - ${error.stack}`);
    process.exit(1);
  }
};

startServer();
