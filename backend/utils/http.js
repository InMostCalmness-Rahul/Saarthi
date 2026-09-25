// Route helpers that keep controllers free of duplicated try/catch blocks so
// errors always flow through the central error handler (and never leak
// error.message directly to the client).

export class HttpError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.expose = options.expose ?? status < 500;
    this.code = options.code;
    if (options.details) {
      this.details = options.details;
    }
  }
}

export const badRequest = (message, options) => new HttpError(400, message, options);
export const unauthorized = (message = 'Authentication required') => new HttpError(401, message);
export const forbidden = (message = 'You are not allowed to access this resource') =>
  new HttpError(403, message);
export const notFound = (message = 'Resource not found') => new HttpError(404, message);
export const conflict = (message, options) => new HttpError(409, message, options);

export function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}
