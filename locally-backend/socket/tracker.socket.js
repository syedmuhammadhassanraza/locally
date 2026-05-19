const setupTrackerSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join a room specific to a booking
    socket.on('join_booking', (bookingId) => {
      socket.join(bookingId);
      console.log(`Socket ${socket.id} joined booking room: ${bookingId}`);
    });

    // Handle provider updating location
    socket.on('update_location', (data) => {
      const { bookingId, lat, lng } = data;
      // Broadcast location update to the booking room (e.g. to the consumer)
      io.to(bookingId).emit('location_updated', { lat, lng });
      console.log(`Location updated for booking ${bookingId}: ${lat}, ${lng}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = { setupTrackerSocket };
