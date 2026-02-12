"use strict";

function isInteger(value) {
  return Number.isInteger(value);
}

function validateSchema(schema, data) {
  const errors = [];
  if (schema.type !== "object" || typeof data !== "object" || data === null || Array.isArray(data)) {
    errors.push("Expected object arguments");
    return errors;
  }

  const props = schema.properties || {};
  const required = schema.required || [];

  for (const key of required) {
    if (!(key in data)) errors.push(`Missing required field: ${key}`);
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(data)) {
      if (!props[key]) errors.push(`Unknown field: ${key}`);
    }
  }

  for (const [key, rule] of Object.entries(props)) {
    if (!(key in data)) continue;
    const value = data[key];
    if (rule.type === "string" && typeof value !== "string") errors.push(`Field ${key} must be string`);
    if (rule.type === "boolean" && typeof value !== "boolean") errors.push(`Field ${key} must be boolean`);
    if (rule.type === "integer" && !isInteger(value)) errors.push(`Field ${key} must be integer`);
    if (rule.type === "array" && !Array.isArray(value)) errors.push(`Field ${key} must be array`);
    if (rule.enum && !rule.enum.includes(value)) errors.push(`Field ${key} must be one of: ${rule.enum.join(", ")}`);
    if (rule.minimum !== undefined && typeof value === "number" && value < rule.minimum) errors.push(`Field ${key} below minimum ${rule.minimum}`);
    if (rule.maximum !== undefined && typeof value === "number" && value > rule.maximum) errors.push(`Field ${key} above maximum ${rule.maximum}`);
  }

  return errors;
}

module.exports = { validateSchema };
