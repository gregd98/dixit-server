const errorBody = (message) => ({ succeed: false, message });

exports.succeed = (res) => res.status(200).json({ succeed: true });
exports.badRequest = (res) => res.status(400).json(errorBody('Bad request.'));
exports.accessDenied = (res) => res.status(401).json(errorBody('Access denied.'));
exports.notFound = (res) => res.status(404).json(errorBody('Not found.'));
exports.internalServerError = (res) => res.status(500).json(errorBody('Internal server error.'));
exports.customError = (res, status, message) => res.status(status).json(errorBody(message));

exports.inputErrors = (res, errors) => res.status(200).json(
  { succeed: false, inputErrors: errors },
);

exports.rest = (res, payload) => res.status(200).json({ succeed: true, payload });
