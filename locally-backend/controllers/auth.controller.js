const jwt = require('jsonwebtoken');
const { User, Provider } = require('../models');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'supersecretkey_hackathon_2026', {
    expiresIn: '30d'
  });
};

const registerUser = async (req, res) => {
  const { name, fathersName, email, role, cnic, phone, dob, address, lat, lng } = req.body;
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
        phone,
        dob,
        address,
        lat: lat || 33.6425,
        lng: lng || 73.0768,
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
        phone,
        dob,
        address,
        cnic,
        lat: lat || 33.6425,
        lng: lng || 73.0768,
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
      // Try to find by demoCode first, then by email fallback
      let provider = await Provider.findOne({ where: { demoCode: 'PROV-2026' } });
      if (!provider && email) {
        provider = await Provider.findOne({ where: { email } });
      }
      if (!provider) {
        // Create with provided email or default
        const provEmail = email || `provider_demo_${Date.now()}@locally.pk`;
        try {
          provider = await Provider.create({
            name: 'Tariq Mehmood',
            fathersName: 'Mehmood Khan',
            email: provEmail,
            cnic: '37405-1234567-1',
            phone: '0300-1234567',
            address: 'Rawalpindi, Punjab',
            lat: 33.6425,
            lng: 73.0768,
            demoCode: 'PROV-2026',
            serviceType: 'Plumbing',
            isOnline: true
          });
        } catch (createErr) {
          // If email conflict, try with timestamp email
          provider = await Provider.create({
            name: 'Tariq Mehmood',
            fathersName: 'Mehmood Khan',
            email: `provider_${Date.now()}@locally.pk`,
            cnic: '37405-1234567-1',
            phone: '0300-1234567',
            address: 'Rawalpindi, Punjab',
            lat: 33.6425,
            lng: 73.0768,
            demoCode: 'PROV-2026',
            serviceType: 'Plumbing',
            isOnline: true
          });
        }
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
