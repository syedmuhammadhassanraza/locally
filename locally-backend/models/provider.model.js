const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Provider = sequelize.define('Provider', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fathersName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  demoCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cnic: {
    type: DataTypes.STRING,
    allowNull: true
  },
  serviceType: {
    type: DataTypes.STRING,
    defaultValue: 'Plumbing'
  },
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 5.0
  },
  jobsCompleted: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  earnings: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  isOnline: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lat: {
    type: DataTypes.FLOAT,
    defaultValue: 33.6844
  },
  lng: {
    type: DataTypes.FLOAT,
    defaultValue: 73.0479
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  dob: {
    type: DataTypes.STRING,
    allowNull: true
  },
  reliabilityScore: {
    type: DataTypes.FLOAT,
    defaultValue: 100.0
  },
  cancellationRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  hourlyRate: {
    type: DataTypes.INTEGER,
    defaultValue: 800
  },
  specialization: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tier: {
    type: DataTypes.INTEGER,
    defaultValue: 1  // 1=Basic, 2=Standard, 3=Complex
  }
});

module.exports = Provider;
