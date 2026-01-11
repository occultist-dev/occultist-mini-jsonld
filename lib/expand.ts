import {isJSONObject} from "./isJSONObject.ts";

export type JSONPrimitive = string | number | boolean | null | undefined;

export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

export type JSONObject = { [member: string]: JSONValue };

export interface JSONArray extends Array<JSONValue> {}

export type IRIObject<Properties extends JSONObject = JSONObject> =
  & Properties
  & {
    '@id': string;
  };

export type TypeObject<Properties extends JSONObject = JSONObject> =
  & Properties
  & { '@type': string | string[] };

export type ValueObject<Properties extends JSONObject = JSONObject> =
  & Properties
  & { '@value': JSONValue };

export type ListObject<Properties extends JSONObject = JSONObject> =
  & Properties
  & { '@list': JSONArray };

export type SetObject<Properties extends JSONObject = JSONObject> =
  & Properties
  & { '@set': JSONArray };

export type IterableJSONLD<Properties extends JSONObject = JSONObject> =
  | JSONArray
  | ListObject<Properties>
  | SetObject<Properties>
;

export type Fetcher = typeof fetch;

export type JSONLDContextCache = Map<string, JSONLDContext>;

const urlRe = /^[a-zA-Z\\-]+:\/\/[^\.]+\./;

const aliasRe = /$([^:])(.*)$/;

export type JSONLDSourceDataType =
  | 'null'
  | 'boolean'
  | 'number'
  | 'string'
  | 'array'
  | 'object'
;

export class JSONLDContextSource {
  url: string;
  json: JSONObject;
  datatype: JSONLDSourceDataType;

  constructor(
    url: string,
    json: JSONObject,
  ) {
    this.url = url;
    this.json = json;

    if (isJSONObject(json)) {
      this.datatype = 'object';
    } else if (Array.isArray(json)) {
      this.datatype = 'array';
    } else if (json == null) {
      this.datatype = 'null';
    } else {
      this.datatype = typeof json as JSONLDSourceDataType;
    }
  }
};

export class JSONLDContextCtx {
  primary: JSONLDContextSource;
  sources: Map<string, JSONLDContextSource> = new Map();
  inflight: Set<string> = new Set();
  pending: Set<string> = new Set();
  failed: Set<string> = new Set();

  constructor(primary: JSONLDContextSource) {
    this.primary = primary;
  }

  hasSource(iri: string) {
    return this.sources.has(iri);
  }

  addSource(source: JSONLDContextSource) {
    if (source.url != null) {
      this.sources.set(source.url, source);
    }
  }
}

export class JSONLDContextBag {
  contexts: Map<string, JSONLDContext> = new Map();
  fetcher: typeof fetch = fetch;
  #requestInit: RequestInit = {
    method: 'GET',
    headers: { 'Content-Type': 'application/ld+json' },
  };
  
  constructor({
    fetcher,
    contexts,
  }: {
    fetcher?: typeof fetch,
    contexts?: Map<string, JSONLDContext>,
  }) {
    if (contexts instanceof Map) {
      this.contexts = contexts;
    }

    if (typeof fetcher === 'function') {
      this.fetcher = fetcher;
    }
  }
  
  has(iri: string): boolean {
    return this.contexts.has(iri);
  }

  get(iri: string): JSONLDContext | undefined {
    return this.contexts.get(iri);
  }

  set(context: JSONLDContext): void {
    if (context.iri == null) {
      return;
    }

    this.contexts.set(context.iri, context);
  }

  async fetchContext(url: string): Promise<JSONLDContext> {
    const res = await this.fetcher(url, this.#requestInit);
    const json = await res.json();
    const source = new JSONLDContextSource(url, json);
    const ctx = new JSONLDContextCtx(source);

    const resolved = await JSONLDContext.fromSource(source, ctx, this);

    if (Array.isArray(resolved[1])) {
      let length: number = resolved[1].length;

      for (let i = 0; i < length; i++) {
        this.set(resolved[1][i]);
      }
    }

    return resolved[0];
  }
}

export type JSONLDContainer = 
  | 'list'
  | 'set'
;

export class JSONLDTypeDef {
  id: string;
  type?: string;
  container?: JSONLDContainer;
  context?: JSONLDContext;

  constructor(
    id: string,
    type?: string | undefined,
    container?: JSONLDContainer | undefined,
    context?: JSONLDContext | undefined,
  ) {
    this.id = id;
    this.type = type;
    this.container = container;
    this.context = context;
  }
};

