const { firebaseAdmin } = require('./dist/config/firebase.js');

async function main() {
  const token = 'Ae0iMNdhkymTml557bDHHVT-eM1PKPmYHNpA1dnPwARZo7K6CYLRhIHOuFZUr1EYteGNNMrKLA_I_mFdAjZ6AeEFMGmrcMLJo84wyE6Lv3DL79adKPVk22HDIDijrQu4tB7T5RLX-thYLBVdwYXpkjzgZA';
  
  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    console.log('Successfully decoded token!');
    console.log('Phone number:', decodedToken.phone_number);
    console.log('UID:', decodedToken.uid);
  } catch (error) {
    console.error('Error verifying token:', error);
  }
}

main().then(() => process.exit(0));
