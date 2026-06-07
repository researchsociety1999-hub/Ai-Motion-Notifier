// Local development entry point
// Starts the Express server with app.listen()
// Usage: node src/start.js  OR  npm run dev
require('dotenv').config();
const app = require('./server');
const { startTokenRefreshJob } = require('./services/tokenManager');

startTokenRefreshJob();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Ring AI Notifier running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
