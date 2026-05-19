const sendSMS = (phoneNumber, message) => {
  // In a real application, this would integrate with Twilio or another SMS API
  console.log(`[SMS OUTBOUND] Sent to ${phoneNumber}: "${message}"`);
  return true;
};

module.exports = { sendSMS };
