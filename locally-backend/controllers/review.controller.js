const { Review, Provider, Booking, User } = require('../models');

const createReview = async (req, res) => {
  const { bookingId, rating, feedback, comment } = req.body;
  const actualFeedback = feedback || comment;
  const consumerId = req.user.id;

  try {
    if (!bookingId || !rating || !actualFeedback) {
      return res.status(400).json({ message: 'Missing required fields: bookingId, rating, feedback/comment' });
    }

    const booking = await Booking.findByPk(bookingId, {
      include: [{ model: User, as: 'consumer' }]
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const providerId = booking.providerId;
    const consumerName = booking.consumer ? booking.consumer.name : 'Anonymous Consumer';

    const review = await Review.create({
      bookingId,
      providerId,
      consumerId,
      rating: parseInt(rating),
      feedback: actualFeedback,
      consumerName
    });

    // Recalculate average rating for the provider
    const providerReviews = await Review.findAll({ where: { providerId } });
    if (providerReviews.length > 0) {
      const sum = providerReviews.reduce((acc, r) => acc + r.rating, 0);
      const avg = parseFloat((sum / providerReviews.length).toFixed(1));
      
      await Provider.update(
        { rating: avg, jobsCompleted: providerReviews.length },
        { where: { id: providerId } }
      );
    }

    return res.status(201).json({ message: 'Review submitted successfully', review });
  } catch (error) {
    console.error('createReview error:', error);
    return res.status(500).json({ message: 'Server error while submitting review' });
  }
};

const getReviewsByProvider = async (req, res) => {
  const { providerId } = req.params;

  try {
    const reviews = await Review.findAll({
      where: { providerId },
      order: [['createdAt', 'DESC']]
    });

    return res.json(reviews);
  } catch (error) {
    console.error('getReviewsByProvider error:', error);
    return res.status(500).json({ message: 'Server error while fetching reviews' });
  }
};

module.exports = { createReview, getReviewsByProvider };
