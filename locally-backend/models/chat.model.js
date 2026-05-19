const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Chat = sequelize.define('Chat', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  messages: {
    type: DataTypes.JSON,
    defaultValue: []
  }
});

module.exports = Chat;
