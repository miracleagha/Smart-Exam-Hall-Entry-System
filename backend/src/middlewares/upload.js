const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

// Ensure directories exist
const dirs = ['passports', 'logos', 'imports', 'qrcodes'];
dirs.forEach((dir) => {
  const dirPath = path.join(uploadsDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

/**
 * Storage config for passport photos
 */
const passportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(uploadsDir, 'passports'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `passport_${uniqueSuffix}${ext}`);
  },
});

/**
 * Storage config for institution logos
 */
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(uploadsDir, 'logos'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `logo_${uniqueSuffix}${ext}`);
  },
});

/**
 * Storage config for CSV/Excel imports (in memory)
 */
const importStorage = multer.memoryStorage();

/**
 * File filter for images only
 */
const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowed.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
};

/**
 * File filter for CSV/Excel
 */
const importFilter = (req, file, cb) => {
  const allowed = /csv|xlsx|xls/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());

  if (extname) {
    return cb(null, true);
  }
  cb(new Error('Only CSV and Excel files are allowed'));
};

// Upload middleware instances
const uploadPassport = multer({
  storage: passportStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter,
}).single('passportPhoto');

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter,
}).single('logo');

const uploadImport = multer({
  storage: importStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: importFilter,
}).single('file');

/**
 * Optional passport upload — passes through unchanged for JSON requests
 * and stores the file for multipart requests. Used on POST/PUT /students.
 */
const optionalPassport = (req, res, next) => {
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (!contentType.startsWith('multipart/form-data')) {
    return next();
  }
  return uploadPassport(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next();
  });
};

module.exports = { uploadPassport, uploadLogo, uploadImport, optionalPassport };
