const urlRe = /^[a-zA-Z\\-]+:\/\/[^\.]+\./;
const aliasRe = /^([^\:]+)\:(.*)$/;
export class JSONLDContextSource {
    url;
    json;
    datatype;
    constructor(url, json) {
        this.url = url;
        this.json = json;
        if (isJSONObject(json)) {
            this.datatype = 'object';
        }
        else if (Array.isArray(json)) {
            this.datatype = 'array';
        }
        else if (json == null) {
            this.datatype = 'null';
        }
        else {
            this.datatype = typeof json;
        }
    }
}
;
export class JSONLDContextCtx {
    primary;
    sources = new Map();
    inflight = new Set();
    pending = new Set();
    failed = new Set();
    constructor(primary) {
        this.primary = primary;
    }
    hasSource(iri) {
        return this.sources.has(iri);
    }
    addSource(source) {
        if (source.url != null) {
            this.sources.set(source.url, source);
        }
    }
}
export class JSONLDContextBag {
    contexts = new Map();
    fetcher = fetch;
    cacheMethod;
    #requestInit = {
        method: 'GET',
        headers: { 'Content-Type': 'application/ld+json' },
    };
    constructor({ fetcher, contexts, cacheMethod, } = {}) {
        this.cacheMethod = cacheMethod ?? 'dont-cache';
        if (contexts instanceof Map) {
            this.contexts = contexts;
        }
        if (typeof fetcher === 'function') {
            this.fetcher = fetcher;
        }
    }
    has(iri) {
        return this.contexts.has(iri);
    }
    get(iri) {
        return this.contexts.get(iri);
    }
    set(context) {
        if (this.cacheMethod === 'dont-cache' ||
            context.url == null) {
            return;
        }
        this.contexts.set(context.url, context);
    }
}
const containerTypes = new Set([
    '@list',
    '@set',
    '@language',
    '@index',
    '@id',
    '@type',
]);
export class JSONLDTypeDef {
    id;
    type;
    container;
    context;
    constructor(id, type, container, context) {
        this.id = id;
        this.type = type;
        this.container = container;
        this.context = context;
    }
}
;
export class JSONLDKWAliases {
    '@id' = '@id';
    '@type' = '@type';
    '@container' = '@container';
    '@set' = '@set';
    '@list' = '@list';
    '@graph' = '@graph';
}
;
export class JSONLDContext {
    /**
     * The URL used to fetch this context
     */
    url;
    /**
     * The IRI of the context's document.
     *
     * This is only used if there is a single context at the top level of a JSON
     * object response.
     */
    iri;
    /**
     * The base URL that relative IRIs in referencing documents
     * are resolved from.
     */
    base;
    version;
    vocab;
    language;
    aliases;
    kwaliases;
    types;
    cache = new Map();
    constructor(url, iri, base, vocab, version, language, aliases, kwaliases, types) {
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
    getOrCreateTypeDef = (termOrType) => {
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
        }
        else if (match == null) {
            return;
        }
        if (Object.hasOwn(this.aliases, match[1])) {
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
    };
    expandTypes = (dataTypes) => {
        if (dataTypes == null) {
            return;
        }
        else if (typeof dataTypes === 'string') {
            return this.getOrCreateTypeDef(dataTypes)?.id;
        }
        let types = [];
        let def;
        for (let i = 0, l = dataTypes.length; i < l; i++) {
            def = this.getOrCreateTypeDef(dataTypes[i]);
            if (def != null)
                types.push(def.id);
        }
        if (types.length === 0)
            return;
        return types;
    };
    expandIRIs = (iris) => {
        if (iris == null) {
            return;
        }
        else if (typeof iris === 'string') {
            const def = this.getOrCreateTypeDef(iris);
            if (def != null) {
                return { '@id': def.id };
            }
            return;
        }
        const expanded = [];
        for (let i = 0, length = iris.length; i < length; i++) {
            const def = this.getOrCreateTypeDef(iris[i]);
            if (def != null) {
                expanded.push({ '@id': def.id });
            }
        }
        return expanded;
    };
    static fromOthers(iri, source, others) {
        let base;
        let version;
        let vocab;
        let language;
        let aliases = new Map();
        let kwaliases = new JSONLDKWAliases();
        let types = new Map();
        for (let i = 0, l = others.length; i < l; i++) {
            if (others[i] == null) {
                continue;
            }
            base ??= others[i].base;
            version ??= others[i].version;
            vocab ??= others[i].vocab;
            language ??= others[i].language;
            for (const [key, value] of Object.entries(kwaliases)) {
                if (kwaliases[key] === key)
                    kwaliases[key] = value;
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
        return new JSONLDContext(source.url, iri, base, vocab, version, language, aliases, kwaliases, types);
    }
    static fromJSONObject(json, url) {
        const contextJSON = json;
        const aliases = new Map();
        const kwaliases = new JSONLDKWAliases();
        const types = new Map();
        const entries = Object.entries(contextJSON);
        let base;
        if (typeof contextJSON['@base'] === 'string' &&
            urlRe.test(contextJSON['@base'])) {
            base = contextJSON['@base'];
        }
        else if (contextJSON['@base'] != null) {
            console.warn(`Invalid @base "${contextJSON['@base']}" from ${url ?? 'embedded'}`);
        }
        let version;
        if (contextJSON['@version'] === 1.1) {
            version = contextJSON['@version'];
        }
        else if (contextJSON['@version'] != null) {
            console.warn(`Invalid @version "${contextJSON['@version']}" from ${url ?? 'embedded'}`);
        }
        let vocab;
        if (typeof contextJSON['@vocab'] === 'string' &&
            urlRe.test(contextJSON['@vocab'])) {
            vocab = contextJSON['@vocab'];
        }
        else if (contextJSON['@vocab'] != null) {
            console.warn(`Invalid @vocab "${contextJSON['@vocab']}" from ${url ?? 'embedded'}`);
        }
        let language;
        if (typeof contextJSON['@language'] === 'string' &&
            contextJSON['@language'].length > 0) {
            language = contextJSON['@language'];
        }
        else if (contextJSON['@language'] != null) {
            console.warn(`Invalid @language "${contextJSON['@language']}" from ${url ?? 'embedded'}`);
        }
        let key;
        let value;
        let length = entries.length;
        let i;
        for (i = 0; i < length; i++) {
            [key, value] = entries[i];
            if (key.startsWith('@'))
                continue;
            if (typeof value !== 'string')
                continue;
            if (value === '@context') {
                console.warn(`@context cannot be aliased "${key}": "${value}" from ${url ?? 'embedded'}`);
                continue;
            }
            else if (value.startsWith('@')) {
                if (kwaliases[value] == null) {
                    console.warn(`Unsupported keyword alias "${key}": "${value}" from ${url ?? 'embedded'}`);
                    continue;
                }
                // keyword aliasing
                kwaliases[value] = key;
            }
            else if (urlRe.test(value)) {
                // vocab aliasing
                aliases[key] = value;
            }
        }
        const ctx = new JSONLDContext(url, undefined, base, vocab, version, language, aliases, kwaliases, types);
        for (i = 0; i < length; i++) {
            [key, value] = entries[i];
            if (key.startsWith('@'))
                continue;
            if (typeof value === 'string') {
                const def = ctx.getOrCreateTypeDef(value);
                ctx.types.set(key, def);
            }
            else if (isJSONObject(value)) {
                const termOrType = value['@id'] ?? key;
                const def = ctx.getOrCreateTypeDef(termOrType);
                def.type = value['@type'];
                def.container = value['@container'];
                if (key !== termOrType) {
                    ctx.types.set(key, def);
                }
            }
        }
        return ctx;
    }
    static null(url) {
        return new JSONLDContext(url, undefined, undefined, undefined, undefined, undefined, new Map(), new JSONLDKWAliases(), new Map());
    }
    static async fetch(iri, bag) {
        if (bag.has(iri)) {
            return bag.get(iri);
        }
        const res = await bag.fetcher(iri, {
            method: 'GET',
            headers: { 'Accept': 'application/ld+json' },
        });
        if (!res.ok) {
            console.warn(`Failed to fetch context "${iri}"`);
            return;
        }
        const contentType = res.headers.get('Content-Type');
        if (contentType !== 'application/ld+json') {
            console.warn(`Recieved unexpected content "${contentType}" for context "${iri}"`);
            return;
        }
        const json = await res.json();
        if (!isJSONObject(json)) {
            console.warn(`Expected object for context from "${iri}"`);
            return;
        }
        return JSONLDContext.resolve(new JSONLDContextSource(iri, json), bag);
    }
    static async resolve(source, bag) {
        const contextJSON = source.json['@context'];
        if (isJSONObject(contextJSON)) {
            const ctx = JSONLDContext.fromJSONObject(contextJSON, source.url);
            bag.set(ctx);
            return ctx;
        }
        else if (contextJSON === null) {
            const ctx = JSONLDContext.null(source.url);
            bag.set(ctx);
            return ctx;
        }
        else if (typeof contextJSON === 'string') {
            return JSONLDContext.fetch(contextJSON, bag);
        }
        else if (!Array.isArray(contextJSON)) {
            return;
        }
        const promises = [];
        for (let i = 0, length = contextJSON.length; i < length; i++) {
            if (typeof contextJSON[i] === 'string') {
                promises.push(JSONLDContext.fetch(contextJSON[i], bag));
            }
            else if (isJSONObject(contextJSON[i])) {
                promises.push(Promise.resolve(JSONLDContext.fromJSONObject(contextJSON[i])));
            }
            else {
                console.warn(contextJSON);
                throw new Error(`Invalid JSON-LD @context provided`);
            }
        }
        const others = await Promise.all(promises);
        const ctx = JSONLDContext.fromOthers(contextJSON['@id'], source, others);
        bag.set(ctx);
        return ctx;
    }
}
const scalaTypes = new Set(['boolean', 'number', 'string']);
export async function expand(input, { url, bag = new JSONLDContextBag(), } = {}) {
    if (input == null || scalaTypes.has(typeof input)) {
        console.warn(`JSON-LD input "${input}" must be an object or array`);
        return null;
    }
    let termOrType;
    let type;
    let value = null;
    let context;
    let node;
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
        };
    }
    else {
        node = {
            isArray: false,
            children: Object.entries(input),
            value: input,
            context,
            index: 0,
            parent: undefined,
            termOrType: undefined,
            type: undefined,
            container: undefined,
        };
    }
    while (true) {
        let def;
        if (node.index === 0 &&
            !node.isArray &&
            node.value['@context'] !== undefined) {
            // the node value defines a context.
            node.context = await JSONLDContext.resolve(new JSONLDContextSource(undefined, node.value), bag);
            delete node.value['@context'];
        }
        else if (node.index === 0 && node.parent != null) {
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
                }
                else if (node.parent.value[node.type] != null) {
                    node.parent.value[node.type] = [
                        node.parent.value[node.type],
                        node.value,
                    ];
                }
                else {
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
        }
        else {
            [termOrType, value] = node.children[node.index];
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
            value = node.context.expandIRIs(value);
        }
        // expand the selected child
        if (value == null || asValue || scalaTypes.has(typeof value)) {
            if (!node.isArray && type != null && type !== termOrType) {
                if (Array.isArray(node.value[type])) {
                    node.value[type].push(value);
                }
                else if (node.value[type] != null) {
                    node.value[type] = [
                        node.value[type],
                        value,
                    ];
                }
                else {
                    node.value[type] = value;
                }
                delete node.value[termOrType];
            }
            continue;
        }
        else if (Array.isArray(value)) {
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
            };
        }
        else {
            node = {
                isArray: false,
                children: Object.entries(value),
                value: value,
                index: 0,
                parent: node,
                termOrType,
                type,
                context: node.context,
                container: undefined,
            };
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
export function isJSONObject(value) {
    return typeof value === 'object' && !Array.isArray(value) && value !== null;
}
