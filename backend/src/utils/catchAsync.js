/* Express 4 doesn't forward rejected promises from async handlers to the
   error middleware on its own — wrap every async controller with this so
   a thrown/rejected error reaches the centralized error handler instead
   of hanging the request. */
export default function catchAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
