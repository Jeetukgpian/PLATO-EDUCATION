const admin = require('firebase-admin');
const serviceAccount = require('../config/plato-education-71e05-firebase-adminsdk-n6r08-b9308033e3.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
