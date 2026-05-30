require('dotenv').config();
const express = require('express');
const cors = require('cors');
const publicRoutes = require('./routes/public');

const app = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

app.use('/api/public', publicRoutes);

app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  servicio: 'CLOUD',
  descripcion: 'Servidor Cloud — eCommerce AlimaCorp',
  arquitectura: 'nube',
  ambiente: process.env.NODE_ENV || 'production',
  timestamp: new Date(),
}));

app.get('/', (req, res) => res.json({
  mensaje: 'ERP AlimaCorp — Servidor Cloud eCommerce',
  endpoints: ['/api/health', '/api/public/productos', '/api/public/categorias', '/api/public/stats'],
}));

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`☁️  Servidor CLOUD corriendo en puerto ${PORT}`));
