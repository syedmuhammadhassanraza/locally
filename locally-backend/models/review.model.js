const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  providerId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  consumerId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  consumerName: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

module.exports = Review;
