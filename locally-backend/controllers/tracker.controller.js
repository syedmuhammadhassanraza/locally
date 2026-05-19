const { Booking, Provider } = require('../models');

const getTrackingInfo = async (req, res) => {
  const { bookingId } = req.params;
  try {
    const booking = await Booking.findByPk(bookingId, {
      include: [{ model: Provider, as: 'provider', attributes: ['name', 'lat', 'lng', 'rating', 'isOnline'] }]
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    return res.json({
      bookingId: booking.id,
      status: booking.status,
      provider: booking.provider,
      eta: '8 mins' // Realistic mock travel ETA
    });
  } catch (error) {
    console.error('Tracker controller error:', error);
    return res.status(500).json({ message: 'Server error fetching tracking information' });
  }
};

module.exports = { getTrackingInfo };
