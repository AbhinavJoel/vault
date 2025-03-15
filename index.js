const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { Readable } = require('stream');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Logging setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/app.log' }),
    new winston.transports.Console(),
  ],
});

app.use(express.json());
app.use(express.static('public')); // Serve static files from 'public' folder

const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 60000,
  max: process.env.RATE_LIMIT_MAX || 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

logger.info('Starting app...', { mongoUri: process.env.MONGO_URI });
const conn = mongoose.createConnection(process.env.MONGO_URI);

let gfs;

conn.once('open', () => {
  logger.info('Connected to MongoDB');
  gfs = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'uploads' });
});

conn.on('error', (err) => {
  logger.error('MongoDB connection error', { error: err.message });
  process.exit(1);
});

const upload = multer({ storage: multer.memoryStorage() });

app.get('/', (req, res) => {
  logger.info('GET / accessed', { ip: req.ip });
  res.sendFile(path.join(__dirname, 'public', 'index.html')); // Serve frontend
});

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      logger.warn('No file uploaded', { ip: req.ip });
      return res.status(400).json({ message: 'No file uploaded' });
    }
    if (!gfs) {
      logger.warn('Database not ready', { ip: req.ip });
      return res.status(503).json({ message: 'Database not ready' });
    }
    const { originalname, buffer, size } = req.file;
    const filename = `${Date.now()}-${originalname}`;
    const readableStream = Readable.from(buffer);
    const writeStream = gfs.openUploadStream(filename, {
      metadata: {
        originalName: originalname,
        uploadDate: new Date(),
        size: size,
      },
    });
    readableStream.pipe(writeStream);
    writeStream.on('finish', () => {
      logger.info('File uploaded', { filename, id: writeStream.id, ip: req.ip });
      res.status(200).json({
        message: 'Image uploaded successfully',
        file: {
          filename,
          originalName: originalname,
          uploadDate: writeStream.options.metadata.uploadDate,
          size: size,
          id: writeStream.id,
        },
      });
    });
    writeStream.on('error', (err) => {
      logger.error('GridFS write error', { error: err.message, ip: req.ip });
      res.status(500).json({ message: 'Error uploading file', error: err.message });
    });
  } catch (err) {
    logger.error('Upload error', { error: err.message, ip: req.ip });
    res.status(500).json({ message: 'Server error during upload', error: err.message });
  }
});

app.get('/image/:id', async (req, res) => {
  try {
    if (!gfs) {
      logger.warn('Database not ready', { ip: req.ip });
      return res.status(503).json({ message: 'Database not ready' });
    }
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const files = await conn.db.collection('uploads.files').find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      logger.warn('File not found', { id: req.params.id, ip: req.ip });
      return res.status(404).json({ message: 'File not found' });
    }
    const file = files[0];
    const contentType = file.metadata.originalName.match(/\.(jpg|jpeg|png|gif)$/i)
      ? `image/${file.metadata.originalName.split('.').pop().toLowerCase()}`
      : 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `inline; filename="${file.metadata.originalName}"`);
    const readStream = gfs.openDownloadStream(fileId);
    readStream.pipe(res);
    readStream.on('error', (err) => {
      logger.error('GridFS read error', { error: err.message, id: req.params.id, ip: req.ip });
      res.status(500).json({ message: 'Error streaming file', error: err.message });
    });
    readStream.on('end', () => {
      logger.info('File streamed', { id: req.params.id, ip: req.ip });
    });
  } catch (err) {
    logger.error('Download error', { error: err.message, id: req.params.id, ip: req.ip });
    res.status(500).json({ message: 'Server error during download', error: err.message });
  }
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});