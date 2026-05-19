const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  serviceType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending' // pending, accepted, en_route, arrived, completed, cancelled
  },
  baseFee: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  travelFee: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  surgeFee: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  totalEstimate: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  }
});

module.exports = Booking;
