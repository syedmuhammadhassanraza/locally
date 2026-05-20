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

      return res.json({ success: true, booking, provider: fallbackProvider });
    }

    booking.providerId = nextProvider.id;
    booking.status = 'confirmed';
    await booking.save();

    return res.json({ success: true, booking, provider: nextProvider });
  } catch (error) {
    console.error('reassignBooking error:', error);
    return res.status(500).json({ message: 'Server error during provider reassignment' });
  }
};

module.exports = { createBooking, getBookings, updateBookingStatus, reassignBooking };
