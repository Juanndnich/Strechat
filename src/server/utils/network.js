/**
 * strechat - Network Utility
 * Resolves local IPv4 network address for multi-device access (LAN mode).
 */

const os = require('os');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (127.0.0.1) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

module.exports = {
  getLocalIpAddress
};
