const { Payment, Booking } = require('../models');

const processPayment = async (req, res) => {
  const { bookingId, amount, method } = req.body;
  try {
    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const payment = await Payment.create({
      bookingId,
      amount: parseFloat(amount) || 0.0,
      method: method || 'cash',
      status: 'completed'
    });

    return res.status(201).json(payment);
  } catch (error) {
    console.error('Payment controller error:', error);
    return res.status(500).json({ message: 'Server error processing payment' });
  }
};

module.exports = { processPayment };
