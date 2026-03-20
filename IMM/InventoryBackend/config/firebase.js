const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

if (!admin.apps.length) {
  const isFirebaseRuntime = Boolean(process.env.FIREBASE_CONFIG);
  const serviceAccountPath = path.join(__dirname, "..", "service-account.json");

  if (!isFirebaseRuntime && fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
