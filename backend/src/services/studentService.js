const studentRepository = require('../repositories/studentRepository');
const institutionRepository = require('../repositories/institutionRepository');
const auditLogService = require('./auditLogService');
const emailService = require('./emailService');
const { generateUsername, generateTempPassword } = require('../utils/passwordGenerator');
const { parseCSV, parseExcel, generateCSV, generateExcel } = require('../utils/csvParser');
const { AppError, getPaginationMeta, parsePaginationQuery } = require('../utils/helpers');
const logger = require('../utils/logger');

class StudentService {
  /**
   * Create a single student with auto-generated credentials.
   * `passportPhotoPath` is provided by the upload middleware (optional).
   */
  async createStudent(data, institutionId, createdByUserId, passportPhotoPath = null) {
    // Check if matric number already exists in this institution
    const existing = await studentRepository.findByMatricNumber(data.matricNumber, institutionId);
    if (existing) {
      throw new AppError('A student with this matric number already exists in your institution.', 409);
    }

    // Generate username and temporary password
    const username = generateUsername(data.firstName, data.lastName);
    const tempPassword = generateTempPassword();

    // Create student
    const student = await studentRepository.create({
      ...data,
      institutionId,
      username,
      passwordHash: tempPassword, // Will be hashed by pre-save hook
      passportPhoto: passportPhotoPath || data.passportPhoto || null,
    });

    // Log audit
    await auditLogService.log({
      userId: createdByUserId,
      userType: 'user',
      action: 'STUDENT_CREATED',
      resource: 'Student',
      resourceId: student._id,
      institutionId,
      details: {
        matricNumber: data.matricNumber,
        username,
      },
    });

    // Send credentials email if student has email
    if (data.email) {
      const institution = await institutionRepository.findById(institutionId);
      await emailService.sendStudentCredentials(
        data.email,
        data.firstName,
        username,
        tempPassword,
        institution?.name || ''
      );
    }

    logger.info(`Student created: ${data.matricNumber} (${username})`);

    // Return student with plain text credentials
    return {
      student: student.toJSON(),
      credentials: {
        username,
        temporaryPassword: tempPassword,
      },
    };
  }

  /**
   * Bulk import students from CSV/Excel
   */
  async bulkImportStudents(fileBuffer, filename, institutionId, createdByUserId) {
    let records;
    const ext = filename.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      records = await parseCSV(fileBuffer);
    } else if (['xlsx', 'xls'].includes(ext)) {
      records = parseExcel(fileBuffer);
    } else {
      throw new AppError('Unsupported file format. Use CSV or Excel.', 400);
    }

    if (!records || records.length === 0) {
      throw new AppError('No records found in the uploaded file.', 400);
    }

    const results = {
      total: records.length,
      success: 0,
      failed: 0,
      errors: [],
      credentials: [],
    };

    const institution = await institutionRepository.findById(institutionId);

