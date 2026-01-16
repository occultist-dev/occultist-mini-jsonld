import {type IRIObject, type JSONArray, type JSONValue} from '../../lib/expand.ts';

/**
 * Recursively updates the JSON-ld to be in normal expanded form
 * so it can be compared to the output of the jsonld.js expand function.
 */
export function normalizeJSONLD(value: JSONValue): JSONValue {
  function innerArray(value: JSONValue): JSONValue {
    if (!Array.isArray(value)) {
      if (typeof value === 'boolean' ||
          typeof value === 'number' ||
          typeof value === 'string') {
        return { '@value': value }
      }

      for (const [key2, value2] of Object.entries(value)) {
        value[key2] = inner(value2, key2);
      }

      return value;
    }

    for (let i = 0, length = value.length; i < length; i++) {
      value[i] = inner(value[i]);
    }

    return value;
  }

  function inner(value: JSONValue, key?: string): JSONValue {
    if (!Array.isArray(value)) {
      if (key === '@id') return value;
      if (key === '@type') return [value];

      if (typeof value === 'boolean' ||
          typeof value === 'number' ||
          typeof value === 'string') {
        return [{ '@value': value }]
      }

      for (const [key2, value2] of Object.entries(value)) {
        value[key2] = inner(value2, key2);
      }

      return [value];
    }

    for (let i = 0, length = value.length; i < length; i++) {
      value[i] = innerArray(value[i]);
    }

    return value;
  }

  if (value == null) return value;
  switch (typeof value) {
    case 'boolean': return value;
    case 'number': return value;
    case 'string': return value;
  }

  let normalized: JSONArray;

  if (Array.isArray(value)) {
    normalized = value;

    for (let i = 0, length = value.length; i < length; i++) {
      normalized[i] = innerArray(normalized[i]);
    }
  } else {
    normalized = [value];
    for (const [key, item] of Object.entries(value)) {
      value[key] = inner(item, key);
    }
  }

  return normalized;
}

