const { Sequelize } = require('sequelize');

const host = process.env.TIDB_HOST || process.env.DB_HOST || 'localhost';
const port = process.env.TIDB_PORT || process.env.DB_PORT || 4000;
const user = process.env.TIDB_USER || process.env.DB_USER || 'root';
const password = process.env.TIDB_PASSWORD || process.env.DB_PASSWORD || '';
const database = process.env.TIDB_DATABASE || process.env.DB_NAME || 'test';

const isTiDBCloud = host.includes('tidbcloud.com');

const sequelize = new Sequelize(database, user, password, {
  host: host,
  port: port,
  dialect: 'mysql',
  dialectOptions: isTiDBCloud ? {
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: false // Set to false to avoid issues with CA bundle path on different systems
    }
  } : {},
  logging: false
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('TiDB Connected Successfully.');
  } catch (error) {
    console.error('Unable to connect to TiDB:', error);
  }
};

module.exports = { sequelize, connectDB };