    for (let i = 0; i < records.length; i++) {
      try {
        const record = records[i];

        if (!record.firstName || !record.lastName || !record.matricNumber) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            error: 'Missing required fields (firstName, lastName, matricNumber)',
          });
          continue;
        }

        // Check for duplicate
        const existing = await studentRepository.findByMatricNumber(
          record.matricNumber,
          institutionId
        );
        if (existing) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            error: `Matric number ${record.matricNumber} already exists`,
          });
          continue;
        }

        const username = generateUsername(record.firstName, record.lastName);
        const tempPassword = generateTempPassword();

        await studentRepository.create({
          ...record,
          institutionId,
          username,
          passwordHash: tempPassword,
          gender: record.gender || 'other',
        });

        results.success++;
        results.credentials.push({
          matricNumber: record.matricNumber,
          fullName: `${record.firstName} ${record.lastName}`,
          username,
          temporaryPassword: tempPassword,
        });

        if (record.email) {
          // Fire-and-forget — bulk import shouldn't block on SMTP.
          emailService
            .sendStudentCredentials(
              record.email,
              record.firstName,
              username,
              tempPassword,
              institution?.name || ''
            )
            .catch(() => {});
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          error: error.message,
        });
      }
    }

    // Log audit
    await auditLogService.log({
      userId: createdByUserId,
      userType: 'user',
      action: 'STUDENTS_BULK_IMPORTED',
      resource: 'Student',
      institutionId,
      details: {
        total: results.total,
        success: results.success,
        failed: results.failed,
      },
    });

    logger.info(
      `Bulk import: ${results.success}/${results.total} students created for institution ${institutionId}`
    );

    return results;
  }

  /**
   * Get paginated students list with filters
   */
  async getStudents(institutionId, queryParams) {
    const { page, limit, sort } = parsePaginationQuery(queryParams);

    const query = await studentRepository.findByInstitution(institutionId, {
      search: queryParams.search,
      department: queryParams.department,
      level: queryParams.level,
      status: queryParams.status,
    });

    const { data, total } = await studentRepository.findPaginated(
      query,
      page,
      limit,
      sort
    );

    return {
      students: data,
      pagination: getPaginationMeta(page, limit, total),
    };
  }

  /**
   * Get single student by ID
   */
  async getStudentById(studentId, institutionId) {
    const student = await studentRepository.findById(studentId);
    if (!student) {
      throw new AppError('Student not found.', 404);
    }

    // Ensure student belongs to the requesting institution
    const studentInstitutionId = student.institutionId?._id || student.institutionId;
    if (studentInstitutionId.toString() !== institutionId.toString()) {
      throw new AppError('Student not found.', 404);
    }

    return student;
  }

  /**
   * Update student (institution-side). Accepts optional new passport photo.
   */
  async updateStudent(studentId, data, institutionId, userId, passportPhotoPath = null) {
    await this.getStudentById(studentId, institutionId);

    // Don't allow changing username, password, or moving between institutions
    delete data.username;
    delete data.passwordHash;
    delete data.institutionId;

    if (passportPhotoPath) {
      data.passportPhoto = passportPhotoPath;
    }

    const updated = await studentRepository.update(studentId, data);

    await auditLogService.log({
      userId,
      userType: 'user',
      action: 'STUDENT_UPDATED',
      resource: 'Student',
      resourceId: studentId,
      institutionId,
      details: { updatedFields: Object.keys(data) },
    });

    return updated;
  }

  /**
   * Suspend or activate student
   */
  async updateStudentStatus(studentId, status, institutionId, userId) {
    if (!['active', 'suspended'].includes(status)) {
      throw new AppError('Invalid status.', 400);
    }

    await this.getStudentById(studentId, institutionId);

    const updated = await studentRepository.update(studentId, { status });

    await auditLogService.log({
      userId,
      userType: 'user',
      action: `STUDENT_${status.toUpperCase()}`,
      resource: 'Student',
      resourceId: studentId,
      institutionId,
    });

    return updated;
  }

  /**
   * Institution-only: update just the student's passport photo.
   */
  async updateStudentPhoto(studentId, filePath, institutionId, userId) {
    await this.getStudentById(studentId, institutionId);

    const updated = await studentRepository.update(studentId, {
      passportPhoto: filePath,
    });

    await auditLogService.log({
      userId,
      userType: 'user',
      action: 'STUDENT_PHOTO_UPDATED',
      resource: 'Student',
      resourceId: studentId,
      institutionId,
    });

    return updated;
  }

  /**
   * Export students list
   */
  async exportStudents(institutionId, format = 'csv') {
    const students = await studentRepository.findMany(
      { institutionId },
      { sort: 'lastName' }
    );

    const exportData = students.map((s) => ({
      'First Name': s.firstName,
      'Last Name': s.lastName,
      'Other Name': s.otherName || '',
      'Matric Number': s.matricNumber,
      Department: s.department,
      Faculty: s.faculty,
      Level: s.level,
      Email: s.email || '',
      Phone: s.phone || '',
      Gender: s.gender,
      Username: s.username,
      Status: s.status,
    }));

    if (format === 'excel' || format === 'xlsx') {
      return {
        buffer: generateExcel(exportData, 'Students'),
        filename: `students_export_${Date.now()}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }

    // Default CSV
    const columns = Object.keys(exportData[0] || {}).map((key) => ({
      key,
      header: key,
    }));
    return {
      buffer: generateCSV(exportData, columns),
      filename: `students_export_${Date.now()}.csv`,
      contentType: 'text/csv',
    };
  }

  /**
   * Get student's own profile (for student-ui)
   */
  async getStudentProfile(studentId) {
    const student = await studentRepository.findById(studentId);
    if (!student) {
      throw new AppError('Student not found.', 404);
    }
    return student;
  }

  /**
   * Update student's own profile — students may only edit their contact info.
   * Passport photo is NOT changeable by the student (institution-controlled).
   */
  async updateStudentProfile(studentId, data) {
    const allowed = ['phone', 'email'];
    const filtered = {};
    allowed.forEach((key) => {
      if (data[key] !== undefined) filtered[key] = data[key];
    });

    return studentRepository.update(studentId, filtered);
  }

  /**
   * Get distinct departments/levels for filter dropdowns
   */
  async getFilterOptions(institutionId) {
    const [departments, levels] = await Promise.all([
      studentRepository.getDistinctDepartments(institutionId),
      studentRepository.getDistinctLevels(institutionId),
    ]);
    return { departments, levels };
  }
}

module.exports = new StudentService();
