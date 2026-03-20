const { onRequest } = require("firebase-functions/v2/https");
const app = require("./app");

exports.api = onRequest(app);
