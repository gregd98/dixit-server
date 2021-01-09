const required = { allowEmpty: false, message: 'This field is required.' };

// eslint-disable-next-line import/prefer-default-export
const joinConstraints = {
  code: {
    presence: required,
    format: {
      pattern: '[A-Z]{6}',
      message: 'Invalid code',
    },
  },
  name: {
    presence: required,
    length: {
      minimum: 3,
      maximum: 16,
      tooShort: 'The name must be between 3 and 16 characters.',
      tooLong: 'The name must be between 3 and 16 characters.',
    },
    format: {
      pattern: '\\p{L}+',
      flags: 'u',
      message: 'The name must only contain alphabetical characters.',
    },
  },
};

module.exports = joinConstraints;
