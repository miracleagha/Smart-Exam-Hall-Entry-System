const { body } = require('express-validator');

const scanStudentQRValidation = [
  body('encryptedPayload')
    .notEmpty()
    .withMessage('Encrypted QR payload is required'),
  body('examId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid exam ID'),
];

module.exports = {
  scanStudentQRValidation,
};
