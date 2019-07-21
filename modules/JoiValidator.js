const BaseValidator = require('moleculer').Validator
const { ValidationError } = require('moleculer').Errors

class JoiValidator extends BaseValidator {
  constructor () {
    super()
    this.validator = require('@hapi/joi')
  }

  compile (schema) {
    return (params) => this.validate(params, schema)
  }

  validate (params, schema) {
    const res = this.validator.validate(params, schema)
    if (res.error) { return new ValidationError(res.error.message, null, res.error.details) }
    return true
  }
}

module.exports = JoiValidator
