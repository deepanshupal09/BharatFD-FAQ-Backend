import dotenv from "dotenv";
import mongoose from 'mongoose';
import { FAQ } from '../model/faqModel';

dotenv.config();

export const connectDB = async () => {
  try {
        // console.log(`process.env.MONGO_URI: ${process.env.MONGO_URI}`);
        const conn = await mongoose.connect(process.env.MONGO_URI!);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // Initialize model if not exists
        FAQ.init();
  } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
  }
};