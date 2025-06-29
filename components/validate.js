import Joi from "joi";

export function validateBody(schema, req, res) {
  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400).json({ error: true, msg: error.details[0].message });
    return false;
  }
  return true;
}

export function validateQuery(schema, req, res) {
  const { error } = schema.validate(req.query);
  if (error) {
    res.status(400).json({ error: true, msg: error.details[0].message });
    return false;
  }
  return true;
}
