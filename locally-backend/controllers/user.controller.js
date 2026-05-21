const { User, Provider } = require('../models');

// Pakistan-standard validation helpers
const validateCNIC = (cnic) => /^\d{13}$/.test(cnic.trim());
const validatePhone = (phone) => /^(\+92|0)(3\d{9}|[0-9]{9,10})$/.test(phone.replace(/[\s-]/g, ''));
const validateName = (name) => name && name.trim().length >= 2 && name.trim().length <= 100;
const validateDOB = (dob) => {
  if (!dob) return false;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return false;
  const age = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return age >= 10 && age <= 120;
};

const getProfile = async (req, res) => {
  try {
    const { id, role } = req.user;
    let profile;

    if (role === 'provider') {
      profile = await Provider.findByPk(id);
      if (!profile) return res.status(404).json({ message: 'Provider not found' });
    } else {
      profile = await User.findByPk(id);
      if (!profile) return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ profile, role });
  } catch (error) {
    console.error('getProfile error:', error);
    return res.status(500).json({ message: 'Server error fetching profile' });
  }
};

const updateProfile = async (req, res) => {
  const { name, fathersName, phone, address, dob, cnic, lat, lng, manualLocation } = req.body;
  const errors = [];

  // Server-side Pakistan validation
  if (name !== undefined && !validateName(name)) {
    errors.push('Name must be between 2 and 100 characters.');
  }
  if (fathersName !== undefined && fathersName !== '' && !validateName(fathersName)) {
    errors.push('Fathers Name must be between 2 and 100 characters.');
  }
  if (cnic !== undefined && cnic !== '' && !validateCNIC(cnic)) {
    errors.push('Please enter a valid 13-digit Pakistani CNIC number.');
  }
  if (phone !== undefined && phone !== '' && !validatePhone(phone)) {
    errors.push('Phone must be a valid Pakistani number (e.g. 03001234567 or +923001234567)');
  }
  if (dob !== undefined && dob !== '' && !validateDOB(dob)) {
    errors.push('Date of birth is not valid or indicates an impossible age.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  try {
    const { id, role } = req.user;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (fathersName !== undefined) updates.fathersName = fathersName.trim();
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (dob !== undefined) updates.dob = dob;
    if (cnic !== undefined) updates.cnic = cnic;
    if (lat !== undefined) updates.lat = lat;
    if (lng !== undefined) updates.lng = lng;
    if (manualLocation !== undefined) updates.manualLocation = manualLocation;

    let profile;
    if (role === 'provider') {
      await Provider.update(updates, { where: { id } });
      profile = await Provider.findByPk(id);
    } else {
      await User.update(updates, { where: { id } });
      profile = await User.findByPk(id);
    }

    return res.json({ message: 'Profile updated successfully', profile });
  } catch (error) {
    console.error('updateProfile error:', error);
    return res.status(500).json({ message: 'Server error updating profile' });
  }
};

const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please select a profile picture to upload.' });
    }

    const { id, role } = req.user;
    const picturePath = `/uploads/profiles/${req.file.filename}`;

    if (role === 'provider') {
      await Provider.update({ profilePicture: picturePath }, { where: { id } });
    } else {
      await User.update({ profilePicture: picturePath }, { where: { id } });
    }

    console.log(`[ROZGO] Profile picture uploaded for ${role} #${id}: ${picturePath}`);

    return res.json({
      message: 'Profile picture uploaded successfully.',
      profilePicture: picturePath
    });
  } catch (error) {
    console.error('uploadProfilePicture error:', error);
    return res.status(500).json({ message: 'Server error uploading profile picture' });
  }
};

module.exports = { getProfile, updateProfile, uploadProfilePicture };
