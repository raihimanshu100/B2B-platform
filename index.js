import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import routes from './routes.js';

dotenv.config();
const app = express();
const __dirname = path.resolve();

// Middleware to parse POST data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));         // ✅ Correct
app.use(express.static(path.join(__dirname, 'public')));

// All backend routes
app.use('/', routes);

// Default route (homepage)
app.get('/', (req, res) => {
  res.render('pages/login');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
