const qrCodeService = require('../services/qrCodeService');
const { successResponse } = require('../utils/helpers');

class QRCodeController {
  /**
   * GET /api/qrcodes/student/my-qr  (student JWT)
   * Returns the student's active identity QR — creates one if missing/expired.
   */
  async getMyQR(req, res, next) {
    try {
      const qrCode = await qrCodeService.getOrCreateStudentIdentityQR(req.user.id);
      return successResponse(res, 'Student QR retrieved.', qrCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/qrcodes/student/regenerate  (student JWT)
   * Revokes any active identity QR and mints a fresh one.
   */
  async regenerateMyQR(req, res, next) {
    try {
      const qrCode = await qrCodeService.regenerateStudentIdentityQR(req.user.id);
      return successResponse(res, 'Student QR regenerated.', qrCode, null, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/qrcodes/scan-student  (institution JWT)
   * Body: { encryptedPayload, examId? }
   *
   * Scans a student's identity QR. If examId is provided, also records
   * attendance for that exam (when eligible).
   */
  async scanStudent(req, res, next) {
    try {
      const { encryptedPayload, examId } = req.body;
      const result = await qrCodeService.scanStudentQR(
        encryptedPayload,
        req.user.id,
        req.user.institutionId,
        examId || null
      );

      // Emit socket events for real-time dashboards
      if (req.io) {
        const room = `institution:${req.user.institutionId}`;
        if (result.verified && result.status === 'VERIFIED') {
          req.io.to(room).emit('verification:success', {
            student: result.student,
            exam: result.exam,
            timestamp: new Date(),
          });
          if (result.exam?.id) {
            req.io.to(room).emit('attendance:update', {
              examId: result.exam.id,
              timestamp: new Date(),
            });
          }
        } else if (!result.verified) {
          req.io.to(room).emit('verification:rejected', {
            reason: result.reason,
            status: result.status,
            timestamp: new Date(),
          });
        }
      }

      const statusCode = result.verified ? 200 : 400;
      const message = result.verified ? (result.message || 'Verification successful.') : result.reason;
      return res.status(statusCode).json({
        success: result.verified,
        message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/qrcodes/institution/identity  (institution JWT)
   * Lists active student identity QRs for the institution.
   */
  async listInstitutionIdentityQRs(req, res, next) {
    try {
      const qrs = await qrCodeService.listInstitutionIdentityQRs(req.user.institutionId);
      return successResponse(res, 'Identity QRs retrieved.', qrs);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/qrcodes/:id  (institution JWT)
   */
  async getQRCode(req, res, next) {
    try {
      const qrCode = await qrCodeService.getQRCodeById(req.params.id);
      return successResponse(res, 'QR code retrieved.', qrCode);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new QRCodeController();
