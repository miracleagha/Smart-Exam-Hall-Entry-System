const Exam = require('../models/Exam');

class ExamRepository {
  async create(data) {
    return Exam.create(data);
  }

  async findById(id) {
    return Exam.findById(id)
      .populate('assignedOfficers', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName');
  }

  async findOne(query) {
    return Exam.findOne(query);
  }

  async findMany(query = {}, options = {}) {
    const { sort = '-examDate', populate = '' } = options;
    return Exam.find(query).sort(sort).populate(populate);
  }

  async findPaginated(query = {}, page = 1, limit = 20, sort = '-examDate') {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Exam.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('assignedOfficers', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName'),
      Exam.countDocuments(query),
    ]);
    return { data, total };
  }

  async findByInstitution(institutionId, filters = {}) {
    const query = { institutionId };
    if (filters.status) query.status = filters.status;
    if (filters.department) query.department = filters.department;
    if (filters.level) query.level = filters.level;
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { courseCode: { $regex: filters.search, $options: 'i' } },
      ];
    }
    return query;
  }

  /**
   * Exams the student is registered for AND are currently active
   * (in progress today).
   */
  async findActiveForStudent(institutionId, studentId) {
    return Exam.find({
      institutionId,
      registeredStudents: studentId,
      status: 'active',
    }).sort('examDate');
  }

  /**
   * Exams the student is registered for that haven't happened yet.
   * Sorted earliest-first so the very next exam shows on top.
   *
   * We don't strictly require `status: 'upcoming'` — the date is the source
   * of truth so an exam whose status was left as 'active' still surfaces
   * here as long as its date is today or later. Completed/archived exams
   * are always excluded.
   */
  async findUpcomingForStudent(institutionId, studentId) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return Exam.find({
      institutionId,
      registeredStudents: studentId,
      status: { $nin: ['completed', 'archived'] },
      examDate: { $gte: startOfToday },
    }).sort('examDate');
  }

  /**
   * Exams the student registered for that have already passed OR were
   * marked completed/archived. Sorted most-recent-first.
   */
  async findHistoryForStudent(institutionId, studentId) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return Exam.find({
      institutionId,
      registeredStudents: studentId,
      $or: [
        { status: { $in: ['completed', 'archived'] } },
        { examDate: { $lt: startOfToday } },
      ],
    }).sort('-examDate');
  }

  /**
   * Every exam the institution posted whose date hasn't passed and the
   * student hasn't registered for yet. No department or level filtering —
   * the student sees the full active catalogue and picks what they need.
   *
   * Sorted earliest-first so the most imminent exam is at the top.
   */
  // eslint-disable-next-line no-unused-vars
  async findAvailableForStudent(institutionId, studentId, department, level) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return Exam.find({
      institutionId,
      status: { $nin: ['completed', 'archived'] },
      examDate: { $gte: startOfToday },
      registeredStudents: { $ne: studentId },
    }).sort('examDate');
  }

  async findRegisteredForStudent(institutionId, studentId) {
    return Exam.find({
      institutionId,
      registeredStudents: studentId,
    }).sort('-examDate');
  }

  async isStudentRegistered(examId, studentId) {
    const exists = await Exam.exists({ _id: examId, registeredStudents: studentId });
    return !!exists;
  }

  async registerStudent(examId, studentId) {
    return Exam.findByIdAndUpdate(
      examId,
      { $addToSet: { registeredStudents: studentId } },
      { new: true }
    );
  }

  async unregisterStudent(examId, studentId) {
    return Exam.findByIdAndUpdate(
      examId,
      { $pull: { registeredStudents: studentId } },
      { new: true }
    );
  }

  async update(id, data) {
    return Exam.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async delete(id) {
    return Exam.findByIdAndDelete(id);
  }

  async count(query = {}) {
    return Exam.countDocuments(query);
  }
}

module.exports = new ExamRepository();
