const crypto = require('crypto');
const qrCodeRepository = require('../repositories/qrCodeRepository');
const studentRepository = require('../repositories/studentRepository');
const examRepository = require('../repositories/examRepository');
const attendanceRepository = require('../repositories/attendanceRepository');
const auditLogService = require('./auditLogService');
const { encrypt, decrypt } = require('../utils/encryption');
const { generateQRImage } = require('../utils/qrGenerator');
const { AppError } = require('../utils/helpers');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Serialize a student for API responses (safe fields only).
 */
const publicStudent = (student) => ({
  id: student._id,
  firstName: student.firstName,
  lastName: student.lastName,
  otherName: student.otherName || '',
  fullName: student.fullName,
  name: student.fullName,
  matricNumber: student.matricNumber,
  department: student.department,
  faculty: student.faculty,
  level: student.level,
  photo: student.passportPhoto,
  passportPhoto: student.passportPhoto,
  status: student.status,
});

class QRCodeService {
  /**
   * Return the student's active identity QR, generating one if it doesn't
   * exist or has expired. Called by GET /qrcodes/student/my-qr.
   */
  async getOrCreateStudentIdentityQR(studentId) {
    const student = await studentRepository.findById(studentId);
    if (!student) throw new AppError('Student not found.', 404);

    const existing = await qrCodeRepository.findActiveIdentityQR(studentId);
    if (existing && !existing.isExpired) {
      return existing;
    }

    return this._createIdentityQR(student);
  }

  /**
   * Force-regenerate the student's identity QR (revokes any active one).
   */
  async regenerateStudentIdentityQR(studentId) {
    const student = await studentRepository.findById(studentId);
    if (!student) throw new AppError('Student not found.', 404);

    await qrCodeRepository.revokeStudentIdentityQRs(studentId);
    return this._createIdentityQR(student);
  }

