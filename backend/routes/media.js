// media.js — single-image upload (Owner: Member B).
// Stores the file under UPLOAD_DIR and returns an absolute URL built from BASE_URL.
// server.js already serves UPLOAD_DIR at /uploads (with cross-origin CORP for images).
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(import.meta.dirname, '..', 'uploads'));
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed'));
  },
});

// POST /api/media — field name "image". Returns { url }.
// multer errors (too large, non-image) are mapped to 400 instead of a 500.
router.post('/', requireAuth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5MB or smaller' : err.message;
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    res.status(201).json({ url: `${BASE_URL}/uploads/${req.file.filename}` });
  });
});

export default router;
