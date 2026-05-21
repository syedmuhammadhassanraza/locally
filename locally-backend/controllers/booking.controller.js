const { Booking, User, Provider, Chat } = require('../models');

const createBooking = async (req, res) => {
  const { providerId, serviceType, baseFee, travelFee, surgeFee, totalEstimate, lat, lng } = req.body;
  try {
    // Update provider coordinates to reflect the shifted matched location in database
    if (providerId && lat && lng) {
      await Provider.update(
        { lat: parseFloat(lat), lng: parseFloat(lng) },
        { where: { id: providerId } }
      );
    }

    const booking = await Booking.create({
      consumerId: req.user.id,
      providerId,
      serviceType,
      status: 'confirmed',
      baseFee: parseFloat(baseFee) || 0.0,
      travelFee: parseFloat(travelFee) || 0.0,
      surgeFee: parseFloat(surgeFee) || 0.0,
      totalEstimate: parseFloat(totalEstimate) || 0.0
    });
    
    // Start background live tracking bot working on real data
    startLiveTrackingSimulation(booking.id);
    
    return res.status(201).json(booking);
  } catch (error) {
    console.error('Create booking controller error:', error);
    return res.status(500).json({ message: 'Server error creating booking' });
  }
};

const getBookings = async (req, res) => {
  try {
    const role = req.user.getDataValue('role') || req.user.role;
    let bookings;
    if (role === 'provider') {
      bookings = await Booking.findAll({
        where: { providerId: req.user.id },
        include: [{ model: User, as: 'consumer', attributes: ['name', 'email'] }]
      });
    } else {
      bookings = await Booking.findAll({
        where: { consumerId: req.user.id },
        include: [{ model: Provider, as: 'provider', attributes: ['name', 'serviceType'] }]
      });
    }
    return res.json(bookings);
  } catch (error) {
    console.error('Get bookings controller error:', error);
    return res.status(500).json({ message: 'Server error fetching bookings' });
  }
};

const updateBookingStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const booking = await Booking.findByPk(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    
    booking.status = status;
    await booking.save();
    
    if (status === 'completed') {
      await Chat.destroy({ where: { userId: booking.consumerId } });
    }
    
    return res.json(booking);
  } catch (error) {
    console.error('Update booking status error:', error);
    return res.status(500).json({ message: 'Server error updating booking status' });
  }
};

