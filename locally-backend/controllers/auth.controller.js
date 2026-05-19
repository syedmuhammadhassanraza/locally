const jwt = require('jsonwebtoken');
const { User, Provider } = require('../models');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'supersecretkey_hackathon_2026', {
    expiresIn: '30d'
  });
};

const registerUser = async (req, res) => {
  const { name, fathersName, email, role, cnic } = req.body;
  try {
    if (role === 'provider') {
      let provider = await Provider.findOne({ where: { email } });
      if (provider) {
        return res.status(400).json({ message: 'Provider email already registered' });
      }
      
      provider = await Provider.create({
        name,
        fathersName,
        email,
        cnic,
        demoCode: 'PROV-2026',
        serviceType: 'Plumbing',
        isOnline: true
      });
      
      return res.status(201).json({
        token: generateToken(provider.id, 'provider'),
        role: 'provider',
        user: provider
      });
    } else {
      let user = await User.findOne({ where: { email } });
      if (user) {
        return res.status(400).json({ message: 'Consumer email already registered' });
      }

      user = await User.create({
        name,
        fathersName,
        email,
        demoCode: 'USER-2026'
      });

      return res.status(201).json({
        token: generateToken(user.id, 'consumer'),
        role: 'consumer',
        user: user
      });
    }
  } catch (error) {
    console.error('Registration controller error:', error);
    res.status(500).json({ message: 'Server registration error' });
  }
};

const loginUser = async (req, res) => {
  const { email, code } = req.body;
  const loginCode = code ? code.trim() : '';

  try {
    if (loginCode === 'PROV-2026') {
      let provider = await Provider.findOne({ where: { demoCode: 'PROV-2026' } });
      if (!provider) {
        provider = await Provider.create({
          name: 'Tariq Mehmood',
          fathersName: 'Mehmood Khan',
          email: email || 'tariq@example.com',
          cnic: '37405-1234567-1',
          demoCode: 'PROV-2026',
          serviceType: 'Plumbing',
          isOnline: true
        });
      }
      return res.json({
        token: generateToken(provider.id, 'provider'),
        role: 'provider',
        user: provider
      });
    } else if (loginCode === 'USER-2026') {
      let user = await User.findOne({ where: { demoCode: 'USER-2026' } });
      if (!user) {
        user = await User.create({
          name: 'Ali Hassan',
          fathersName: 'Muhammad Hassan',
          email: email || 'ali@example.com',
          demoCode: 'USER-2026'
        });
      }
      return res.json({
        token: generateToken(user.id, 'consumer'),
        role: 'consumer',
        user: user
      });
    } else {
      // Fallback fallback: check if user/provider exists by email
      let user = await User.findOne({ where: { email } });
      if (user) {
        return res.json({
          token: generateToken(user.id, 'consumer'),
          role: 'consumer',
          user
        });
      }
      let provider = await Provider.findOne({ where: { email } });
      if (provider) {
        return res.json({
          token: generateToken(provider.id, 'provider'),
          role: 'provider',
          user: provider
        });
      }
      return res.status(400).json({ message: 'Invalid Credentials or Demo Code' });
    }
  } catch (error) {
    console.error('Login controller error:', error);
    res.status(500).json({ message: 'Server login error' });
  }
};

module.exports = { registerUser, loginUser };
