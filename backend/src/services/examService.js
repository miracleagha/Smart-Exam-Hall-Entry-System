const examRepository = require('../repositories/examRepository');
const auditLogService = require('./auditLogService');
const { AppError, getPaginationMeta, parsePaginationQuery } = require('../utils/helpers');

class ExamService {
  async createExam(data, institutionId, userId) {
    const exam = await examRepository.create({
      ...data,
      institutionId,
      createdBy: userId,
    });

    await auditLogService.log({
      userId,
      userType: 'user',
      action: 'EXAM_CREATED',
      resource: 'Exam',
      resourceId: exam._id,
      institutionId,
      details: { title: exam.title, courseCode: exam.courseCode },
    });

    return exam;
  }

  async getExams(institutionId, queryParams) {
    const { page, limit, sort } = parsePaginationQuery(queryParams);

    const query = await examRepository.findByInstitution(institutionId, {
      status: queryParams.status,
      department: queryParams.department,
      level: queryParams.level,
      search: queryParams.search,
    });

    const { data, total } = await examRepository.findPaginated(query, page, limit, sort);

    return {
      exams: data,
      pagination: getPaginationMeta(page, limit, total),
    };
  }

  async getExamById(examId, institutionId) {
    const exam = await examRepository.findById(examId);
    if (!exam) {
      throw new AppError('Exam not found.', 404);
    }

    if (exam.institutionId.toString() !== institutionId.toString()) {
      throw new AppError('Exam not found.', 404);
    }

    return exam;
  }

  async updateExam(examId, data, institutionId, userId) {
    await this.getExamById(examId, institutionId);

    delete data.institutionId;
    delete data.createdBy;

    const updated = await examRepository.update(examId, data);

    await auditLogService.log({
      userId,
      userType: 'user',
      action: 'EXAM_UPDATED',
      resource: 'Exam',
      resourceId: examId,
      institutionId,
      details: { updatedFields: Object.keys(data) },
    });

    return updated;
  }

  async deleteExam(examId, institutionId, userId) {
    const exam = await this.getExamById(examId, institutionId);

    await examRepository.delete(examId);

    await auditLogService.log({
      userId,
      userType: 'user',
      action: 'EXAM_DELETED',
      resource: 'Exam',
      resourceId: examId,
      institutionId,
      details: { title: exam.title },
    });

    return exam;
  }

  async updateExamStatus(examId, status, institutionId, userId) {
    if (!['upcoming', 'active', 'completed', 'archived'].includes(status)) {
      throw new AppError('Invalid status.', 400);
    }

    await this.getExamById(examId, institutionId);

    const updated = await examRepository.update(examId, { status });

    await auditLogService.log({
      userId,
      userType: 'user',
      action: `EXAM_STATUS_${status.toUpperCase()}`,
      resource: 'Exam',
      resourceId: examId,
      institutionId,
    });

    return updated;
  }

  async assignOfficers(examId, officerIds, institutionId, userId) {
    await this.getExamById(examId, institutionId);

    const updated = await examRepository.update(examId, {
      assignedOfficers: officerIds,
    });

    await auditLogService.log({
      userId,
      userType: 'user',
      action: 'EXAM_OFFICERS_ASSIGNED',
      resource: 'Exam',
      resourceId: examId,
      institutionId,
      details: { officerCount: officerIds.length },
    });

    return updated;
  }

  // Student-facing methods
  async getActiveExamsForStudent(institutionId, studentId) {
    return examRepository.findActiveForStudent(institutionId, studentId);
  }

  async getUpcomingExamsForStudent(institutionId, studentId) {
    return examRepository.findUpcomingForStudent(institutionId, studentId);
  }

  async getExamHistory(institutionId, studentId) {
    return examRepository.findHistoryForStudent(institutionId, studentId);
  }

  async getAvailableExamsForStudent(institutionId, studentId, department, level) {
    return examRepository.findAvailableForStudent(institutionId, studentId, department, level);
  }

  async getMyRegisteredExams(institutionId, studentId) {
    return examRepository.findRegisteredForStudent(institutionId, studentId);
  }

  // eslint-disable-next-line no-unused-vars
  async registerStudentForExam(studentId, examId, institutionId, department, level) {
    const exam = await examRepository.findById(examId);
    if (!exam) throw new AppError('Exam not found.', 404);
    if (exam.institutionId.toString() !== institutionId.toString()) {
      throw new AppError('This exam does not belong to your institution.', 403);
    }
    if (['completed', 'archived'].includes(exam.status)) {
      throw new AppError('Registration is closed for this exam.', 400);
    }
    // Also enforce the "date hasn't passed" rule so a stale 'upcoming' exam
    // whose day has come and gone can't be registered for.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (exam.examDate && new Date(exam.examDate) < startOfToday) {
      throw new AppError('This exam has already passed.', 400);
    }

    const alreadyRegistered = await examRepository.isStudentRegistered(examId, studentId);
    if (alreadyRegistered) {
      return { exam, alreadyRegistered: true };
    }

    const updated = await examRepository.registerStudent(examId, studentId);

    await auditLogService.log({
      userId: studentId,
      userType: 'student',
      action: 'EXAM_REGISTERED',
      resource: 'Exam',
      resourceId: examId,
      institutionId,
      details: { courseCode: exam.courseCode, title: exam.title },
    });

    return { exam: updated, alreadyRegistered: false };
  }

  async unregisterStudentFromExam(studentId, examId, institutionId) {
    const exam = await examRepository.findById(examId);
    if (!exam) throw new AppError('Exam not found.', 404);
    if (exam.institutionId.toString() !== institutionId.toString()) {
      throw new AppError('This exam does not belong to your institution.', 403);
    }
    if (!['upcoming'].includes(exam.status)) {
      throw new AppError('You can only unregister from upcoming exams.', 400);
    }

    const registered = await examRepository.isStudentRegistered(examId, studentId);
    if (!registered) {
      return { exam, wasRegistered: false };
    }

    const updated = await examRepository.unregisterStudent(examId, studentId);

    await auditLogService.log({
      userId: studentId,
      userType: 'student',
      action: 'EXAM_UNREGISTERED',
      resource: 'Exam',
      resourceId: examId,
      institutionId,
      details: { courseCode: exam.courseCode, title: exam.title },
    });

    return { exam: updated, wasRegistered: true };
  }
}

module.exports = new ExamService();
