const jwt = require('jsonwebtoken');
const { User, Provider } = require('../models');

// Memory-based blacklist for revoked refresh tokens (acts as Redis fallback in local/development mode)
const tokenBlacklist = new Set();

// Clean cookie options for httpOnly refresh tokens
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
};

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'supersecretkey_hackathon_2026', {
    expiresIn: '15m' // 15 minutes short-lived access token
  });
};

const generateRefreshToken = (id, role) => {
  return jwt.sign({ id, role, type: 'refresh' }, process.env.JWT_SECRET || 'supersecretkey_hackathon_2026', {
    expiresIn: '7d' // 7 days long-lived refresh token
  });
};

// ── Email Validation Logic (AbstractAPI Live + Dynamic Local Fallback) ──────
const validateEmailAddress = async (email) => {
  const apiKey = process.env.ABSTRACT_API_EMAIL_KEY;
  
  // Syntax validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Invalid email address syntax format.' };
  }

  // Disposable domain blacklists
  const disposableDomains = ['yopmail.com', 'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com'];
  const domain = email.split('@')[1].toLowerCase();
  if (disposableDomains.includes(domain)) {
    return { valid: false, message: 'Disposable temporary email addresses are not permitted.' };
  }

  if (apiKey && apiKey !== 'your_abstract_api_key_here') {
    try {
      const url = `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${email}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        // Check if format is invalid, deliverability is undeliverable, or if disposable
        if (data.is_valid_format?.value === false || data.deliverability === 'UNDELIVERABLE') {
          return { valid: false, message: 'Email inbox deliverability check failed (Domain or mailbox does not exist).' };
        }
        if (data.is_disposable_email?.value === true) {
          return { valid: false, message: 'Disposable emails are blocked.' };
        }
        return { valid: true };
      }
    } catch (fetchErr) {
      console.warn('[AbstractAPI] Connection error, using robust local filter fallback:', fetchErr.message);
    }
  }

  // Fallback to strict format filter
  return { valid: true };
};

// ── Registration Controller ───────────────────────────────────────────────────
const registerUser = async (req, res) => {
  const { name, fathersName, email, role, cnic, phone, dob, address, lat, lng } = req.body;
  try {
    // 1. Email syntax and domain sanity checks
    const emailCheck = await validateEmailAddress(email);
    if (!emailCheck.valid) {
      return res.status(400).json({ message: emailCheck.message });
    }

    if (role === 'provider') {
      let provider = await Provider.findOne({ where: { email } });
      if (provider) {
        return res.status(400).json({ message: 'Provider email already registered' });
      }

      // Generate a mock OTP for the verification flow simulation
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`\n========================================================`);
      console.log(`[ROZGO SMS OTP SIMULATOR] 📱 Generated Verification Code`);
      console.log(`Phone: ${phone}`);
      console.log(`OTP Code: ${generatedOtp}`);
      console.log(`========================================================\n`);
      
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
        isOnline: true,
        emailVerified: false,
        phoneVerified: false,
        trustBadges: [],
        fcmToken: req.body.fcmToken || null
      });

      // Generate Access and Refresh Tokens
      const token = generateToken(provider.id, 'provider');
      const refreshToken = generateRefreshToken(provider.id, 'provider');

      // Set cookie for refresh token
      res.cookie('refreshToken', refreshToken, cookieOptions);
      
      return res.status(201).json({
        token,
        role: 'provider',
        user: provider,
        otpSimulated: generatedOtp, // Output OTP for developer sandbox visual
        message: 'OTP Code sent successfully to registered phone number.'
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
        demoCode: 'USER-2026',
        emailVerified: false,
        phoneVerified: true // Auto-verify consumer phone for streamlined demo
      });

      const token = generateToken(user.id, 'consumer');
      const refreshToken = generateRefreshToken(user.id, 'consumer');

      res.cookie('refreshToken', refreshToken, cookieOptions);

      return res.status(201).json({
        token,
        role: 'consumer',
        user: user
      });
    }
  } catch (error) {
    console.error('Registration controller error:', error);
    res.status(500).json({ message: 'Server registration error' });
  }
};

// ── Login Controller ───────────────────────────────────────────────────────────
const loginUser = async (req, res) => {
  const { email, code } = req.body;
  const loginCode = code ? code.trim() : '';

  try {
    if (loginCode === 'PROV-2026') {
      let provider = await Provider.findOne({ where: { demoCode: 'PROV-2026' } });
      if (!provider && email) {
        provider = await Provider.findOne({ where: { email } });
      }
      if (!provider) {
        const provEmail = email || `provider_demo_${Date.now()}@locally.pk`;
        try {
          provider = await Provider.create({
            name: 'Tariq Mehmood',
            fathersName: 'Mehmood Khan',
            email: provEmail,
            cnic: '3740512345671',
            phone: '03001234567',
            address: 'Rawalpindi, Punjab',
            lat: 33.6425,
            lng: 73.0768,
            demoCode: 'PROV-2026',
            serviceType: 'Plumbing',
            isOnline: true,
            emailVerified: true,
            phoneVerified: true,
            trustBadges: ['VERIFIED_CNIC', 'PHONE_VERIFIED']
          });
        } catch (createErr) {
          provider = await Provider.create({
            name: 'Tariq Mehmood',
            fathersName: 'Mehmood Khan',
            email: `provider_${Date.now()}@locally.pk`,
            cnic: '3740512345671',
            phone: '03001234567',
            address: 'Rawalpindi, Punjab',
            lat: 33.6425,
            lng: 73.0768,
            demoCode: 'PROV-2026',
            serviceType: 'Plumbing',
            isOnline: true,
            emailVerified: true,
            phoneVerified: true,
            trustBadges: ['VERIFIED_CNIC', 'PHONE_VERIFIED']
          });
        }
      }

      const token = generateToken(provider.id, 'provider');
      const refreshToken = generateRefreshToken(provider.id, 'provider');

      res.cookie('refreshToken', refreshToken, cookieOptions);

      return res.json({
        token,
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
          demoCode: 'USER-2026',
          emailVerified: true,
          phoneVerified: true
        });
      }

      const token = generateToken(user.id, 'consumer');
      const refreshToken = generateRefreshToken(user.id, 'consumer');

      res.cookie('refreshToken', refreshToken, cookieOptions);

      return res.json({
        token,
        role: 'consumer',
        user: user
      });
    } else {
      let user = await User.findOne({ where: { email } });
      if (user) {
        const token = generateToken(user.id, 'consumer');
        const refreshToken = generateRefreshToken(user.id, 'consumer');

        res.cookie('refreshToken', refreshToken, cookieOptions);

        return res.json({
          token,
          role: 'consumer',
          user
        });
      }
      
      let provider = await Provider.findOne({ where: { email } });
      if (provider) {
        const token = generateToken(provider.id, 'provider');
        const refreshToken = generateRefreshToken(provider.id, 'provider');

        res.cookie('refreshToken', refreshToken, cookieOptions);

        return res.json({
          token,
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

// ── Refresh Token Rotation ───────────────────────────────────────────────────
const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ message: 'No refresh token provided.' });
  }

  if (tokenBlacklist.has(token)) {
    return res.status(403).json({ message: 'Refresh token has been revoked / blacklisted.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_hackathon_2026');
    
    // Revoke old token and rotate
    tokenBlacklist.add(token);

    // Issue newly rotated tokens
    const newAccessToken = generateToken(decoded.id, decoded.role);
    const newRefreshToken = generateRefreshToken(decoded.id, decoded.role);

    res.cookie('refreshToken', newRefreshToken, cookieOptions);

    res.json({
      token: newAccessToken,
      role: decoded.role
    });
  } catch (err) {
    res.status(403).json({ message: 'Invalid or expired refresh token.' });
  }
};

// ── Logout (Clears Cookies and Blacklists) ──────────────────────────────────
const logoutUser = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    tokenBlacklist.add(token);
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully.' });
};

// ── Mock OTP Code Verification Flow ──────────────────────────────────────────
const verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;
  
  if (!phone || !otp) {
    return res.status(400).json({ message: 'Phone number and verification OTP are required.' });
  }

  try {
    // Locate the provider using the phone number
    const provider = await Provider.findOne({ where: { phone } });
    if (!provider) {
      return res.status(404).json({ message: 'Service Provider not found.' });
    }

    // Accept any valid 6 digit OTP for simulation verification success
    if (otp.length === 6 && /^\d{6}$/.test(otp)) {
      provider.phoneVerified = true;
      provider.trustBadges = [...new Set([...(provider.trustBadges || []), 'PHONE_VERIFIED'])];
      await provider.save();

      return res.json({
        message: 'Phone number verified successfully!',
        user: provider
      });
    }

    res.status(400).json({ message: 'Invalid OTP code validation failed.' });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ message: 'Server verification error.' });
  }
};

module.exports = { 
  registerUser, 
  loginUser,
  refreshToken,
  logoutUser,
  verifyOtp
};
