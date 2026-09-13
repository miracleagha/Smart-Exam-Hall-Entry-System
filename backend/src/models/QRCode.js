const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      // Optional for legacy 'exam'-type shared codes.
      // Required for 'student_identity' (enforced in service layer).
      required: false,
      default: null,
    },
    type: {
      type: String,
      // 'student_identity' — a per-student QR the student owns and prints.
      // Institution scans it to identify the student and record attendance.
      // 'student' / 'exam' — legacy institution-generated flows (kept for
      // backwards compatibility with older records).
      enum: ['student_identity', 'student', 'exam'],
      default: 'student_identity',
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      // Optional — student identity QRs are not tied to any specific exam.
      required: false,
      default: null,
    },
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
    },
    encryptedPayload: {
      type: String,
      required: true,
      unique: true,
    },
    qrImagePath: {
      type: String,
      default: null,
    },
    qrBase64: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'used', 'revoked'],
      default: 'active',
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      // 'generatedBy' may be a User (institution admin) OR a Student
      // (for self-generated identity QRs). Left un-refPathed and treated
      // as an opaque id.
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
qrCodeSchema.index({ studentId: 1, type: 1, status: 1 });
qrCodeSchema.index({ institutionId: 1, examId: 1 });
qrCodeSchema.index({ status: 1 });
qrCodeSchema.index({ expiresAt: 1 });

// Virtual: check if expired
qrCodeSchema.virtual('isExpired').get(function () {
  return this.expiresAt < new Date();
});

module.exports = mongoose.model('QRCode', qrCodeSchema);
