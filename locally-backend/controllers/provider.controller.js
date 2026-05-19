const { Provider, Booking } = require('../models');

const updateStatus = async (req, res) => {
  const { isOnline } = req.body;
  try {
    const provider = await Provider.findByPk(req.user.id);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    provider.isOnline = isOnline;
    await provider.save();

    return res.json(provider);
  } catch (error) {
    console.error('Update provider status error:', error);
    return res.status(500).json({ message: 'Server error updating online status' });
  }
};

const getProviderStats = async (req, res) => {
  try {
    const provider = await Provider.findByPk(req.user.id);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    const completedCount = await Booking.count({
      where: { providerId: req.user.id, status: 'completed' }
    });

    return res.json({
      earnings: provider.earnings,
      rating: provider.rating,
      jobsCompleted: provider.jobsCompleted || completedCount,
      isOnline: provider.isOnline
    });
  } catch (error) {
    console.error('Get provider stats error:', error);
    return res.status(500).json({ message: 'Server error fetching provider statistics' });
  }
};

module.exports = { updateStatus, getProviderStats };
