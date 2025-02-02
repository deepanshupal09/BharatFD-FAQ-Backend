import app from './app';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis'

const PORT = process.env.PORT || 3000;

// Initialize connections
connectDB();
connectRedis();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});