  /**
   * Internal: mint a fresh identity QR for a student.
   */
  async _createIdentityQR(student) {
    // Encrypted payload is intentionally minimal — it's just an unforgeable
    // fingerprint. Real identity comes from the DB record we look up by
    // encryptedPayload. This keeps the QR dense enough for phone cameras.
    const payload = {
      k: 'sid', // "student identity" marker
      s: student._id.toString(),
      t: Date.now(),
      n: crypto.randomBytes(8).toString('hex'),
    };
    const encryptedPayload = encrypt(payload);

    const expiresAt = new Date(
      Date.now() + env.STUDENT_QR_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    const filename = `student_qr_${student._id}_${Date.now()}`;
    const qrImage = await generateQRImage(encryptedPayload, filename);

    const qrCode = await qrCodeRepository.create({
      studentId: student._id,
      institutionId: student.institutionId?._id || student.institutionId,
      type: 'student_identity',
      examId: null,
      encryptedPayload,
      qrImagePath: qrImage.filePath,
      qrBase64: qrImage.base64,
      expiresAt,
      generatedBy: student._id,
    });

    await auditLogService.log({
      userId: student._id,
      userType: 'student',
      action: 'STUDENT_QR_GENERATED',
      resource: 'QRCode',
      resourceId: qrCode._id,
      institutionId: student.institutionId?._id || student.institutionId,
      details: { matricNumber: student.matricNumber },
    });

    logger.info(`Student identity QR generated: ${student.matricNumber}`);
    return qrCode;
  }

  /**
   * Institution scans a student's identity QR.
   *
   * Behaviour:
   *   1. Decrypt + look up the QR record (must be a valid identity QR
   *      belonging to the scanning institution).
   *   2. Return the student's info (name, matric, photo, dept, level).
   *   3. If examId is provided AND the student is registered, record an
   *      attendance row for that exam (idempotent — duplicates report
   *      ALREADY_VERIFIED but still return student info so staff can
   *      visually confirm identity).
   */
  async scanStudentQR(encryptedPayload, verifiedBy, institutionId, examId = null) {
    encryptedPayload = (encryptedPayload || '').toString().trim();
    if (!encryptedPayload) {
      return {
        verified: false,
        reason: 'Empty QR payload received.',
        status: 'INVALID',
      };
    }

    // Step 1: Decrypt (contents aren't trusted — decrypt success just proves
    // it was minted by us).
    try {
      decrypt(encryptedPayload);
    } catch (error) {
      logger.warn(`Student QR scan failed: decryption error — ${error.message}`);
      return {
        verified: false,
        reason: 'Invalid QR code. Could not decrypt payload.',
        status: 'INVALID',
      };
    }

    // Step 2: Find QR record
    const qrCode = await qrCodeRepository.findByPayload(encryptedPayload);
    if (!qrCode) {
      return {
        verified: false,
        reason: 'QR code not found in system.',
        status: 'NOT_FOUND',
      };
    }

    // Step 3: Must be a student-identity QR
    if (qrCode.type !== 'student_identity' || !qrCode.studentId) {
      return {
        verified: false,
        reason: 'This is not a student identity QR code.',
        status: 'WRONG_TYPE',
      };
    }

    // Step 4: Institution scope
    if (qrCode.institutionId.toString() !== institutionId.toString()) {
      return {
        verified: false,
        reason: 'This QR belongs to a different institution.',
        status: 'WRONG_INSTITUTION',
      };
    }

    // Step 5: Expiry / revocation
    if (qrCode.expiresAt < new Date() || qrCode.status === 'expired') {
      return {
        verified: false,
        reason: 'This QR code has expired. Ask the student to regenerate it.',
        status: 'EXPIRED',
        student: publicStudent(qrCode.studentId),
      };
    }
    if (qrCode.status === 'revoked') {
      return {
        verified: false,
        reason: 'This QR code has been revoked.',
        status: 'REVOKED',
        student: publicStudent(qrCode.studentId),
      };
    }

    // Step 6: Student account status
    const student = qrCode.studentId; // populated
    if (student.status !== 'active') {
      return {
        verified: false,
        reason: `Student account is ${student.status}.`,
        status: 'STUDENT_INACTIVE',
        student: publicStudent(student),
      };
    }

    // Step 7: If no exam context, just return the student's info.
    if (!examId) {
      // Touch usage timestamp so we know when it was last shown.
      await qrCodeRepository.touchUsage(qrCode._id);

      await auditLogService.log({
        userId: verifiedBy,
        userType: 'user',
        action: 'STUDENT_QR_SCANNED',
        resource: 'QRCode',
        resourceId: qrCode._id,
        institutionId,
        details: { matricNumber: student.matricNumber, mode: 'identity-only' },
      });

      return {
        verified: true,
        status: 'IDENTITY_CONFIRMED',
        message: 'Student identified.',
        student: publicStudent(student),
        exam: null,
        attendance: null,
      };
    }

    // Step 8: Exam context — validate + record attendance
    const exam = await examRepository.findById(examId);
    if (!exam) {
      return {
        verified: false,
        reason: 'Selected exam not found.',
        status: 'EXAM_NOT_FOUND',
        student: publicStudent(student),
      };
    }
    if (exam.institutionId.toString() !== institutionId.toString()) {
      return {
        verified: false,
        reason: 'Selected exam does not belong to your institution.',
        status: 'WRONG_INSTITUTION',
        student: publicStudent(student),
      };
    }

    // Student must be registered for this exam
    const isRegistered =
      Array.isArray(exam.registeredStudents) &&
      exam.registeredStudents.some((id) => id.toString() === student._id.toString());
    if (!isRegistered) {
      return {
        verified: false,
        reason: 'Student is not registered for this exam.',
        status: 'NOT_REGISTERED',
        student: publicStudent(student),
        exam: this._publicExam(exam),
      };
    }

    // Duplicate check
    const existingAttendance = await attendanceRepository.findByStudentAndExam(
      student._id,
      exam._id
    );
    if (existingAttendance) {
      return {
        verified: false,
        reason: 'Student has already been verified for this exam.',
        status: 'ALREADY_VERIFIED',
        student: publicStudent(student),
        exam: this._publicExam(exam),
        attendance: existingAttendance.toJSON ? existingAttendance.toJSON() : existingAttendance,
      };
    }

    // Record attendance
    const attendance = await attendanceRepository.create({
      studentId: student._id,
      examId: exam._id,
      institutionId,
      qrCodeId: qrCode._id,
      verifiedBy,
      verificationStatus: 'verified',
      verifiedAt: new Date(),
    });

    await qrCodeRepository.touchUsage(qrCode._id);

    await auditLogService.log({
      userId: verifiedBy,
      userType: 'user',
      action: 'QR_VERIFIED',
      resource: 'Attendance',
      resourceId: attendance._id,
      institutionId,
      details: {
        studentMatric: student.matricNumber,
        examTitle: exam.title,
        courseCode: exam.courseCode,
      },
    });

    logger.info(`Attendance recorded: ${student.matricNumber} for ${exam.courseCode}`);

    return {
      verified: true,
      status: 'VERIFIED',
      message: 'Student verified and attendance recorded.',
      student: publicStudent(student),
      exam: this._publicExam(exam),
      attendance: attendance.toJSON ? attendance.toJSON() : attendance,
    };
  }

  _publicExam(exam) {
    return {
      id: exam._id,
      title: exam.title,
      courseCode: exam.courseCode,
      venue: exam.venue,
      examDate: exam.examDate,
      startTime: exam.startTime,
      endTime: exam.endTime,
    };
  }

  /**
   * Get QR code details
   */
  async getQRCodeById(qrCodeId) {
    const qrCode = await qrCodeRepository.findById(qrCodeId);
    if (!qrCode) throw new AppError('QR code not found.', 404);
    return qrCode;
  }

  /**
   * List all active student identity QRs for an institution.
   * Powers the institution "QR Registry" view.
   */
  async listInstitutionIdentityQRs(institutionId) {
    const { data } = await qrCodeRepository.findPaginated(
      { institutionId, type: 'student_identity', status: 'active' },
      1,
      500,
      '-createdAt'
    );
    return data;
  }
}

module.exports = new QRCodeService();
