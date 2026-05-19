const sendNotification = (userId, message) => {
  // In a real production app, this would use firebase-admin SDK to send a push notification
  console.log(`[PUSH NOTIFICATION] Sent to user/provider ${userId}: "${message}"`);
  return true;
};

module.exports = { sendNotification };
