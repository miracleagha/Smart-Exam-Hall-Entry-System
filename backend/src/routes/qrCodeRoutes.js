const express = require('express');
const router = express.Router();
const qrCodeController = require('../controllers/qrCodeController');
const { authenticate, authenticateStudent, authorize } = require('../middlewares/auth');
const { verifyLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { scanStudentQRValidation } = require('../validations/qrCodeValidation');

// ==========================================
// Student QR routes (Student JWT)
// ==========================================
// Student gets / regenerates their own identity QR
router.get('/student/my-qr', authenticateStudent, qrCodeController.getMyQR);
router.post('/student/regenerate', authenticateStudent, qrCodeController.regenerateMyQR);

// ==========================================
// Institution routes (Admin/Officer JWT)
// ==========================================
router.use(authenticate);

// Scan a student's identity QR (optionally records exam attendance)
router.post(
  '/scan-student',
  authorize('institution_admin', 'exam_officer'),
  verifyLimiter,
  scanStudentQRValidation,
  validate,
  qrCodeController.scanStudent
);

// Backwards-compatible alias: some clients may still POST to /verify.
router.post(
  '/verify',
  authorize('institution_admin', 'exam_officer'),
  verifyLimiter,
  scanStudentQRValidation,
  validate,
  qrCodeController.scanStudent
);

// Registry of active student identity QRs (for institution overview)
router.get(
  '/institution/identity',
  authorize('institution_admin', 'exam_officer'),
  qrCodeController.listInstitutionIdentityQRs
);

// Single QR detail lookup
router.get('/:id', authorize('institution_admin', 'exam_officer'), qrCodeController.getQRCode);

module.exports = router;
