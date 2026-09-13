const studentService = require('../services/studentService');
const { successResponse } = require('../utils/helpers');

/**
 * Turn an uploaded multer file into the public URL path we store in the DB.
 */
const filePathFromReq = (req) =>
  req.file ? `/uploads/passports/${req.file.filename}` : null;

class StudentController {
  /**
   * POST /api/students
   * Accepts JSON or multipart/form-data (optional passportPhoto file).
   */
  async createStudent(req, res, next) {
    try {
      const result = await studentService.createStudent(
        req.body,
        req.user.institutionId,
        req.user.id,
        filePathFromReq(req)
      );
      return successResponse(res, 'Student created successfully.', result, null, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/students/bulk-import
   */
  async bulkImport(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
      }

      const result = await studentService.bulkImportStudents(
        req.file.buffer,
        req.file.originalname,
        req.user.institutionId,
        req.user.id
      );
      return successResponse(res, 'Bulk import completed.', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/students
   */
  async getStudents(req, res, next) {
    try {
      const result = await studentService.getStudents(req.user.institutionId, req.query);
      return successResponse(res, 'Students retrieved.', result.students, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/students/export
   */
  async exportStudents(req, res, next) {
    try {
      const format = req.query.format || 'csv';
      const result = await studentService.exportStudents(req.user.institutionId, format);

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/students/filter-options
   */
  async getFilterOptions(req, res, next) {
    try {
      const options = await studentService.getFilterOptions(req.user.institutionId);
      return successResponse(res, 'Filter options retrieved.', options);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/students/:id
   */
  async getStudent(req, res, next) {
    try {
      const student = await studentService.getStudentById(
        req.params.id,
        req.user.institutionId
      );
      return successResponse(res, 'Student retrieved.', student);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/students/:id
   * Accepts JSON or multipart/form-data (optional passportPhoto file).
   */
  async updateStudent(req, res, next) {
    try {
      const student = await studentService.updateStudent(
        req.params.id,
        req.body,
        req.user.institutionId,
        req.user.id,
        filePathFromReq(req)
      );
      return successResponse(res, 'Student updated successfully.', student);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/students/:id/status
   */
  async updateStatus(req, res, next) {
    try {
      const student = await studentService.updateStudentStatus(
        req.params.id,
        req.body.status,
        req.user.institutionId,
        req.user.id
      );
      return successResponse(res, 'Student status updated.', student);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/students/:id/passport
   * Institution-only endpoint to (re)upload a student's passport photo.
   */
  async updatePhoto(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
      }
      const filePath = `/uploads/passports/${req.file.filename}`;
      const student = await studentService.updateStudentPhoto(
        req.params.id,
        filePath,
        req.user.institutionId,
        req.user.id
      );
      return successResponse(res, 'Passport photo updated.', student);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/students/me/profile (Student)
   */
  async getMyProfile(req, res, next) {
    try {
      const student = await studentService.getStudentProfile(req.user.id);
      return successResponse(res, 'Profile retrieved.', student);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/students/me/profile (Student — contact info only)
   */
  async updateMyProfile(req, res, next) {
    try {
      const student = await studentService.updateStudentProfile(req.user.id, req.body);
      return successResponse(res, 'Profile updated.', student);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StudentController();
