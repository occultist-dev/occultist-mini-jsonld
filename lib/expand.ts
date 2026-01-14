
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

export type JSONLDContextCache = Map<string, JSONLDContext>;

const urlRe = /^[a-zA-Z\\-]+:\/\/[^\.]+\./;

const aliasRe = /^([^\:]+)\:(.*)$/;

export type JSONLDSourceDataType =
  | 'null'
  | 'boolean'
  | 'number'
  | 'string'
  | 'array'
  | 'object'
;

export class JSONLDContextSource {
  url: string | undefined;
  json: JSONObject | JSONArray;
  datatype: JSONLDSourceDataType;

  constructor(
    url: string | undefined,
    json: JSONObject | JSONArray,
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
  } = {}) {
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
  | '@list'
  | '@set'
  | '@language'
  | '@index'
  | '@id'
  | '@type'
;

const containerTypes = new Set([
  '@list',
  '@set',
  '@language',
  '@index',
  '@id',
  '@type',
]);

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

  cache: Map<string, string> = new Map();

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

  getOrCreateTypeDef = (termOrType: string | undefined): JSONLDTypeDef | undefined => {
    if (this.types.has(termOrType)) {
      return this.types.get(termOrType);
    }

    if (urlRe.test(termOrType)) {
      const def = new JSONLDTypeDef(termOrType);

      this.types.set(termOrType, def);

      return def;
    }

    const match = aliasRe.exec(termOrType);

    if (match == null && this.vocab != null) {
      const type = this.vocab + termOrType;

      if (this.types.has(type)) {
        return this.types.get(type);
      }

      const def = new JSONLDTypeDef(this.vocab + termOrType);

      this.types.set(termOrType, def);

      return def;
    } else if (match == null) {
      return;
    }

    if (Object.hasOwn(this.aliases[match[1]])) {
      const alias = this.aliases[match[1]];
      const def = new JSONLDTypeDef(alias + match[2]);

      this.types.set(termOrType, def);

      return def;
    }

    if (this.types.has(match[1])) {
      let def = this.types.get(match[1]);
      def = new JSONLDTypeDef(def.id + match[2]);

      this.types.set(termOrType, def);

      return def;
    }

    console.warn(`Unrecognized alias "${match[1]}" for "${termOrType}"`);
  }

  expandTypes = (dataTypes: string | string[] | undefined) => {
    if (dataTypes == null) {
      return;
    } else if (typeof dataTypes === 'string') {
      return this.getOrCreateTypeDef(dataTypes)?.id;
    }

    let types: string[] = [];
    let def: JSONLDTypeDef;
    for (let i = 0, l = dataTypes.length; i < l; i++) {
      def = this.getOrCreateTypeDef(dataTypes[i]);

      if (def != null) types.push(def.id);
    }

    if (types.length === 0) return;

    return types;
  }

  expandIRIs = (iris: string | string[] | undefined) => {
    if (iris == null) {
      return;
    } else if (typeof iris === 'string') {
       const def = this.getOrCreateTypeDef(iris);

       if (def != null) {
         return { '@id': def.id };
       }

       return;
    }

    const expanded: IRIObject[] = [];

    for (let i = 0, length = iris.length; i < length; i++) {
      const def = this.getOrCreateTypeDef(iris[i]);

      if (def != null) {
        expanded.push({ '@id': def.id });
      }
    }

    return expanded;
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
    
    for (let i = 0, l = others.length; i < l; i++) {
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
    const context = source.json['@context'] ?? source.json as JSONValue;
    const aliases = new Map<string, string>();
    const kwaliases = new JSONLDKWAliases();
    const types = new Map<string, JSONLDTypeDef>();
    const entries: Array<[string, JSONValue]> = Object.entries(context);
    
    let base: string | undefined;
    if (typeof context['@base'] === 'string' &&
        urlRe.test(context['@base'])
    ) {
      base = context['@base'];
    } else if (context['@base'] != null) {
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
    let value: JSONValue;
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

    let iri: string | undefined;
    let match: RegExpExecArray;
    let aliasTag: string;
    let suffix: string;
    let alias: string;
    let def: JSONLDTypeDef;
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
    
    const ctx = new JSONLDContext(
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

    for (i = 0; i < length; i++) {
      [key, value] = entries[i];

      if (key.startsWith('@')) continue;

      if (typeof value === 'string') {
        const def = ctx.getOrCreateTypeDef(value);
        ctx.types.set(key, def);
      } else if (isJSONObject(value)) {
        const termOrType = value['@id'] as string ?? key;
        const def = ctx.getOrCreateTypeDef(termOrType);

        def.type = value['@type'] as string;
        def.container = value['@container'] as JSONLDContainer;

        if (key !== termOrType) {
          ctx.types.set(key, def);
        }
      }
    }

    return ctx;
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

type ObjectNode = {
  parent: Node | undefined;
  index: number | undefined;
  isArray: false,
  termOrType: string | undefined;
  type: string | undefined;
  container: JSONLDContainer | undefined;
  value: JSONObject;
  children: Array<[string, JSONValue]>;
  context: JSONLDContext | undefined;
};

type ArrayNode = {
  parent: Node | undefined;
  index: number | undefined;
  isArray: true,
  termOrType: string | undefined;
  type: string | undefined;
  container: JSONLDContainer | undefined; value: JSONArray;
  children: JSONValue[];
  context: JSONLDContext | undefined;
};

type Node = ObjectNode | ArrayNode;


const scalaTypes = new Set(['boolean', 'number', 'string']);

export async function expand(input: JSONValue, {
  bag = new JSONLDContextBag(),
  preserveRedundantArrays,
}: {
  bag?: JSONLDContextBag,
  preserveRedundantArrays?: boolean,
} = {}): Promise<JSONValue> {
  if (input == null) return [];

  if (scalaTypes.has(typeof input)) {
    console.warn(`JSON-LD input "${input}" must be an object or array`);

    return null;
  }
 
  let termOrType: string | undefined;
  let type: string;
  let value: JSONValue = null;
  let context: JSONLDContext | undefined;
  let node: Node;

  if (Array.isArray(input)) {
    node = {
      isArray: true,
      children: input,
      value: input,
      index: 0,
      context: undefined,
      parent: undefined,
      termOrType: undefined,
      type: undefined,
      container: undefined,
    } satisfies ArrayNode;
  } else {
    node = {
      isArray: false,
      children: Object.entries(input),
      value: input as JSONObject,
      context,
      index: 0,
      parent: undefined,
      termOrType: undefined,
      type: undefined,
      container: undefined,
    } satisfies ObjectNode;
  }
  
  while (true) {
    let def: JSONLDTypeDef | undefined;

    if (node.index === 0 &&
        !node.isArray &&
        node.value['@context'] != null
       ) {
      // the node value defines a context.

      node.context = JSONLDContext.fromJSONObject(
        new JSONLDContextSource(undefined, node.value)
      );

      delete node.value['@context'];
    } else if (node.index === 0 && node.parent != null) {
      // inherit the parent node's context
      node.context = node.parent.context;
    }


    // aim of this do-while is to find the first object / array
    // with yet to be processed leaves.

    if (node.index === node.children.length) {
      const idKW = node.context?.kwaliases['@id'] ?? '@id';
      const typeKW = node.context?.kwaliases['@type'] ?? '@type';
      // if the node has looped through its children, time to expand it and move up.
      context = node.context;
      

      // expand the value's @type value
      if (!node.isArray && node.value[idKW] != null && node.context != null) {
        node.value['@id'] = node?.context.expandTypes(node.value[idKW]);
      }
      if (!node.isArray && node.value[typeKW] != null && node.context != null) {
        node.value['@type'] = node?.context.expandTypes(node.value[typeKW]);
      }

      // place the value within its container.
      if (containerTypes.has(node.container)) {
        node.value = { [node.container]: node.value };
      }

      // expand this value's term on the parent.
      if (node.parent != null && node.type != null && node.type !== node.termOrType) {
        if (Array.isArray(node.parent.value[node.type])) {
          node.parent.value[node.type].push(node.value);
        } else if (node.parent.value[node.type] != null) {
          node.parent.value[node.type] = [
            node.parent.value[node.type],
            node.value,
          ];
        } else {
          node.parent.value[node.type] = node.value;
        }

        delete node.parent.value[node.termOrType];
      }

      node = node.parent;

      if (node == null) {
        break;
      }

      continue;
    }

    // get the next child of the current node
    if (node.isArray) {
      def = undefined;
      type = undefined;
      termOrType = undefined;
      value = node.children[node.index];
    } else {
      [termOrType, value] = (node as ObjectNode).children[node.index];

      if (termOrType[0] === '@') {
        node.index++;
        continue;
      }

      def = node.context?.getOrCreateTypeDef(termOrType);
      type = def?.id;
    }

    node.index++;

    let asValue = false;

    if (def?.type === '@id') {
      asValue = true;

      value = node.context.expandIRIs(value as string);
    }
    
    // expand the selected child
    if (value == null || asValue || scalaTypes.has(typeof value)) {
      if (!node.isArray && type != null && type !== termOrType) {
        if (Array.isArray(node.value[type])) {
          node.value[type].push(value);
        } else if (node.value[type] != null) {
          node.value[type] = [
            node.value[type],
            value,
          ];
        } else {
          node.value[type] = value;
        }

        delete node.value[termOrType];
      }

      continue;
    } else if (Array.isArray(value)) {
      node = {
        isArray: true,
        children: value,
        value,
        index: 0,
        parent: node,
        termOrType,
        type,
        context: node.context,
        container: undefined,
      } satisfies ArrayNode;
    } else {
      node = {
        isArray: false,
        children: Object.entries(value),
        value: value as JSONObject,
        index: 0,
        parent: node,
        termOrType,
        type,
        context: node.context,
        container: undefined,
      } satisfies ObjectNode;
    }
  }

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


