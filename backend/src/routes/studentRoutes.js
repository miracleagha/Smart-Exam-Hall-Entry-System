const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticate, authenticateStudent, authorize } = require('../middlewares/auth');
const { uploadPassport, uploadImport, optionalPassport } = require('../middlewares/upload');
const validate = require('../middlewares/validate');
const { createStudentValidation, updateStudentValidation } = require('../validations/studentValidation');

// ==========================================
// Student self-service routes (Student JWT)
// Note: passport photo is institution-controlled — no self-upload route.
// ==========================================
router.get('/me/profile', authenticateStudent, studentController.getMyProfile);
router.put('/me/profile', authenticateStudent, studentController.updateMyProfile);

// ==========================================
// Institution admin routes (Admin/Officer JWT)
// ==========================================
router.use(authenticate); // All routes below require institution auth

router.post(
  '/',
  authorize('institution_admin', 'exam_officer'),
  optionalPassport, // Accepts JSON or multipart/form-data with a passport file
  createStudentValidation,
  validate,
  studentController.createStudent
);

router.post(
  '/bulk-import',
  authorize('institution_admin'),
  uploadImport,
  studentController.bulkImport
);

router.get('/export', authorize('institution_admin'), studentController.exportStudents);
router.get(
  '/filter-options',
  authorize('institution_admin', 'exam_officer'),
  studentController.getFilterOptions
);
router.get('/', authorize('institution_admin', 'exam_officer'), studentController.getStudents);
router.get('/:id', authorize('institution_admin', 'exam_officer'), studentController.getStudent);

router.put(
  '/:id',
  authorize('institution_admin'),
  optionalPassport,
  updateStudentValidation,
  validate,
  studentController.updateStudent
);

router.patch('/:id/status', authorize('institution_admin'), studentController.updateStatus);

// Dedicated photo (re)upload — institution-only
router.put(
  '/:id/passport',
  authorize('institution_admin'),
  uploadPassport,
  studentController.updatePhoto
);

module.exports = router;
