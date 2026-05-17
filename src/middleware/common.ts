import { Request, Response, NextFunction } from 'express';

/**
 * Request Logger Middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
};

/**
 * Global Error Handler Middleware
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERROR] Global Error Handler:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
};

/**
 * Standard Response Helper
 */
export const sendSuccess = (res: Response, data: any, status = 200) => {
  res.status(status).json({
    success: true,
    data
  });
};

export const sendError = (res: Response, message: string, status = 400) => {
  res.status(status).json({
    success: false,
    error: message
  });
};

/**
 * Input Validation Middleware
 */
export const validateBody = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return sendError(res, `Missing required fields: ${missingFields.join(', ')}`);
    }
    next();
  };
};
