import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', config.uploads.dir);

// Ensure the upload directory exists (Multer writes here; app.js serves it static).
fs.mkdirSync(uploadDir, { recursive: true });

// Map the (validated) MIME type to a safe extension. Deriving the extension
// from the MIME type — NOT from the client-controlled original filename —
// prevents an attacker storing e.g. `evil.html` that would later be served as
// HTML/script from the /uploads path.
const MIME_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};
const ALLOWED = new Set(Object.keys(MIME_EXT));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = MIME_EXT[file.mimetype] ?? '.bin';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (ALLOWED.has(file.mimetype)) return cb(null, true);
  cb(ApiError.badRequest('Only PNG, JPEG, GIF or WEBP screenshots are allowed'));
}

// Screenshot upload: up to 4 images, capped at the configured size each.
export const screenshotUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.uploads.maxMb * 1024 * 1024, files: 4 },
}).array('screenshots', 4);

// Map Multer's saved files to the public relative paths stored on the query.
export function uploadedPaths(req) {
  return (req.files ?? []).map((f) => `/${config.uploads.dir}/${f.filename}`);
}
