import asyncHandler from 'express-async-handler';
import { validationResult } from 'express-validator';

const handleValidationErrors = asyncHandler(async (req, res, next) => {
  const errorsArray = validationResult(req).array();
  if (errorsArray.length > 0) {
    res.status(400).json({
      errors: errorsArray.map((error) => ({
        value: 'value' in error ? error.value : '',
        msg: error.msg,
        path: 'path' in error ? error.path : '',
      })),
    }); return;
  }
  next();
});

export default handleValidationErrors;
