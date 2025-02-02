import express from 'express';
import bodyParser from 'body-parser';
import faqRoutes from './routes/faqRoutes';

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/faq', faqRoutes);
export default app;