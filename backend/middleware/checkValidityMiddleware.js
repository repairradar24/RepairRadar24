function checkSubscription(req, res, next) {
  // This middleware runs *after* the auth middleware,
  // so req.user will already be populated from the JWT.

  if (req.user && req.user.isExpired) {
    console.log(`Access denied for user: ${req.user.email} (Subscription expired)`);
    return res.status(403).json({
      error: 'Access denied. Your subscription has expired. Please renew your pack.'
    });
  }

  // If we are here, the user is not expired. Proceed.
  next();
}

module.exports = checkSubscription;