export class JSONLDKWAliases {
  '@id': string = '@id';
  '@type': string = '@type';
  '@container': string = '@container';
  '@set': string = '@set';
  '@list': string = '@list';
  '@graph': string = '@graph';
};

export class JSONLDContext {

  /**
   * The URL used to fetch this context
   */
  url?: string;

  /**
   * The IRI of the context's document.
   *
   * This is only used if there is a single context at the top level of a JSON
   * object response.
   */
  iri?: string;

  /**
   * The base URL that relative IRIs in referencing documents
   * are resolved from.
   */
  base?: string;

  version?: 1.1;

  vocab?: string;
  
  language?: string;

  aliases: Map<string, string>;

  kwaliases: JSONLDKWAliases;

  types: Map<string, JSONLDTypeDef>;

  constructor(
    url: string | undefined,
    iri: string | undefined,
    base: string | undefined,
    vocab: string | undefined,
    version: 1.1 | undefined,
    language: string | undefined,
    aliases: Map<string, string>,
    kwaliases: JSONLDKWAliases,
    types: Map<string, JSONLDTypeDef>,
  ) {
    this.url = url;
    this.iri = iri;
    this.base = base;
    this.version = version;
    this.vocab = vocab;
    this.language = language;
    this.aliases = aliases;
    this.kwaliases = kwaliases;
    this.types = types;
  }

  static fromOthers(
    iri: string | undefined,
    source: JSONLDContextSource,
    others: JSONLDContext[],
  ) {
    let base: string | undefined;
    let version: 1.1 | undefined;
    let vocab: string | undefined;
    let language: string | undefined;
    let aliases: Map<string, string> = new Map();
    let kwaliases: JSONLDKWAliases = new JSONLDKWAliases();
    let types: Map<string, JSONLDTypeDef> = new Map();
    
    let length = others.length;
    for (let i = 0; i < length; i++) {
      base ??= others[i].base;
      version ??= others[i].version;
      vocab ??= others[i].vocab;
      language ??= others[i].language;

      for (const [key, value] of Object.entries(kwaliases)) {
        if (kwaliases[key] === key) kwaliases[key] = value;
      }

      for (const [key, value] of others[i].aliases) {
        if (!aliases.has(key)) {
          aliases.set(key, value);
        }
      }

      for (const [key, value] of others[i].types) {
        if (!types.has(key)) {
          types.set(key, value);
        }
      }
    }

    return new JSONLDContext(
      source.url,
      iri,
      base,
      vocab,
      version,
      language,
      aliases,
      kwaliases,
      types,
    );
  }
  
