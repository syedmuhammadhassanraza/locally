const { Review, Booking, Provider } = require('../models');

const submitReview = async (req, res) => {
  const { bookingId, rating, comment } = req.body;
  try {
    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const review = await Review.create({
      bookingId,
      consumerId: req.user.id,
      providerId: booking.providerId,
      rating: parseInt(rating) || 5,
      comment: comment || ''
    });

    // Recalculate provider average rating and increment statistics
    const provider = await Provider.findByPk(booking.providerId);
    if (provider) {
      const allReviews = await Review.findAll({ where: { providerId: provider.id } });
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      
      provider.rating = parseFloat(avgRating.toFixed(1));
      provider.jobsCompleted = (provider.jobsCompleted || 0) + 1;
      provider.earnings = (provider.earnings || 0.0) + (booking.totalEstimate || 0.0);
      await provider.save();
    }

    return res.status(201).json(review);
  } catch (error) {
    console.error('Review controller error:', error);
    return res.status(500).json({ message: 'Server error submitting review' });
  }
};

module.exports = { submitReview };
