const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
const socketLogStream = fs.createWriteStream(path.join(LOGS_DIR, 'socket_events.log'), { flags: 'a' });

const logSocket = (msg) => {
  const logMsg = `[${new Date().toISOString()}] [Socket.IO] ${msg}\n`;
  socketLogStream.write(logMsg);
};

/**
 * Rozgo Socket.IO Real-Time Tracker
 * Replaces polling-based tracking with bidirectional WebSocket events
 */
const setupTrackerSocket = (io) => {
  // Track connected users and providers
  const connectedUsers = new Map();    // userId -> socketId
  const connectedProviders = new Map(); // providerId -> socketId
  const activeBookings = new Map();     // bookingId -> { userId, providerId, status }

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Connected: ${socket.id}`);
    logSocket(`Connected: ${socket.id}`);

    // ── User/Provider Authentication & Registration ──────────────────────
    socket.on('register_user', (data) => {
      const { userId, role } = data;
      if (role === 'provider') {
        connectedProviders.set(userId, socket.id);
        console.log(`[Socket.IO] Provider ${userId} registered (${socket.id})`);
        logSocket(`Provider ${userId} registered (${socket.id})`);
      } else {
        connectedUsers.set(userId, socket.id);
        console.log(`[Socket.IO] User ${userId} registered (${socket.id})`);
        logSocket(`User ${userId} registered (${socket.id})`);
      }
    });

    // ── Join a Booking Room ──────────────────────────────────────────────
    socket.on('join_booking', (bookingId) => {
      socket.join(`booking_${bookingId}`);
      console.log(`[Socket.IO] ${socket.id} joined booking room: ${bookingId}`);
      logSocket(`${socket.id} joined booking room: ${bookingId}`);
    });

    // ── Provider Location Update (Real-Time) ────────────────────────────
    socket.on('provider:location', (data) => {
      const { bookingId, lat, lng, heading, speed } = data;
      
      // Broadcast to everyone in the booking room (consumer sees live movement)
      io.to(`booking_${bookingId}`).emit('location_updated', {
        lat,
        lng,
        heading: heading || 0,
        speed: speed || 0,
        timestamp: Date.now()
      });
      
      console.log(`[Socket.IO] Provider location -> Booking ${bookingId}: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      logSocket(`Provider location -> Booking ${bookingId}: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    });

    // ── Booking Status Transitions ──────────────────────────────────────
    socket.on('booking:status', (data) => {
      const { bookingId, status, providerId } = data;
      
      // Update active booking tracking
      const booking = activeBookings.get(bookingId) || {};
      booking.status = status;
      if (providerId) booking.providerId = providerId;
      activeBookings.set(bookingId, booking);

      // Broadcast status change to booking room
      io.to(`booking_${bookingId}`).emit('booking:status_changed', {
        bookingId,
        status,
        timestamp: Date.now()
      });

      console.log(`[Socket.IO] Booking ${bookingId} status -> ${status}`);
      logSocket(`Booking ${bookingId} status -> ${status}`);
    });

    // ── Booking Confirmed (Provider Accepted) ───────────────────────────
    socket.on('booking:confirmed', (data) => {
      const { bookingId, provider, eta } = data;
      
      io.to(`booking_${bookingId}`).emit('booking:confirmed', {
        bookingId,
        provider,
        eta,
        timestamp: Date.now()
      });

      console.log(`[Socket.IO] Booking ${bookingId} CONFIRMED by provider ${provider?.name || 'Unknown'}`);
      logSocket(`Booking ${bookingId} CONFIRMED by provider ${provider?.name || 'Unknown'}`);
    });

    // ── Provider En Route ───────────────────────────────────────────────
    socket.on('booking:en_route', (data) => {
      const { bookingId, provider, eta } = data;
      
      io.to(`booking_${bookingId}`).emit('booking:en_route', {
        bookingId,
        provider,
        eta,
        timestamp: Date.now()
      });

      console.log(`[Socket.IO] Provider en route for booking ${bookingId}`);
      logSocket(`Provider en route for booking ${bookingId}`);
    });

    // ── Provider Arrived ────────────────────────────────────────────────
    socket.on('booking:arrived', (data) => {
      const { bookingId } = data;
      
      io.to(`booking_${bookingId}`).emit('booking:arrived', {
        bookingId,
        timestamp: Date.now()
      });

      console.log(`[Socket.IO] Provider arrived for booking ${bookingId}`);
      logSocket(`Provider arrived for booking ${bookingId}`);
    });

    // ── Job Completed ───────────────────────────────────────────────────
    socket.on('booking:completed', (data) => {
      const { bookingId, totalCost, duration } = data;
      
      io.to(`booking_${bookingId}`).emit('booking:completed', {
        bookingId,
        totalCost,
        duration,
        timestamp: Date.now()
      });

      activeBookings.delete(bookingId);
      console.log(`[Socket.IO] Booking ${bookingId} COMPLETED`);
      logSocket(`Booking ${bookingId} COMPLETED`);
    });

    // ── User Location Request (Consumer shares location with provider) ──
    socket.on('user:location', (data) => {
      const { bookingId, lat, lng } = data;
      
      io.to(`booking_${bookingId}`).emit('user:location_updated', {
        lat,
        lng,
        timestamp: Date.now()
      });
      logSocket(`User location shared -> Booking ${bookingId}: ${lat}, ${lng}`);
    });

    // ── Disconnect ──────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      // Clean up connected maps
      for (const [userId, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
          connectedUsers.delete(userId);
          break;
        }
      }
      for (const [providerId, socketId] of connectedProviders.entries()) {
        if (socketId === socket.id) {
          connectedProviders.delete(providerId);
          break;
        }
      }
      console.log(`[Socket.IO] Disconnected: ${socket.id}`);
      logSocket(`Disconnected: ${socket.id}`);
    });
  });
};

module.exports = { setupTrackerSocket };