  static fromJSONObject(source: JSONLDContextSource): JSONLDContext {
    const context = source.json['@context'] ?? source.json as JSONObject;
    const aliases = new Map<string, string>();
    const kwaliases = new JSONLDKWAliases();
    const types = new Map<string, JSONLDTypeDef>();
    const entries = Object.entries(context);
    
    let base: string | undefined;
    if (typeof context['@base'] === 'string' &&
        urlRe.test(context['@base'])
    ) {
      base = context['@base'];
    } else if (context['@base'] !== null) {
      console.warn(`Invalid @base "${context['@base']}" from ${source.url}`);
    }

    let version: 1.1 | undefined;
    if (context['@version'] === 1.1) {
      version = context['@version'];
    } else if (context['@version'] != null) {
      console.warn(`Invalid @version "${context['@version']}" from ${source.url}`);
    }

    let vocab: string | undefined;
    if (typeof context['@vocab'] === 'string' &&
        urlRe.test(context['@vocab'])
    ) {
      vocab = context['@vocab'];
    } else if (context['@vocab'] != null) {
      console.warn(`Invalid @vocab "${context['@vocab']}" from ${source.url}`);
    }

    let language: string | undefined;
    if (typeof context['@language'] === 'string' &&
        context['@language'].length > 0
    ) {
      language = context['@language'];
    } else if (context['@language'] != null) {
      console.warn(`Invalid @language "${context['@language']}" from ${source.url}`);
    }

    let key: string;
    let value: string;
    let length: number = entries.length;
    let i: number;
    for (i = 0; i < length; i++) {
      [key, value] = entries[i];
      
      if (key.startsWith('@')) continue;
      if (typeof value !== 'string') continue;

      if (value === '@context') {
        console.warn(`@context cannot be aliased "${key}": "${value}" from ${source.url}`);

        continue;
      } else if (value.startsWith('@')) {
        if (kwaliases[value] == null) {
          console.warn(`Unsupported keyword alias "${key}": "${value}" from ${source.url}`);

          continue;
        }

        // keyword aliasing
        kwaliases[value] = key;
      } else if (urlRe.test(value)) {
        // vocab aliasing
        aliases[key] = value;
      }
    }

    let match: RegExpExecArray;
    let aliasTag: string;
    let suffix: string;
    let alias: string;
    for (i = 0; i < length; i++) {
      [key, value] = entries[i];

      if (key.startsWith('@')) continue;

      switch (typeof value) {
        case 'string': {
          if (value.startsWith('@')) continue;

          if (urlRe.test(value)) {
            types.set(key, new JSONLDTypeDef(value));

            continue;
          }
          match = aliasRe.exec(value);

          if (match == null) {
            console.warn(`Invalid context value "${key}": "${value}" from ${source.url}`);

            continue;
          }

          [, aliasTag, suffix] = match;
          alias = aliases.get(aliasTag);

          if (alias == null) {
            console.warn(`Unknown alias "${key}": "${value}" from ${source.url}`);

            continue;
          }

          types.set(key, new JSONLDTypeDef(`${alias}${suffix}`));

          continue;
        }
      }
    }

    let iri: string | undefined;
    let tmpIRI = source.json[kwaliases['@id']];

    if (isJSONObject(source.json)) {
      if (typeof tmpIRI !== 'string') {
        console.warn(`Invalid @id "${kwaliases['@id']}": "${tmpIRI}" from ${source.url}`);
      } else if (urlRe.test(tmpIRI)) {
        iri = tmpIRI;
      } else {
         match = aliasRe.exec(value);

         if (match == null) {
           console.warn(`Invalid context value "${key}": "${value}" from ${source.url}`);

         } else {
           [, aliasTag, suffix] = match;
           alias = aliases.get(aliasTag);

           if (alias == null) {
             console.warn(`Invalid @id "${kwaliases['@id']}": "${tmpIRI}" from ${source.url}`);

           } else {
             iri = `${alias}${suffix}`;
           }
         }
      }
    }
    
    return new JSONLDContext(
      source.url,
      iri,
      base,
      vocab,
      version,
      language,
      aliases,
      kwaliases,
      types,
    );
  }

  static async fromSource(
    source: JSONLDContextSource,
    ctx: JSONLDContextCtx,
    bag: JSONLDContextBag,
  ): Promise<[
    primary: JSONLDContext,
    related?: JSONLDContext[],
  ]> {
    if (isJSONObject(source.json) && (
      isJSONObject(source.json['@context']) ||
      source.json['@context'] == null
    )) {
      return [JSONLDContext.fromJSONObject(source)];
    }
  }
}


type PointerTarget = {
  inArray: boolean;
  isArray: boolean | undefined; // undefined means scala value
  termOrType: string | undefined;
  type: string;
  container: string;
  value: JSONValue;
  children: JSONValue[] | Array<[string, JSONValue]> | undefined;
  context: JSONLDContext | undefined;
};

type PointerList = Array<PointerTarget>;

export async function expand(input: JSONValue, {
  bag = new JSONLDContextBag({}),
  preserveRedundantArrays,
}: {
  bag?: JSONLDContextBag,
  preserveRedundantArrays?: boolean,
}): Promise<JSONValue> {
  if (input == null) return [];

  switch (typeof input) {
    case 'boolean': return [];
    case 'number': return [];
    case 'string': return [];
  }
 
  let i: number = 0; 
  let length: number = 0;
  let value: JSONValue = null;
  let x: number = 0;
  let y: number = 0;
  let lowestLevel: number | undefined;
  let done: boolean = false;
  let pointerList: PointerList = [];

  if (Array.isArray(input)) {

  } else {
    let context: JSONLDContext;

    if (input['@context'] != null) {
      context = await bag.fetchContext(

    pointerList[0] = {
      inArray: false,
      isArray: Array.isArray(input),
      termOrType: undefined,
      type: 
    }
  
  }
  
  do {
    pointerList.push();

    // find working pointer
    do {
      
    } while (!done)
    
    do {

    } while (!done)
  } while (!done)

  return input;
}


/**
 * @description
 * Returns true if the input value is an object.
 *
 * @param value Any value which should come from a JSON source.
 */
export function isJSONObject(value: JSONValue): value is JSONObject {
  return typeof value === 'object' && !Array.isArray(value) && value !== null;
}


