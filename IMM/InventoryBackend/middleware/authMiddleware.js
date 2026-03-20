const { auth, db } = require("../config/firebase");
const { verifyAdminSessionToken } = require("../utils/adminSession");

/**
 * Verifies Firebase ID token sent in Authorization header.
 * Attaches decoded user + Firestore user doc to req.user.
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No token provided",
      });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const adminSession = verifyAdminSessionToken(idToken);

    // Accept backend-issued admin session token (for admin dashboard login flow)
    if (adminSession) {
      req.user = {
        uid: `admin:${adminSession.email}`,
        email: adminSession.email,
        role: adminSession.role,
        status: "active",
        authType: "admin-session",
      };
      return next();
    }

    // Verify token with Firebase Auth
    const decodedToken = await auth.verifyIdToken(idToken);

    // Fetch user record from Firestore (to get role, status, etc.)
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User record not found",
      });
    }

    const userData = userDoc.data();

    // Block deactivated accounts
    if (userData.status === "inactive") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Account is deactivated",
      });
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: userData.role,
      ...userData,
    };

    next();
  } catch (error) {
    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Token expired",
      });
    }
    if (error.code === "auth/argument-error") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid token",
      });
    }
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication",
    });
  }
};

/**
 * Role-based access control factory.
 * Usage: requireRole("admin") or requireRole(["admin", "manager"])
 */
const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Requires role(s): ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
};

module.exports = { verifyToken, requireRole };
