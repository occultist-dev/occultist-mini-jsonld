export type JSONPrimitive = string | number | boolean | null | undefined;

export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

export type JSONObject = { [member: string]: JSONValue };

export interface JSONArray extends Array<JSONValue> {}

export type IRIObject<Properties extends JSONValue = JSONValue> =
  & Properties
  & {
    '@id': string;
  };

export type TypeObject<Properties extends JSONValue = JSONValue> =
  & Properties
  & { '@type': string | string[] };

export type ValueObject<Properties extends JSONValue = JSONValue> =
  & Properties
  & { '@value': JSONValue };

export type ListObject<Properties extends JSONValue = JSONValue> =
  & Properties
  & { '@list': JSONArray };

export type SetObject<Properties extends JSONValue = JSONValue> =
  & Properties
  & { '@set': JSONArray };

export type IterableJSONLD<Properties extends JSONValue = JSONValue> =
  | JSONArray
  | ListObject<Properties>
  | SetObject<Properties>
;

export type Fetcher = typeof fetch;

