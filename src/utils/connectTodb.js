import mongoose from 'mongoose';
import { configDotenv } from 'dotenv';
configDotenv();

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('MongoDB connected')).catch(err => console.error('MongoDB connection error:', err));