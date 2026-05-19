const { sequelize } = require('../config/db');
const User = require('./user.model');
const Provider = require('./provider.model');
const Booking = require('./booking.model');
const Review = require('./review.model');
const Chat = require('./chat.model');
const Payment = require('./payment.model');

// Associations
User.hasMany(Booking, { foreignKey: 'consumerId' });
Booking.belongsTo(User, { foreignKey: 'consumerId', as: 'consumer' });

Provider.hasMany(Booking, { foreignKey: 'providerId' });
Booking.belongsTo(Provider, { foreignKey: 'providerId', as: 'provider' });

Booking.hasMany(Review, { foreignKey: 'bookingId' });
Review.belongsTo(Booking, { foreignKey: 'bookingId' });

User.hasMany(Review, { foreignKey: 'consumerId' });
Review.belongsTo(User, { foreignKey: 'consumerId' });

Provider.hasMany(Review, { foreignKey: 'providerId' });
Review.belongsTo(Provider, { foreignKey: 'providerId' });

User.hasOne(Chat, { foreignKey: 'userId' });
Chat.belongsTo(User, { foreignKey: 'userId' });

Booking.hasMany(Payment, { foreignKey: 'bookingId' });
Payment.belongsTo(Booking, { foreignKey: 'bookingId' });

module.exports = {
  sequelize,
  User,
  Provider,
  Booking,
  Review,
  Chat,
  Payment
};
