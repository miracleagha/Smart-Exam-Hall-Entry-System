const QRCode = require('../models/QRCode');

class QRCodeRepository {
  async create(data) {
    return QRCode.create(data);
  }

  async createMany(dataArray) {
    return QRCode.insertMany(dataArray);
  }

  async findById(id) {
    return QRCode.findById(id)
      .populate('studentId', 'firstName lastName otherName matricNumber department faculty level passportPhoto')
      .populate('examId', 'title courseCode examDate venue');
  }

  async findOne(query) {
    return QRCode.findOne(query);
  }

  async findByPayload(encryptedPayload) {
    return QRCode.findOne({ encryptedPayload })
      .populate('studentId', 'firstName lastName otherName matricNumber department faculty level passportPhoto status')
      .populate('examId', 'title courseCode examDate venue');
  }

  async findByStudentAndExam(studentId, examId) {
    return QRCode.findOne({
      studentId,
      examId,
      status: 'active',
    });
  }

  /**
   * Find the student's currently active identity QR (if any).
   */
  async findActiveIdentityQR(studentId) {
    return QRCode.findOne({
      studentId,
      type: 'student_identity',
      status: 'active',
    });
  }

  async findActiveForStudent(studentId) {
    return QRCode.find({
      studentId,
      status: 'active',
      expiresAt: { $gt: new Date() },
    })
      .populate('examId', 'title courseCode examDate startTime endTime venue status')
      .sort('-createdAt');
  }

  async findByExam(examId) {
    return QRCode.find({ examId })
      .populate('studentId', 'firstName lastName matricNumber')
      .sort('-createdAt');
  }

  async findPaginated(query = {}, page = 1, limit = 20, sort = '-createdAt') {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      QRCode.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('studentId', 'firstName lastName matricNumber')
        .populate('examId', 'title courseCode examDate'),
      QRCode.countDocuments(query),
    ]);
    return { data, total };
  }

  async update(id, data) {
    return QRCode.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async markUsed(id) {
    return QRCode.findByIdAndUpdate(
      id,
      {
        isUsed: true,
        usedAt: new Date(),
        status: 'used',
      },
      { new: true }
    );
  }

  /**
   * Bump usedAt for identity QRs without marking them as consumed.
   * Identity QRs are re-usable — each scan is a separate attendance event.
   */
  async touchUsage(id) {
    return QRCode.findByIdAndUpdate(id, { usedAt: new Date() }, { new: true });
  }

  async revokeByStudentAndExam(studentId, examId) {
    return QRCode.updateMany(
      { studentId, examId, status: 'active' },
      { status: 'revoked' }
    );
  }

  async revokeStudentIdentityQRs(studentId) {
    return QRCode.updateMany(
      { studentId, type: 'student_identity', status: 'active' },
      { status: 'revoked' }
    );
  }

  async findActiveExamQR(examId) {
    return QRCode.findOne({ examId, type: 'exam', status: 'active' });
  }

  async revokeExamQRs(examId) {
    return QRCode.updateMany(
      { examId, type: 'exam', status: 'active' },
      { status: 'revoked' }
    );
  }

  async expireOld() {
    return QRCode.updateMany(
      { expiresAt: { $lt: new Date() }, status: 'active' },
      { status: 'expired' }
    );
  }

  async count(query = {}) {
    return QRCode.countDocuments(query);
  }
}

module.exports = new QRCodeRepository();
