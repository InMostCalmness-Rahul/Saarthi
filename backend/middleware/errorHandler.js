import { logger, redactUrl } from '../utils/logger.js';

// Central error handling. This is the ONLY place that decides what a client sees,
// so internal error messages (Mongoose/Atlas/driver details) cannot leak.

function resolveStatus(err) {
  if (err?.type === 'entity.too.large') {
    return 413;
  }
  if (err?.type === 'entity.parse.failed') {
    return 400;
  }
  const status = Number(err?.status ?? err?.statusCode);
  if (Number.isInteger(status) && status >= 400 && status <= 599) {
    return status;
  }
  return 500;
}

function resolveClientMessage(err, status) {
  if (status >= 500) {
    return 'Internal Server Error';
  }
  if (err?.type === 'entity.too.large') {
    return 'Request body is too large';
  }
  if (err?.type === 'entity.parse.failed') {
    return 'Request body must be valid JSON';
  }
  if (err?.expose === false) {
    return 'Request could not be processed';
  }
  return err?.message || 'Request could not be processed';
}

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const status = resolveStatus(err);

  if (status >= 500) {
    logger.error(`unhandled_error ${req.method} ${redactUrl(req.originalUrl)}`, err);
  } else {
    logger.debug(`request_error ${status} ${req.method} ${redactUrl(req.originalUrl)}`, err.message);
  }

  const payload = {
    success: false,
    error: {
      status,
      message: resolveClientMessage(err, status),
    },
  };

  if (err?.code && typeof err.code === 'string') {
    payload.error.code = err.code;
  }

  if (status >= 500 && process.env.NODE_ENV === 'development' && err?.stack) {
    payload.error.stack = err.stack;
  }

  return res.status(status).json(payload);
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      status: 404,
      message: `Route ${req.method} ${redactUrl(req.path)} not found`,
    },
  });
};