const reassignBooking = async (req, res) => {
  const { id } = req.params;
  const { Op } = require('sequelize');

  try {
    const booking = await Booking.findByPk(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Find a next available provider in this service category who is NOT the current one
    const nextProvider = await Provider.findOne({
      where: {
        serviceType: booking.serviceType,
        isOnline: true,
        id: { [Op.ne]: booking.providerId }
      }
    });

    if (!nextProvider) {
      // Dynamic fallback/simulation provider so demo never gets stuck!
      const fallbackProvider = await Provider.create({
        name: 'Bilal Ahmed',
        fathersName: 'Ahmed Raza',
        email: 'bilal_' + Date.now() + '@rozgo.com',
        phone: '03009876543',
        address: 'PWD Colony, Islamabad',
        demoCode: 'PROV-2026-FALLBACK',
        serviceType: booking.serviceType,
        isOnline: true,
        rating: 4.6,
        jobsCompleted: 142,
        reliabilityScore: 95
      });

      booking.providerId = fallbackProvider.id;
      booking.status = 'confirmed';
      await booking.save();

      // Start/restart background live tracking bot
      startLiveTrackingSimulation(booking.id);

      return res.json({ success: true, booking, provider: fallbackProvider });
    }

    booking.providerId = nextProvider.id;
    booking.status = 'confirmed';
    await booking.save();

    // Start/restart background live tracking bot
    startLiveTrackingSimulation(booking.id);

    return res.json({ success: true, booking, provider: nextProvider });
  } catch (error) {
    console.error('reassignBooking error:', error);
    return res.status(500).json({ message: 'Server error during provider reassignment' });
  }
};

// Global background trackers registry
const activeTrackers = new Map();

// Background Bot simulation working step-by-step on real DB coordinates and statuses
const startLiveTrackingSimulation = async (bookingId) => {
  if (activeTrackers.has(bookingId)) {
    clearInterval(activeTrackers.get(bookingId));
    activeTrackers.delete(bookingId);
  }

  let step = 0;
  const intervalId = setInterval(async () => {
    try {
      const booking = await Booking.findByPk(bookingId, {
        include: [
          { model: User, as: 'consumer' },
          { model: Provider, as: 'provider' }
        ]
      });

      if (!booking || booking.status === 'completed' || booking.status === 'cancelled') {
        clearInterval(intervalId);
        activeTrackers.delete(bookingId);
        return;
      }

      step++;
      let newStatus = booking.status;
      let newLat = booking.provider.lat;
      let newLng = booking.provider.lng;

      const userLat = booking.consumer.lat || 33.6425;
      const userLng = booking.consumer.lng || 73.0768;

      if (step === 2) {
        newStatus = 'accepted';
      } else if (step === 4) {
        newStatus = 'en_route';
      } else if (step >= 5 && step < 15) {
        newStatus = 'en_route';
        const pct = (step - 4) / 10;
        const startLat = userLat + 0.009;
        const startLng = userLng + 0.007;
        newLat = startLat - (startLat - userLat) * pct;
        newLng = startLng - (startLng - userLng) * pct;
      } else if (step === 15) {
        newStatus = 'arrived';
        newLat = userLat;
        newLng = userLng;
      }

      booking.status = newStatus;
      await booking.save();

      await Provider.update(
        { lat: newLat, lng: newLng },
        { where: { id: booking.providerId } }
      );

      // Emit tracking updates via real Socket.io channels
      if (global.ioInstance) {
        global.ioInstance.to(`booking_${bookingId}`).emit('booking:status_changed', {
          bookingId,
          status: newStatus,
          timestamp: Date.now()
        });
        global.ioInstance.to(`booking_${bookingId}`).emit('location_updated', {
          lat: newLat,
          lng: newLng,
          heading: 0,
          speed: 15,
          timestamp: Date.now()
        });
      }

      console.log(`[Live Bot] Booking #${bookingId.substring(0,8)} | Step ${step} | Status: ${newStatus} | Coord: (${newLat.toFixed(5)}, ${newLng.toFixed(5)})`);

      if (step >= 25) {
        booking.status = 'completed';
        await booking.save();
        clearInterval(intervalId);
        activeTrackers.delete(bookingId);
      }
    } catch (err) {
      console.error('[Live Bot Error]:', err);
      clearInterval(intervalId);
      activeTrackers.delete(bookingId);
    }
  }, 4000);

  activeTrackers.set(bookingId, intervalId);
};

// Cancel booking endpoint handler with 5-minute penalty rules
const cancelBooking = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const booking = await Booking.findByPk(id, {
      include: [{ model: Provider, as: 'provider' }]
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.status = 'cancelled';
    
    const createdTime = new Date(booking.createdAt).getTime();
    const elapsedMinutes = (Date.now() - createdTime) / 60000;

    let penaltyApplied = false;
    let cancellationFee = 0;

    const isNoSpecificReason = !reason || reason.trim() === '' || 
      reason.trim().toLowerCase() === 'no specific reason' || 
      reason.trim().toLowerCase() === 'changed my mind' ||
      reason.trim().toLowerCase() === 'none';

    if (elapsedMinutes > 5 && isNoSpecificReason) {
      cancellationFee = 200;
      penaltyApplied = true;
    }

    booking.cancellationFee = cancellationFee;
    await booking.save();

    await Chat.destroy({ where: { userId: booking.consumerId } });

    if (activeTrackers.has(id)) {
      clearInterval(activeTrackers.get(id));
      activeTrackers.delete(id);
    }

    if (global.ioInstance) {
      global.ioInstance.to(`booking_${id}`).emit('booking:status_changed', {
        bookingId: id,
        status: 'cancelled',
        cancellationFee,
        penaltyApplied,
        message: penaltyApplied 
          ? `Booking cancelled. A penalty of Rs. ${cancellationFee} was charged because it was cancelled after 5 minutes with no specific reason.`
          : 'Booking cancelled successfully.'
      });
    }

    return res.json({
      success: true,
      booking,
      penaltyApplied,
      cancellationFee,
      message: penaltyApplied 
        ? `Booking cancelled. A penalty of Rs. ${cancellationFee} was charged because it was cancelled after 5 minutes with no specific reason.`
        : 'Booking cancelled successfully.'
    });
  } catch (error) {
    console.error('cancelBooking controller error:', error);
    return res.status(500).json({ message: 'Server error during booking cancellation' });
  }
};

module.exports = { 
  createBooking, 
  getBookings, 
  updateBookingStatus, 
  reassignBooking,
  cancelBooking
};
