import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  VERSION
} from "./chunk-JRODHLRL.mjs";
import {
  OracleAdapter,
  SCRIPT_RESTRICT_LEVEL,
  environment,
  identifier,
  isProductionTarget,
  managedHome,
  parse,
  policy,
  protectedProductionTrust,
  refName,
  relativePath,
  requireTrust,
  resolveConnection,
  resourceRoot,
  runProcess,
  runtimeState,
  sqlLiteral,
  sqlclToken,
  targetDigest
} from "./chunk-HIFCMPCL.mjs";
import {
  external_exports
} from "./chunk-Z5TALD4Z.mjs";
import {
  Fault,
  __commonJS,
  __require,
  __toESM,
  artifactPage,
  atomicWrite,
  canonical,
  contained,
  exists,
  hash,
  inventory,
  readJson,
  redact,
  sanitized,
  withLock,
  writeJson
} from "./chunk-WPS3CSQJ.mjs";

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar2(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias2;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap2;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar2;
    exports.isSeq = isSeq2;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path9) {
      const ctrl = callVisitor(key, node, visitor, path9);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path9, ctrl);
        return visit_(key, ctrl, visitor, path9);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path9 = Object.freeze(path9.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path9);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path9 = Object.freeze(path9.concat(node));
          const ck = visit_("key", node.key, visitor, path9);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path9);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path9) {
      const ctrl = await callVisitor(key, node, visitor, path9);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path9, ctrl);
        return visitAsync_(key, ctrl, visitor, path9);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path9 = Object.freeze(path9.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path9);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path9 = Object.freeze(path9.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path9);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path9);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path9) {
      if (typeof visitor === "function")
        return visitor(key, node, path9);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path9);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path9);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path9);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path9);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path9);
      return void 0;
    }
    function replaceNode(key, path9, node) {
      const parent = path9[path9.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name2 = parts.shift();
        switch (name2) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version2] = parts;
            if (version2 === "1.1" || version2 === "1.2") {
              this.yaml.version = version2;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version2);
              onError(6, `Unsupported YAML version ${version2}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name2}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name2 = `${prefix}${i}`;
        if (!exclude.has(name2))
          return name2;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        if (found && ctx) {
          const { anchors: anchors2, doc: doc2, maxAliasCount } = ctx;
          let data = anchors2.get(found);
          if (!data) {
            toJS.toJS(found, null, ctx);
            data = anchors2.get(found);
          }
          if (data?.res === void 0) {
            const msg = "This should not happen: Alias anchor was not resolved?";
            throw new ReferenceError(msg);
          }
          if (maxAliasCount >= 0) {
            data.count += 1;
            if (data.aliasCount === 0)
              data.aliasCount = getAliasCount(doc2, found, anchors2);
            if (data.count * data.aliasCount > maxAliasCount) {
              const msg = "Excessive alias count indicates a resource exhaustion attack";
              throw new ReferenceError(msg);
            }
          }
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const source = this.resolve(ctx.doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        return ctx.anchors.get(source).res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path9, value) {
      let v = value;
      for (let i = path9.length - 1; i >= 0; --i) {
        const k = path9[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path9) => path9 == null || typeof path9 === "object" && !!path9[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path9, value) {
        if (isEmptyPath(path9))
          this.add(value);
        else {
          const [key, ...rest] = path9;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path9) {
        const [key, ...rest] = path9;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path9, keepScalar) {
        const [key, ...rest] = path9;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path9) {
        const [key, ...rest] = path9;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path9, value) {
        const [key, ...rest] = path9;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text2, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text2;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text2.length <= endStep)
        return text2;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text2, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text2[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text2[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text2, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next2 = text2[i + 1];
            if (next2 && next2 !== " " && next2 !== "\n" && next2 !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text2[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text2;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text2;
      if (onFold)
        onFold();
      let res = text2.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text2.length;
        if (fold === 0)
          res = `
${indent}${text2.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text2[fold]}\\`;
          res += `
${indent}${text2.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text2, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text2[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text2[++i];
        } else {
          do {
            ch = text2[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text2[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name2 = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name2} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version: version2 } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version2 = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version: version2 });
        this.setSchema(version2, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path9, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path9, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name2) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name2 || prev.has(name2) ? anchors.findNewAnchor(name2 || "a", prev) : name2;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path9) {
        if (Collection.isEmptyPath(path9)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path9) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path9, keepScalar) {
        if (Collection.isEmptyPath(path9))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path9, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path9) {
        if (Collection.isEmptyPath(path9))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path9) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path9, value) {
        if (Collection.isEmptyPath(path9)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path9), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path9, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version2, options = {}) {
        if (typeof version2 === "number")
          version2 = String(version2);
        let opt;
        switch (version2) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version2;
            else
              this.directives = new directives.Directives({ version: version2 });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version2);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name2, pos, code, message) {
        super();
        this.name = name2;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next: next2, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next2?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next2 && next2.type !== "space" && next2.type !== "newline" && next2.type !== "comma" && (next2.type !== "scalar" || next2.source !== "")) {
        onError(next2.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next2?.type === "block-map" || next2?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap2 = fc.start.source === "{";
      const fcName = isMap2 ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap2 && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap2 && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap2 && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap2) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap2 ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name2 = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name2} must end with a ${expectedEnd}` : `${name2} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return unfoldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function unfoldLines(source) {
      const line = /(.*?)\r?\n/sy;
      let match = line.exec(source);
      if (!match)
        return source;
      let trimEnd, trimBoth;
      try {
        trimEnd = new RegExp("(?<![ 	])[ 	]+$");
        trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
      } catch {
        trimEnd = /[ \t]+$/;
        trimBoth = /^[ \t]+|[ \t]+$/g;
      }
      let res = match[1].replace(trimEnd, "");
      let sep = " ";
      let pos = line.lastIndex;
      while (match = line.exec(source)) {
        const lm = match[1].replace(trimBoth, "");
        if (lm === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + lm;
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next2 = source[++i];
          const cc = escapeCodes[next2];
          if (cc)
            res += cc;
          else if (next2 === "\n") {
            next2 = source[i + 1];
            while (next2 === " " || next2 === "	")
              next2 = source[++i + 1];
          } else if (next2 === "\r" && source[i + 1] === "\n") {
            next2 = source[++i + 1];
            while (next2 === " " || next2 === "	")
              next2 = source[++i + 1];
          } else if (next2 === "x" || next2 === "u" || next2 === "U") {
            const length = next2 === "x" ? 2 : next2 === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next2 = source[i + 1];
          while (next2 === " " || next2 === "	")
            next2 = source[++i + 1];
          if (next2 !== "\n" && !(next2 === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path9) => {
      let item = cst;
      for (const [field, index] of path9) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path9) => {
      const parent = visit.itemAtPath(cst, path9.slice(0, -1));
      const field = path9[path9.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path9, item, visitor) {
      let ctrl = visitor(item, path9);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path9.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path9);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path9) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar2 = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar2;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next2 = this.next ?? "stream";
        while (next2 && (incomplete || this.hasChars(1)))
          next2 = yield* this.parseNext(next2);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next2 = this.buffer[indent + offset + 1];
            if (next2 === "\n" || !next2 && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next2) {
        switch (next2) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next2 = this.charAt(1);
            if (this.flowKey || isEmpty(next2) || next2 === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next2 = this.buffer[i2 + 1];
              if (!next2 && !this.atEnd)
                return this.setNext("block-scalar");
              if (next2 === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next2 = this.buffer[i + 1];
            if (isEmpty(next2) || inFlow && flowIndicatorChars.has(next2))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next2 = this.buffer[i + 1];
            if (ch === "\r") {
              if (next2 === "\n") {
                i += 1;
                ch = "\n";
                next2 = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next2 === "#" || inFlow && flowIndicatorChars.has(next2))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument2(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse2(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument2(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse2;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument2;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// packages/core/src/testing.ts
import path8 from "node:path";
import { spawn } from "node:child_process";
import { mkdir as mkdir6, readFile as readFile6, cp as cp5, chmod as chmod2 } from "node:fs/promises";
import { randomUUID as randomUUID4 } from "node:crypto";

// packages/core/src/artifacts.ts
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readFile, readdir, rm, mkdir } from "node:fs/promises";
var ArtifactService = class {
  constructor(ctx) {
    this.ctx = ctx;
  }
  ctx;
  async save(content, kind) {
    return this.persist(redact(content), kind, "text");
  }
  async saveJson(value, kind) {
    return this.persist(JSON.stringify(sanitized(value)), kind, "json");
  }
  async resultDirectory(create = false) {
    const home = managedHome();
    if (create) await mkdir(home, { recursive: true, mode: 448 });
    if (!await exists(home)) return null;
    return contained(home, path.join("results", hash(this.ctx.root)));
  }
  async persist(content, kind, format) {
    const id = randomUUID(), directory = format === "json" ? await this.resultDirectory(true) : await contained(this.ctx.root, this.ctx.config.artifacts.directory);
    await atomicWrite(path.join(directory, id + ".txt"), content);
    await writeJson(path.join(directory, id + ".json"), {
      id,
      kind,
      sha256: hash(content),
      format,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: new Date(Date.now() + this.ctx.config.artifacts.retentionDays * 864e5).toISOString(),
      classification: "private-sanitized-text"
    });
    return id;
  }
  async read(id, offset = 0, limit = 4096) {
    parse(external_exports.uuid(), id);
    parse(external_exports.number().int().min(0).max(1e7), offset);
    parse(external_exports.number().int().min(1).max(16384), limit);
    const results = await this.resultDirectory();
    const directory = results && await exists(path.join(results, id + ".json")) ? results : await contained(this.ctx.root, this.ctx.config.artifacts.directory);
    const metadata = await readJson(await contained(directory, id + ".json"));
    if (Date.parse(metadata.expiresAt) < Date.now())
      throw new Fault("ARTIFACT_EXPIRED", "Artifact retention has expired.", 3);
    if (/auth|wallet|credential/i.test(metadata.kind))
      throw new Fault(
        "PRIVATE_ARTIFACT_DENIED",
        "Authentication and credential artifacts cannot be read through tools.",
        4
      );
    const content = await readFile(await contained(directory, id + ".txt"), "utf8");
    if (hash(content) !== metadata.sha256)
      throw new Fault("ARTIFACT_CHANGED", "Artifact integrity check failed.", 5);
    return artifactPage(content, metadata.format ?? "text", id, offset, limit);
  }
  // `results` limits pruning to the managed MCP result archive, so automatic
  // cleanup never scans a project-configured directory.
  async prune(scope = "all") {
    const directories = [
      ...scope === "all" ? [await contained(this.ctx.root, this.ctx.config.artifacts.directory)] : [],
      await this.resultDirectory()
    ];
    let removed = 0;
    for (const directory of directories) {
      if (!directory || !await exists(directory)) continue;
      const relative = path.relative(this.ctx.root, directory).split(path.sep).join("/");
      if ([".apexrest/sync", ".apexrest/backups", ".apexrest/deployments"].some(
        (root) => relative === root || relative.startsWith(root + "/")
      ))
        continue;
      for (const file of await readdir(directory))
        if (/^[a-f0-9-]{36}\.json$/.test(file)) {
          const metadata = await readJson(path.join(directory, file)).catch(() => null);
          if (typeof metadata?.expiresAt === "string" && Date.parse(metadata.expiresAt) < Date.now()) {
            await rm(path.join(directory, file));
            await rm(path.join(directory, file.replace(".json", ".txt")), { force: true });
            removed++;
          }
        }
    }
    return { removed };
  }
};

// packages/core/src/deploy.ts
import path7 from "node:path";
import { readFile as readFile5, mkdir as mkdir5, cp as cp4, open as open3, rename } from "node:fs/promises";
import { createPublicKey, randomUUID as randomUUID3, verify } from "node:crypto";

// packages/core/src/deployment-control.ts
import path2 from "node:path";
import { hostname } from "node:os";
import { rm as rm2 } from "node:fs/promises";
function coordination(env) {
  return {
    backend: "local",
    scope: "managed-home-schema",
    // Bind plans to the history store. Moving a plan to a fresh home is not migration recovery.
    storeDigest: hash(canonical({ home: managedHome(), ...env.databaseIdentity, schema: env.parsingSchema }))
  };
}
var ownerSchema = external_exports.strictObject({
  runId: external_exports.string(),
  pid: external_exports.number().int().positive(),
  hostname: external_exports.string(),
  phase: external_exports.enum(["preparing", "writing"]),
  createdAt: external_exports.string()
});
var historySchema = external_exports.array(
  external_exports.strictObject({
    version: external_exports.string(),
    checksum: external_exports.string().regex(/^[a-f0-9]{64}$/),
    status: external_exports.enum(["started", "succeeded"]),
    run_id: external_exports.string()
  })
);
var LocalDeploymentControl = class {
  directory;
  constructor(env) {
    const key = hash(canonical({ ...env.databaseIdentity, schema: env.parsingSchema }));
    this.directory = path2.join(managedHome(), "deployment-control", key);
  }
  file(name2) {
    return path2.join(this.directory, name2);
  }
  async history() {
    const file = this.file("history.json");
    return await exists(file) ? parse(historySchema, await readJson(file)) : [];
  }
  async owner() {
    const file = this.file("active.json");
    try {
      return parse(ownerSchema, await readJson(file));
    } catch (error) {
      if (error.code === "ENOENT") return void 0;
      throw error;
    }
  }
  async acquire(runId) {
    await withLock(this.file("control.lock"), async () => {
      const owner = await this.owner();
      if (owner) {
        let dead = false;
        if (owner.hostname === hostname()) {
          try {
            process.kill(owner.pid, 0);
          } catch (e) {
            dead = e.code === "ESRCH";
          }
        }
        if (!dead || owner.phase === "writing")
          throw new Fault(
            "TARGET_LOCKED",
            "A runner owns this schema or an interrupted write needs reconciliation. Preserve its control state.",
            5,
            "conflict"
          );
      }
      await writeJson(this.file("active.json"), {
        runId,
        pid: process.pid,
        hostname: hostname(),
        phase: "preparing",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    });
  }
  async assertOwner(runId) {
    const owner = await this.owner();
    if (owner?.runId !== runId || owner.pid !== process.pid || owner.hostname !== hostname())
      throw new Fault(
        "LEASE_LOST",
        "Local deployment ownership is no longer confirmed.",
        6,
        "outcome_unknown"
      );
    return owner;
  }
  async markWriting(runId) {
    await withLock(this.file("control.lock"), async () => {
      await writeJson(this.file("active.json"), { ...await this.assertOwner(runId), phase: "writing" });
    });
  }
  async migration(runId, version2, checksum, status) {
    await withLock(this.file("control.lock"), async () => {
      await this.assertOwner(runId);
      const history = await this.history(), previous = history.find((row) => row.version === version2);
      if (status === "started" ? Boolean(previous) : !previous || previous.run_id !== runId || previous.checksum !== checksum || previous.status !== "started")
        throw new Fault(
          "MIGRATION_HISTORY_CONFLICT",
          "Migration history requires reconciliation; it cannot be replayed or overwritten.",
          5
        );
      const next2 = history.filter((row) => row.version !== version2);
      next2.push({ version: version2, checksum, status, run_id: runId });
      await writeJson(
        this.file("history.json"),
        next2.sort((a, b) => a.version.localeCompare(b.version))
      );
    });
  }
  async release(runId) {
    await withLock(this.file("control.lock"), async () => {
      await this.assertOwner(runId);
      await rm2(this.file("active.json"));
    });
  }
};

// packages/core/src/sync.ts
import path3 from "node:path";
import { lstat, mkdir as mkdir2, readdir as readdir2, realpath, open, cp, chmod } from "node:fs/promises";
var digest = external_exports.string().regex(/^[a-f0-9]{64}$/);
var snapshotSchema = external_exports.strictObject({
  directory: relativePath,
  files: external_exports.record(relativePath, digest),
  digest
});
var serverMetadataSchema = external_exports.strictObject({
  lastUpdatedOn: external_exports.string().nullable(),
  lastUpdatedBy: external_exports.string().nullable()
});
var syncStateSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  syncId: external_exports.uuid(),
  revision: external_exports.number().int().nonnegative(),
  projectRoot: external_exports.string(),
  projectId: external_exports.string(),
  environment: external_exports.string(),
  targetDigest: digest,
  target: external_exports.record(external_exports.string(), external_exports.unknown()),
  sourceDir: relativePath,
  toolchainDigest: digest,
  runtimeVersion: external_exports.string(),
  compilerVersion: external_exports.string().min(1),
  exportedAt: external_exports.iso.datetime(),
  baseline: snapshotSchema,
  backup: external_exports.strictObject({ backupId: external_exports.uuid(), checksum: digest }),
  observedMetadata: serverMetadataSchema,
  lastSuccessfulImport: external_exports.strictObject({
    at: external_exports.iso.datetime(),
    runId: external_exports.uuid(),
    snapshot: snapshotSchema
  }).nullable(),
  status: external_exports.enum(["ready", "importing", "verification_failed", "outcome_unknown", "invalidated"]),
  importingRunId: external_exports.uuid().nullable()
});
async function syncPath(ctx, relative) {
  const file = await contained(ctx.root, relative);
  let probe = ctx.root;
  for (const part of path3.relative(ctx.root, file).split(path3.sep).filter(Boolean)) {
    probe = path3.join(probe, part);
    if (await exists(probe)) {
      if ((await lstat(probe)).isSymbolicLink())
        throw new Fault("SYNC_PATH_UNSAFE", "Working-copy storage rejects symlinks.", 5);
    }
  }
  return file;
}
async function privateCopy(source, destination) {
  await cp(source, destination, { recursive: true });
  async function secure(directory) {
    await chmod(directory, 448);
    for (const entry of await readdir2(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Fault("SYNC_PATH_UNSAFE", "Private copies reject symlinks.", 5);
      const file = path3.join(directory, entry.name);
      if (entry.isDirectory()) await secure(file);
      else if (entry.isFile()) await chmod(file, 384);
      else throw new Fault("SYNC_PATH_UNSAFE", "Private copies accept regular files only.", 5);
    }
  }
  await secure(destination);
}
async function checkSnapshot(ctx, snapshot) {
  if (!snapshot.directory.startsWith(".apexrest/"))
    throw new Fault("SYNC_ARTIFACT_INVALID", "Snapshot must be private project storage.", 5);
  const actual = await inventory(await syncPath(ctx, snapshot.directory));
  if (!Object.keys(actual).length || canonical(actual) !== canonical(snapshot.files) || hash(canonical(actual)) !== snapshot.digest)
    throw new Fault("SYNC_ARTIFACT_INVALID", "Working-copy snapshot checksum verification failed.", 5);
  return actual;
}
async function checkSyncBackup(ctx, backup, envDigest, environmentName) {
  const directory = await syncPath(ctx, ".apexrest/backups/" + backup.backupId);
  const metadata = await readJson(
    await syncPath(ctx, ".apexrest/backups/" + backup.backupId + "/backup.json")
  );
  const files = await inventory(await syncPath(ctx, ".apexrest/backups/" + backup.backupId + "/application"));
  if (metadata.schemaVersion !== 1 || metadata.environment !== environmentName || metadata.backupId !== backup.backupId || metadata.targetDigest !== envDigest || metadata.digest !== backup.checksum || hash(canonical(files)) !== backup.checksum || canonical(metadata.files) !== canonical(files) || !Object.keys(files).length)
    throw new Fault("BACKUP_INVALID", "Initial SQL backup checksum or target verification failed.", 5);
}
function checkpoint(state) {
  return state.lastSuccessfulImport?.snapshot ?? state.baseline;
}
var SyncStore = class {
  constructor(ctx, env, name2) {
    this.ctx = ctx;
    this.env = env;
    this.name = name2;
  }
  ctx;
  env;
  name;
  async file(key = targetDigest(this.env)) {
    return syncPath(this.ctx, ".apexrest/sync/" + key + "/state.json");
  }
  async lock(action) {
    return withLock(await syncPath(this.ctx, ".apexrest/sync/state.lock"), action);
  }
  /** Scan environment records so a changed target cannot silently become a legacy project. */
  async read(allowMappingChange = false) {
    const base = await syncPath(this.ctx, ".apexrest/sync");
    if (!await exists(base)) return null;
    const matches = [];
    for (const entry of await readdir2(base, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Fault("SYNC_PATH_UNSAFE", "Sync storage contains a symlink.", 5);
      if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
      const file = await this.file(entry.name);
      if (!await exists(file)) {
        if (await exists(await syncPath(this.ctx, ".apexrest/sync/" + entry.name + "/journal.jsonl")))
          throw new Fault(
            "SYNC_STATE_INVALID",
            "A durable sync journal exists but its state is missing. Recover it explicitly; no export fallback.",
            5
          );
        continue;
      }
      let state2;
      try {
        state2 = syncStateSchema.parse(await readJson(file));
      } catch {
        throw new Fault(
          "SYNC_STATE_INVALID",
          "Corrupt working-copy state requires explicit recovery; no export fallback.",
          5
        );
      }
      if (state2.targetDigest !== entry.name)
        throw new Fault("SYNC_STATE_INVALID", "Sync record storage key differs from its target.", 5);
      if (state2.targetDigest === targetDigest(this.env) && state2.environment !== this.name && state2.status !== "invalidated")
        throw new Fault(
          "SYNC_MAPPING_CHANGED",
          "This target is bound to another environment. Explicitly invalidate the previous mapping first.",
          5
        );
      if (state2.environment === this.name && state2.status !== "invalidated") matches.push(state2);
      else if (state2.targetDigest === targetDigest(this.env) && state2.environment === this.name)
        matches.push(state2);
    }
    const active = matches.filter((s) => s.status !== "invalidated");
    if (active.length > 1)
      throw new Fault("SYNC_STATE_INVALID", "Multiple active records require reconciliation.", 5);
    const state = active[0] ?? matches[0] ?? null;
    if (state && state.status !== "invalidated" && !allowMappingChange) await this.checkMapping(state);
    return state;
  }
  async checkMapping(state) {
    const { readFile: readFile7 } = await import("node:fs/promises");
    if (state.projectRoot !== await realpath(this.ctx.root) || state.projectId !== this.ctx.config.projectId || state.environment !== this.name || state.targetDigest !== targetDigest(this.env) || state.sourceDir !== this.ctx.config.application.sourceDir || state.runtimeVersion !== VERSION || state.toolchainDigest !== hash(await readFile7(await contained(this.ctx.root, this.ctx.config.toolchain.lockFile))) || await isProductionTarget(this.env))
      throw new Fault(
        "SYNC_MAPPING_CHANGED",
        "Project, target, source directory or toolchain changed. Explicit refresh or invalidate is required.",
        5
      );
  }
  async validate(state, ready = true) {
    await this.checkMapping(state);
    if (ready && state.status !== "ready")
      throw new Fault(
        "SYNC_BLOCKED",
        `Working copy is ${state.status}. Inspect the existing run and reconcile before writes.`,
        5
      );
    if (state.baseline.directory !== ".apexrest/sync/" + state.targetDigest + "/baselines/" + state.syncId + "/application" || state.lastSuccessfulImport && state.lastSuccessfulImport.snapshot.directory !== ".apexrest/deployments/" + state.lastSuccessfulImport.runId + "/snapshot/" + state.sourceDir)
      throw new Fault(
        "SYNC_ARTIFACT_INVALID",
        "Snapshot reference does not match its sync or deployment owner.",
        5
      );
    if (state.status === "ready" && (await new LocalDeploymentControl(this.env).owner())?.phase === "writing")
      throw new Fault("SYNC_BLOCKED", "A writing owner must complete or be reconciled before reuse.", 5);
    await checkSnapshot(this.ctx, state.baseline);
    if (state.lastSuccessfulImport) await checkSnapshot(this.ctx, state.lastSuccessfulImport.snapshot);
    await checkSyncBackup(this.ctx, state.backup, state.targetDigest, this.name);
  }
  async write(state) {
    const valid = syncStateSchema.parse(state);
    const file = await this.file(valid.targetDigest);
    await mkdir2(path3.dirname(file), { recursive: true, mode: 448 });
    const journalFile = await syncPath(this.ctx, ".apexrest/sync/" + valid.targetDigest + "/journal.jsonl");
    const journal2 = await open(journalFile, "a", 384);
    try {
      await journal2.writeFile(
        JSON.stringify({
          at: (/* @__PURE__ */ new Date()).toISOString(),
          syncId: valid.syncId,
          revision: valid.revision,
          status: valid.status,
          importingRunId: valid.importingRunId,
          baseline: valid.baseline.directory,
          backupId: valid.backup.backupId,
          latestApplied: valid.lastSuccessfulImport?.snapshot.directory ?? null
        }) + "\n"
      );
      await journal2.sync();
    } finally {
      await journal2.close();
    }
    await writeJson(file, valid);
    const directory = process.platform !== "win32" ? await open(path3.dirname(file), "r") : null;
    try {
      await directory?.sync();
    } finally {
      await directory?.close();
    }
  }
  async status() {
    const state = await this.read(true);
    if (!state) return { mode: "full-export", status: "absent", serverFreshness: "not-checked" };
    let blockedReason = null;
    try {
      await this.validate(state, false);
    } catch (error) {
      blockedReason = error instanceof Fault ? error.code : "SYNC_ARTIFACT_INVALID";
    }
    if ((await new LocalDeploymentControl(this.env).owner())?.phase === "writing")
      blockedReason = "SYNC_BLOCKED";
    const source = await syncPath(this.ctx, state.sourceDir);
    const files = await exists(source) ? await inventory(source) : {};
    return {
      mode: state.status === "invalidated" ? "full-export" : "working-copy",
      syncId: state.syncId,
      revision: state.revision,
      status: state.status,
      exportedAt: state.exportedAt,
      lastSuccessfulImport: state.lastSuccessfulImport ? {
        at: state.lastSuccessfulImport.at,
        runId: state.lastSuccessfulImport.runId,
        digest: state.lastSuccessfulImport.snapshot.digest
      } : null,
      backupId: state.backup.backupId,
      importingRunId: state.importingRunId,
      dirty: canonical(files) !== canonical(checkpoint(state).files),
      blocked: !!blockedReason || !["ready", "invalidated"].includes(state.status),
      blockedReason,
      serverFreshness: "not-checked",
      assumption: "single-editor"
    };
  }
};

// packages/core/src/composer/materializer.ts
import path6 from "node:path";
import { readFile as readFile4, mkdir as mkdir4, cp as cp3, rm as rm3, open as open2 } from "node:fs/promises";
import { randomUUID as randomUUID2 } from "node:crypto";

// packages/core/src/composer/schemas.ts
var digest2 = external_exports.string().regex(/^[a-f0-9]{64}$/);
var name = external_exports.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
var version = external_exports.string().regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/);
var blockId = external_exports.string().regex(/^block:[a-z0-9-]+\/[a-z0-9-]+$/);
var OWNED_TEXT_LIMIT = 1024 * 1024;
var text = external_exports.string().max(OWNED_TEXT_LIMIT);
var literalValue = external_exports.string().max(128).regex(/^[^\x00-\x1f\x7f`]*$/, "Enumerated values must be single-line text without backticks.");
var fieldSchema = external_exports.strictObject({
  column: identifier,
  type: external_exports.enum(["string", "integer", "decimal", "date", "timestamp", "boolean"]),
  nullable: external_exports.boolean(),
  maxLength: external_exports.number().int().positive().optional(),
  precision: external_exports.number().int().positive().optional(),
  scale: external_exports.number().int().optional(),
  enum: external_exports.array(literalValue).max(100).optional()
});
var contractBase = {
  schemaVersion: external_exports.literal(1),
  provenance: external_exports.string().min(1).max(512)
};
var contractSchema = external_exports.discriminatedUnion("kind", [
  external_exports.strictObject({
    ...contractBase,
    kind: external_exports.literal("authorization"),
    rowPredicate: text.optional(),
    expression: text.optional()
  }).refine(
    (c) => Boolean(c.rowPredicate?.trim() || c.expression?.trim()),
    "Authorization requires a server expression or row predicate."
  ),
  external_exports.strictObject({ ...contractBase, kind: external_exports.literal("key"), fields: external_exports.array(name).min(1).max(16) }),
  external_exports.strictObject({
    ...contractBase,
    kind: external_exports.literal("command"),
    transaction: external_exports.literal("caller-owned"),
    overload: external_exports.string().min(1).max(32).optional(),
    parameters: external_exports.record(
      identifier,
      external_exports.strictObject({
        mode: external_exports.enum(["in", "out", "in-out"]),
        type: external_exports.enum([
          "NUMBER",
          "PLS_INTEGER",
          "BINARY_INTEGER",
          "VARCHAR2",
          "CHAR",
          "NVARCHAR2",
          "NCHAR",
          "DATE",
          "TIMESTAMP"
        ]),
        defaulted: external_exports.boolean().default(false)
      })
    )
  }),
  external_exports.strictObject({ ...contractBase, kind: external_exports.literal("errors") })
]);
var entitySchema = external_exports.strictObject({
  read: external_exports.strictObject({
    kind: external_exports.enum(["oracle-table", "oracle-view"]),
    object: identifier,
    key: external_exports.array(name).min(1).max(16),
    keyContract: external_exports.string().optional(),
    fields: external_exports.record(name, fieldSchema)
  }),
  authorization: external_exports.strictObject({ readContract: external_exports.string(), writeContract: external_exports.string().optional() }),
  capabilities: external_exports.strictObject({ optimisticLock: external_exports.strictObject({ field: name }).optional() }).default({})
});
var commandSchema = external_exports.strictObject({
  kind: external_exports.literal("oracle-procedure"),
  package: identifier,
  procedure: identifier,
  signatureRef: external_exports.string(),
  transaction: external_exports.literal("caller-owned"),
  inputs: external_exports.record(identifier, external_exports.strictObject({ from: external_exports.string(), mode: external_exports.enum(["in", "in-out"]) })),
  outputs: external_exports.strictObject({
    recordKey: external_exports.strictObject({ from: identifier }),
    recordVersion: external_exports.strictObject({ from: identifier })
  }),
  errorContract: external_exports.string(),
  authorizationContract: external_exports.string()
});
var parametersSchema = external_exports.strictObject({
  title: external_exports.string().min(1).max(180),
  editableFields: external_exports.array(name).max(32).default([]),
  createEnabled: external_exports.boolean().default(false),
  editEnabled: external_exports.boolean().default(false),
  deleteEnabled: external_exports.literal(false).default(false),
  groupField: name.optional(),
  filterField: name.optional(),
  timeField: name.optional(),
  detailField: name.optional(),
  parentField: name.optional()
});
var instanceSchema = external_exports.strictObject({
  use: external_exports.string().regex(/^block:[a-z0-9-]+\/[a-z0-9-]+@\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/),
  parameters: parametersSchema,
  bindings: external_exports.strictObject({ records: external_exports.string(), saveRecord: external_exports.string().optional() }),
  ownership: external_exports.enum(["managed", "extended", "detached"]).default("managed"),
  extensions: external_exports.partialRecord(external_exports.enum(["beforeSaveValidation", "afterSaveNotification"]), text).default({})
});
var blueprintSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  application: external_exports.strictObject({
    mode: external_exports.literal("extend"),
    environment: name.optional(),
    compatibilityProfile: external_exports.string(),
    preserve: external_exports.strictObject({
      authentication: external_exports.literal(true),
      authorization: external_exports.literal(true),
      unmanagedSource: external_exports.literal(true)
    })
  }),
  entities: external_exports.record(name, entitySchema),
  commands: external_exports.record(name, commandSchema).default({}),
  contracts: external_exports.record(external_exports.string().regex(/^project:[a-z0-9-]+$/), contractSchema).default({}),
  blocks: external_exports.record(name, instanceSchema),
  connections: external_exports.array(
    external_exports.strictObject({
      from: external_exports.string(),
      to: external_exports.string(),
      behavior: external_exports.strictObject({ coalesce: external_exports.literal(true) })
    })
  ).max(256).default([])
});
var blockSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  id: blockId,
  version,
  kind: external_exports.literal("block"),
  name: external_exports.string().min(1).max(180),
  aliases: external_exports.array(external_exports.string().max(128)),
  status: external_exports.enum(["draft", "experimental", "verified", "deprecated", "revoked"]),
  license: external_exports.string(),
  origin: external_exports.string(),
  recipeRefs: external_exports.array(external_exports.string()),
  compatibility: external_exports.strictObject({ profileRefs: external_exports.array(external_exports.string()) }),
  renderer: external_exports.enum([
    "report-dialog",
    "status-summary",
    "filtered-list",
    "read-only-detail",
    "history-timeline",
    "master-detail"
  ]),
  ports: external_exports.strictObject({
    inputs: external_exports.array(external_exports.enum(["records", "saveRecord"])),
    outputs: external_exports.array(external_exports.literal("saved"))
  }),
  requires: external_exports.strictObject({ blocks: external_exports.array(external_exports.string()), capabilities: external_exports.array(external_exports.string()) }),
  source: external_exports.strictObject({ files: external_exports.array(relativePath) }),
  effects: external_exports.strictObject({
    local: external_exports.array(external_exports.string()),
    deployment: external_exports.array(external_exports.string()),
    applicationRuntime: external_exports.array(external_exports.string()),
    authentication: external_exports.literal("preserve")
  }),
  limitations: external_exports.array(external_exports.string())
});
var allocationSchema = external_exports.strictObject({
  page: external_exports.number().int().positive(),
  dialog: external_exports.number().int().positive().nullable(),
  prefix: name
});
var rendererSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  renderer: blockSchema.shape.renderer,
  escape: external_exports.literal("native-plain-text"),
  transaction: external_exports.literal("caller-owned"),
  savedPayload: external_exports.tuple([
    external_exports.literal("entityRef"),
    external_exports.literal("recordKey"),
    external_exports.literal("recordVersion"),
    external_exports.literal("operation"),
    external_exports.literal("originInstance"),
    external_exports.literal("correlationId")
  ])
});
var ownerSchema2 = external_exports.strictObject({
  instanceId: name,
  blockId,
  version,
  mode: external_exports.enum(["managed", "extended", "detached"]),
  files: external_exports.record(relativePath, digest2),
  bases: external_exports.record(relativePath, digest2),
  allocation: allocationSchema,
  consumers: external_exports.array(name),
  provenance: digest2
});
var stateSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  generatorVersion: external_exports.literal("1"),
  generationDigest: digest2,
  blueprintDigest: digest2,
  lockDigest: digest2,
  owners: external_exports.record(name, ownerSchema2)
});
var lockSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  generatorVersion: external_exports.literal("1"),
  resolverPolicyVersion: external_exports.literal("1"),
  blueprintSemanticDigest: digest2,
  catalogDigest: digest2,
  compatibilityProfile: external_exports.string(),
  packages: external_exports.record(external_exports.string(), digest2),
  contractDigest: digest2
});
var diagnosticSchema = external_exports.strictObject({
  code: external_exports.string(),
  message: external_exports.string(),
  severity: external_exports.enum(["error", "warning", "info"])
});
var operationSchema = external_exports.strictObject({
  path: relativePath,
  before: digest2.nullable(),
  after: digest2.nullable(),
  content: text.nullable(),
  reason: external_exports.string()
});
var planSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  generatorVersion: external_exports.literal("1"),
  kind: external_exports.enum(["composition", "recovery-resume", "recovery-restore"]),
  status: external_exports.enum(["materializable", "blocked"]),
  projectId: external_exports.string(),
  blueprintPath: relativePath,
  blueprintDigest: digest2,
  catalogDigest: digest2,
  configurationDigest: digest2,
  toolchainDigest: digest2,
  sourceInventory: external_exports.record(relativePath, digest2),
  stateDigest: digest2.nullable(),
  validation: external_exports.enum(["compiler", "source-only"]),
  mode: external_exports.enum(["offline", "connected"]),
  contextDigest: digest2,
  environment: external_exports.string().nullable(),
  review: external_exports.strictObject({
    entities: external_exports.record(name, entitySchema),
    commands: external_exports.record(name, commandSchema),
    contracts: external_exports.record(external_exports.string(), contractSchema),
    packages: external_exports.record(
      external_exports.string(),
      external_exports.strictObject({
        digest: digest2,
        origin: external_exports.string(),
        license: external_exports.string(),
        effects: blockSchema.shape.effects,
        dependencies: external_exports.array(external_exports.string())
      })
    )
  }),
  recovery: external_exports.strictObject({ journalId: external_exports.uuid(), sourcePlanDigest: digest2, recordsDigest: digest2 }).optional(),
  allocations: external_exports.record(name, allocationSchema),
  operations: external_exports.array(operationSchema).max(2048),
  state: stateSchema.nullable(),
  lock: lockSchema.nullable(),
  diagnostics: external_exports.array(diagnosticSchema),
  digest: digest2
});
var evidenceSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  kind: external_exports.enum([
    "schema",
    "unit",
    "compiler",
    "sql-read",
    "sql-write",
    "import",
    "browser-observation",
    "browser-automation",
    "authorization",
    "upgrade",
    "packaging"
  ]),
  status: external_exports.enum(["passed", "failed", "not-run", "blocked", "stale"]),
  sourceDigest: digest2,
  generatorDigest: digest2,
  configurationDigest: digest2,
  fixtureDigest: digest2,
  profile: external_exports.string(),
  tool: external_exports.string(),
  runner: external_exports.enum(["local", "mock", "oracle", "native-host"]),
  timestamp: external_exports.string(),
  artifacts: external_exports.array(external_exports.string()),
  reason: external_exports.string()
});

// packages/core/src/composer/formats.ts
var import_yaml = __toESM(require_dist(), 1);
import { readFile as readFile2, lstat as lstat2, realpath as realpath2 } from "node:fs/promises";
import path4 from "node:path";
function canonical2(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical2).join(",") + "]";
  if (value && typeof value === "object")
    return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonical2(value[k])).join(",") + "}";
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Fault("INVALID_DOCUMENT", "Non-finite numbers are unsupported.", 2);
  const result = JSON.stringify(value);
  if (result === void 0) throw new Fault("INVALID_DOCUMENT", "Undefined values are unsupported.", 2);
  return result;
}
var documentText = (value) => JSON.stringify(JSON.parse(canonical2(value)), null, 2) + "\n";
var semanticDigest = (value) => hash(canonical2(value));
var authoringLimits = { document: 1024 * 1024, scalar: 65536 };
var planLimits = { document: 64 * 1024 * 1024, scalar: 1024 * 1024 };
function parseDocumentData(source, limits = authoringLimits) {
  if (Buffer.byteLength(source) > limits.document)
    throw new Fault("DOCUMENT_LIMIT", `Document exceeds ${limits.document} bytes.`, 2);
  const doc = (0, import_yaml.parseDocument)(source, {
    version: "1.2",
    schema: "core",
    strict: true,
    uniqueKeys: true,
    keepSourceTokens: true
  });
  const invalid = doc.errors;
  if (invalid.length || doc.warnings.length)
    throw new Fault(
      "INVALID_DOCUMENT",
      invalid.map((e) => e.message).concat(doc.warnings.map((e) => e.message)).join("; "),
      2
    );
  let count = 0;
  const nodes = limits === authoringLimits ? 1e4 : 1e6;
  function inspect(node, depth) {
    if (++count > nodes || depth > 64)
      throw new Fault("DOCUMENT_LIMIT", "Document structure exceeds limits.", 2);
    if ((0, import_yaml.isAlias)(node)) throw new Fault("INVALID_DOCUMENT", "Aliases are unsupported.", 2);
    if (node && typeof node === "object" && "tag" in node && node.tag)
      throw new Fault("INVALID_DOCUMENT", "Explicit tags are unsupported.", 2);
    if ((0, import_yaml.isMap)(node))
      for (const pair of node.items) {
        if (!(0, import_yaml.isScalar)(pair.key) || typeof pair.key.value !== "string" || ["__proto__", "constructor", "prototype", "<<"].includes(pair.key.value))
          throw new Fault("INVALID_DOCUMENT", "Unsafe or non-string mapping key.", 2);
        inspect(pair.value, depth + 1);
      }
    else if ((0, import_yaml.isSeq)(node)) for (const item of node.items) inspect(item, depth + 1);
    else if ((0, import_yaml.isScalar)(node) && typeof node.value === "string" && node.value.length > limits.scalar)
      throw new Fault("DOCUMENT_LIMIT", `Scalar exceeds ${limits.scalar} characters.`, 2);
  }
  inspect(doc.contents, 0);
  const value = doc.toJS({ maxAliasCount: 0 });
  canonical2(value);
  return value;
}
function validate(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new Fault("COMPOSER_INVALID_INPUT", result.error.message, 2);
  return result.data;
}
async function safePath(root, relative) {
  if (path4.isAbsolute(relative) || relative.split(/[\\/]/).includes(".."))
    throw new Fault("COMPOSER_PATH_UNSAFE", "Expected a contained relative path.", 2);
  const file = await contained(root, relative);
  let probe = await realpath2(root);
  for (const part of path4.relative(probe, file).split(path4.sep).filter(Boolean)) {
    probe = path4.join(probe, part);
    let info;
    try {
      info = await lstat2(probe);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (info) {
      if (info.isSymbolicLink() || !info.isFile() && !info.isDirectory())
        throw new Fault("COMPOSER_PATH_UNSAFE", "Symlinks and special files are unsupported.", 2);
    }
  }
  return file;
}
async function readDocument(root, file, schema, limits = authoringLimits) {
  return validate(schema, parseDocumentData(await readFile2(await safePath(root, file), "utf8"), limits));
}
function planDigest(plan) {
  const { digest: _digest, ...payload } = plan;
  return semanticDigest(payload);
}

// packages/core/src/composer/catalog.ts
import path5 from "node:path";
import { readFile as readFile3, readdir as readdir3, cp as cp2, mkdir as mkdir3 } from "node:fs/promises";
async function loadCatalog(project, cachePayloads = true) {
  const root = path5.join(resourceRoot(), "blocks");
  const index = JSON.parse(await readFile3(await safePath(root, "manifest.json"), "utf8"));
  if (index.schemaVersion !== 1 || !Array.isArray(index.packages) || index.packages.length > 1e3)
    throw new Fault("CATALOG_INVALID", "Unsupported block registry.", 2);
  const generator = JSON.parse(await readFile3(await safePath(root, "generator.json"), "utf8"));
  const revocations = JSON.parse(await readFile3(await safePath(root, "revocations.json"), "utf8"));
  if (!Array.isArray(revocations)) throw new Fault("CATALOG_INVALID", "Invalid revocation registry.", 5);
  const packages = /* @__PURE__ */ new Map();
  async function add(base, relative, expected) {
    const directory = await safePath(base, relative), files = await inventory(directory), digest3 = semanticDigest(files);
    if (expected && expected !== digest3)
      throw new Fault("PACKAGE_CORRUPT", "Block package integrity check failed.", 5);
    if (project && cachePayloads) {
      const cache = await safePath(project, `.apexrest/composer/cache/${digest3}`);
      if (!await exists(cache)) {
        await mkdir3(path5.dirname(cache), { recursive: true, mode: 448 });
        await cp2(directory, cache, { recursive: true, errorOnExist: true, force: false });
      }
      if (semanticDigest(await inventory(cache)) !== digest3)
        throw new Fault("PACKAGE_CORRUPT", "Cached immutable package changed.", 5);
    }
    const manifest = await readDocument(directory, "block.yaml", blockSchema), key = manifest.id + "@" + manifest.version;
    if (expected && manifest.origin !== "apexrest-dev/apexrest")
      throw new Fault("ORIGIN_DENIED", "Bundled block origin is outside registry policy.", 5);
    if (!expected && project) {
      const policyFile = await safePath(project, ".apexrest-composer/registry-policy.json");
      const policy2 = await exists(policyFile) ? JSON.parse(await readFile3(policyFile, "utf8")) : { reviewedPackages: {} };
      if (policy2.reviewedPackages?.[key] !== digest3) manifest.status = "draft";
      else if (manifest.status === "draft") manifest.status = "experimental";
    }
    if (packages.has(key))
      throw new Fault("MUTABLE_VERSION_CONFLICT", "Duplicate block ID/version is unsupported.", 5);
    if (revocations.some((r) => r.id === key && r.digest === digest3)) manifest.status = "revoked";
    const descriptor = await readDocument(directory, "renderer.json", rendererSchema);
    if (descriptor.renderer !== manifest.renderer)
      throw new Fault("PACKAGE_INVALID", "Renderer contract differs from manifest.", 5);
    if (Object.keys(files).some((f) => /\.(?:m?js|cjs|sh|exe|dll|node|class|jar)$/i.test(f)))
      throw new Fault("PACKAGE_INVALID", "Executable package hooks are prohibited.", 5);
    for (const file of manifest.source.files) {
      if (!files[file]) throw new Fault("PACKAGE_INVALID", "Declared block source is absent.", 2);
      if (!/\.(?:apx|json)$/.test(file))
        throw new Fault("PACKAGE_INVALID", "Executable hooks are unsupported.", 2);
    }
    const evidenceFile = await safePath(root, "evidence/" + encodeURIComponent(key) + ".json");
    const evidence = await exists(evidenceFile) ? validate(evidenceSchema.array().max(100), JSON.parse(await readFile3(evidenceFile, "utf8"))) : [];
    packages.set(key, {
      manifest,
      digest: digest3,
      directory,
      files,
      evidence: evidence.map((e) => ({
        ...e,
        status: e.sourceDigest === digest3 && e.generatorDigest === generator.runtimeSourceDigest ? e.status : "stale"
      }))
    });
  }
  for (const entry of [...index.packages].sort((a, b) => a.path < b.path ? -1 : 1))
    await add(root, entry.path, entry.digest);
  if (project && await exists(await safePath(project, ".apexrest-composer/blocks"))) {
    const local = await safePath(project, ".apexrest-composer/blocks");
    for (const entry of (await readdir3(local, { withFileTypes: true })).sort(
      (a, b) => a.name < b.name ? -1 : 1
    )) {
      if (!entry.isDirectory())
        throw new Fault("PACKAGE_INVALID", "Local blocks must be contained package directories.", 2);
      await add(local, entry.name);
    }
  }
  return {
    generatorDigest: generator.runtimeSourceDigest,
    packages,
    digest: semanticDigest({
      packages: [...packages].map(([key, p]) => [key, p.digest, p.manifest.status]),
      revocations,
      generator
    })
  };
}
function resolvePackages(catalog, selectors, profile) {
  const result = /* @__PURE__ */ new Map(), visiting = /* @__PURE__ */ new Set();
  function visit(key) {
    if (visiting.has(key)) throw new Fault("DEPENDENCY_CYCLE", "Block dependency cycle.", 5);
    if (result.has(key)) return;
    const pkg = catalog.packages.get(key);
    if (!pkg) throw new Fault("PACKAGE_NOT_AVAILABLE_OFFLINE", `Exact block ${key} is unavailable.`, 3);
    if (pkg.manifest.status === "draft")
      throw new Fault(
        "PACKAGE_REVIEW_REQUIRED",
        "Review and pin local package integrity in registry-policy before planning.",
        5
      );
    if (pkg.manifest.status === "revoked" || !pkg.manifest.compatibility.profileRefs.includes(profile))
      throw new Fault(
        "BLOCK_INCOMPATIBLE",
        `Block ${key} is revoked or incompatible with the selected profile.`,
        5
      );
    visiting.add(key);
    for (const dependency of [...pkg.manifest.requires.blocks].sort()) visit(dependency);
    visiting.delete(key);
    result.set(key, pkg);
  }
  for (const selector of [...selectors].sort()) visit(selector);
  return result;
}
async function catalogSearch(query, options = {}) {
  if (options.corpus === "blueprints") {
    const root = path5.join(resourceRoot(), "blueprints"), entries = JSON.parse(await readFile3(path5.join(root, "index.json"), "utf8"));
    const hits = entries.filter((e) => (e.id + " " + e.title).toLowerCase().includes(query.toLowerCase()));
    return {
      totalMatches: hits.length,
      results: hits.slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 3)),
      nextResultOffset: hits.length > (options.offset ?? 0) + (options.limit ?? 3) ? (options.offset ?? 0) + (options.limit ?? 3) : null
    };
  }
  const catalog = await loadCatalog(options.project, false), terms = query.normalize("NFKC").toLocaleLowerCase("en").split(/\s+/).filter(Boolean);
  if (options.cursor && options.cursor !== catalog.digest)
    throw new Fault("CATALOG_CURSOR_STALE", "Catalog changed; restart discovery.", 5);
  const scored = [...catalog.packages].map(([id, p]) => {
    const body = [id, p.manifest.name, ...p.manifest.aliases].join(" ").normalize("NFKC").toLocaleLowerCase("en");
    return { id, p, score: (id === query ? 1e3 : 0) + terms.filter((t) => body.includes(t)).length };
  }).filter(
    (e) => e.score && (!options.version || e.p.manifest.version === options.version) && (!options.status || e.p.manifest.status === options.status) && (!options.profile || e.p.manifest.compatibility.profileRefs.includes(options.profile))
  ).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  const offset = options.offset ?? 0, limit = options.limit ?? 3;
  return {
    totalMatches: scored.length,
    catalogDigest: catalog.digest,
    cursor: catalog.digest,
    results: scored.slice(offset, offset + limit).map(({ id, p, score }) => ({
      id,
      title: p.manifest.name,
      kind: "template",
      version: p.manifest.version,
      status: p.manifest.status === "verified" ? "experimental" : p.manifest.status,
      declaredStatus: p.manifest.status,
      qualification: "runtime-not-run",
      compatibility: options.profile ? "compatible" : "unknown",
      requiredInputs: p.manifest.ports.inputs,
      effects: p.manifest.effects,
      evidence: p.evidence,
      reasons: ["lexical-match", ...score >= 1e3 ? ["exact-id"] : []],
      sha256: p.digest,
      limitations: p.manifest.limitations
    })),
    nextResultOffset: offset + limit < scored.length ? offset + limit : null
  };
}
async function catalogRead(id, offset = 0, limit = 4096, project) {
  let content;
  if (id.startsWith("blueprint:")) {
    const root = path5.join(resourceRoot(), "blueprints"), index = JSON.parse(await readFile3(path5.join(root, "index.json"), "utf8"));
    const entry = index.find((e) => e.id === id);
    if (!entry) throw new Fault("REFERENCE_NOT_FOUND", "Unknown blueprint.", 2);
    content = await readFile3(await safePath(root, entry.path), "utf8");
  } else {
    const [selector, sourcePath] = id.split("/source/");
    const pkg = (await loadCatalog(project, false)).packages.get(selector);
    if (!pkg) throw new Fault("REFERENCE_NOT_FOUND", "Unknown exact block version.", 2);
    if (sourcePath) {
      if (!pkg.manifest.source.files.includes(sourcePath))
        throw new Fault("REFERENCE_NOT_FOUND", "Source is outside declared package payload.", 2);
      content = await readFile3(await safePath(pkg.directory, sourcePath), "utf8");
    } else
      content = JSON.stringify(
        { manifest: pkg.manifest, digest: pkg.digest, files: pkg.files, evidence: pkg.evidence },
        null,
        2
      );
  }
  return {
    id,
    title: id,
    version: id.split("@")[1] ?? "1",
    source: "bundled-composer-catalog",
    offset,
    length: content.length,
    requires: [],
    related: [],
    relatedCount: 0,
    relatedOmittedCount: 0,
    classification: "untrusted_catalog_content",
    sha256: hash(content),
    content: content.slice(offset, offset + limit),
    nextOffset: offset + limit < content.length ? offset + limit : null,
    dataClassification: "untrusted_catalog_content"
  };
}

// packages/core/src/composer/materializer.ts
var activeJournal = ".apexrest/composer/journal.json";
var journalSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  id: external_exports.uuid(),
  phase: external_exports.enum(["prepared", "writing", "completed"]),
  plan: planSchema,
  previousReceipt: external_exports.string().nullable(),
  records: external_exports.array(
    external_exports.strictObject({
      path: relativePath,
      before: external_exports.string().nullable(),
      after: external_exports.string().nullable(),
      preimage: external_exports.string().nullable(),
      content: external_exports.string().nullable()
    })
  ).max(2050),
  completed: external_exports.array(relativePath)
});
function receiptFor(plan) {
  if (!plan.state || !plan.lock) throw new Fault("PLAN_BLOCKED", "Plan lacks durable state.", 5);
  return {
    schemaVersion: 1,
    generationDigest: plan.state.generationDigest,
    planDigest: plan.digest,
    stateDigest: semanticDigest(plan.state),
    blueprintPath: plan.blueprintPath,
    blueprintDigest: plan.blueprintDigest,
    lockDigest: semanticDigest(plan.lock),
    qualification: plan.validation === "compiler" ? "offline-compiler" : "source-only",
    deployment: "not-run"
  };
}
function requireWriteScope(ctx, write, metadata = false) {
  const sourceDir = ctx.config.application.sourceDir, base = write.path.match(/^\.apexrest-composer\/bases\/([a-f0-9]{64})\.apx$/);
  if (!(write.path.startsWith(sourceDir + "/") || base && (write.after === null || write.after === base[1]) || metadata && [".apexrest-composer/state.json", ".apexrest-composer/lock.json"].includes(write.path)))
    throw new Fault("COMPOSITION_SCOPE_DENIED", "Plan writes outside Composer ownership.", 5);
  if (write.path.split("/").includes(".apex"))
    throw new Fault("COMPOSITION_SCOPE_DENIED", "Oracle metadata cannot be overwritten.", 5);
}
async function requireFrozenPlan(ctx, plan) {
  let frozen;
  try {
    frozen = await readDocument(
      ctx.root,
      `.apexrest/composer/plans/${plan.digest}.json`,
      planSchema,
      planLimits
    );
  } catch {
    throw new Fault("JOURNAL_CORRUPT", "Journal plan has no immutable reviewed plan record.", 5);
  }
  if (canonical2(frozen) !== canonical2(plan))
    throw new Fault("JOURNAL_CORRUPT", "Journal plan differs from its immutable reviewed record.", 5);
}
async function bytes(ctx, relative) {
  const file = await safePath(ctx.root, relative);
  return await exists(file) ? await readFile4(file) : null;
}
async function durable(ctx, relative, content) {
  const file = await safePath(ctx.root, relative);
  await mkdir4(path6.dirname(file), { recursive: true, mode: 448 });
  if (content === null) await rm3(file, { force: true });
  else await atomicWrite(file, content);
  try {
    const handle = await open2(path6.dirname(file), "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (process.platform !== "win32") throw error;
  }
}
async function journal(ctx) {
  const file = await safePath(ctx.root, activeJournal);
  if (!await exists(file)) return null;
  const value = validate(journalSchema, JSON.parse(await readFile4(file, "utf8")));
  if (value.schemaVersion !== 1 || !["prepared", "writing", "completed"].includes(value.phase) || !Array.isArray(value.records) || !Array.isArray(value.completed))
    throw new Fault("JOURNAL_CORRUPT", "Composition journal requires explicit inspection.", 5);
  value.plan = validate(planSchema, value.plan);
  if (planDigest(value.plan) !== value.plan.digest)
    throw new Fault("JOURNAL_CORRUPT", "Journal plan integrity failed.", 5);
  const paths = new Set(value.records.map((record) => record.path));
  if (paths.size !== value.records.length || value.plan.operations.some((operation) => !paths.has(operation.path)) || value.plan.state && value.plan.stateDigest !== semanticDigest(value.plan.state) && !paths.has(".apexrest-composer/state.json"))
    throw new Fault("JOURNAL_CORRUPT", "Journal write set is incomplete or duplicated.", 5);
  if (new Set(value.completed).size !== value.completed.length || value.completed.some((completed) => !paths.has(completed)))
    throw new Fault("JOURNAL_CORRUPT", "Journal checkpoints do not match its write set.", 5);
  for (const record of value.records) {
    requireWriteScope(ctx, record, true);
    await safePath(ctx.root, record.path);
    const operation = value.plan.operations.find((op) => op.path === record.path);
    const metadata = record.path === ".apexrest-composer/state.json" ? value.plan.state : record.path === ".apexrest-composer/lock.json" ? value.plan.lock : null;
    if (operation ? operation.content !== record.content || operation.after !== record.after || operation.before !== record.before : !metadata || record.content !== documentText(metadata))
      throw new Fault("JOURNAL_CORRUPT", "Journal write differs from its immutable plan.", 5);
    if ((record.preimage === null ? null : hash(record.preimage)) !== record.before || (record.content === null ? null : hash(record.content)) !== record.after)
      throw new Fault("JOURNAL_CORRUPT", "Journal image integrity failed.", 5);
  }
  if (!value.plan.state || !value.plan.lock)
    throw new Fault("JOURNAL_CORRUPT", "Journal plan lacks generation metadata.", 5);
  const lockDigest = semanticDigest(value.plan.lock);
  if (value.plan.state.lockDigest !== lockDigest)
    throw new Fault("JOURNAL_CORRUPT", "Journal state does not bind its planned lock.", 5);
  const stateRecord = value.records.find((record) => record.path === ".apexrest-composer/state.json"), lockRecord = value.records.find((record) => record.path === ".apexrest-composer/lock.json"), previousStateText = stateRecord ? stateRecord.preimage : (await bytes(ctx, ".apexrest-composer/state.json"))?.toString("utf8") ?? null;
  let previousState;
  try {
    previousState = previousStateText === null ? null : validate(stateSchema, parseDocumentData(previousStateText));
  } catch {
    throw new Fault("JOURNAL_CORRUPT", "Journal state preimage is invalid.", 5);
  }
  if ((previousState ? semanticDigest(previousState) : null) !== value.plan.stateDigest)
    throw new Fault("JOURNAL_CORRUPT", "Journal state preimage differs from the reviewed plan.", 5);
  if (lockRecord && previousState) {
    let previousLockDigest;
    try {
      previousLockDigest = lockRecord.preimage === null ? null : semanticDigest(validate(lockSchema, parseDocumentData(lockRecord.preimage)));
    } catch {
      throw new Fault("JOURNAL_CORRUPT", "Journal lock preimage is invalid.", 5);
    }
    if (previousLockDigest !== previousState.lockDigest)
      throw new Fault("JOURNAL_CORRUPT", "Journal lock preimage differs from the reviewed state.", 5);
  }
  if (!lockRecord) {
    if (previousState && previousState.lockDigest !== lockDigest || (await bytes(ctx, ".apexrest-composer/lock.json"))?.toString("utf8") !== documentText(value.plan.lock))
      throw new Fault("JOURNAL_CORRUPT", "Journal omits a required lock write.", 5);
  }
  return value;
}
async function checkPreconditions(ctx, plan) {
  const sources = await inventory(await safePath(ctx.root, ctx.config.application.sourceDir));
  const stateFile = await safePath(ctx.root, ".apexrest-composer/state.json");
  const state = await exists(stateFile) ? await readDocument(ctx.root, ".apexrest-composer/state.json", stateSchema) : null;
  if (plan.projectId !== ctx.config.projectId || plan.configurationDigest !== semanticDigest(ctx.config) || plan.toolchainDigest !== hash(await readFile4(await safePath(ctx.root, ctx.config.toolchain.lockFile))) || semanticDigest(sources) !== semanticDigest(plan.sourceInventory) || (state ? semanticDigest(state) : null) !== plan.stateDigest || plan.blueprintDigest !== semanticDigest(await readDocument(ctx.root, plan.blueprintPath, blueprintSchema)) || plan.catalogDigest !== (await loadCatalog(ctx.root)).digest)
    throw new Fault(
      "COMPOSITION_DRIFT",
      "Blueprint, catalog, state, source or configuration changed after review.",
      5
    );
  if (state && plan.kind === "composition" && state.lockDigest !== semanticDigest(await readDocument(ctx.root, ".apexrest-composer/lock.json", lockSchema)))
    throw new Fault("COMPOSITION_DRIFT", "Tracked lock differs from state.", 5);
  for (const op of plan.operations) {
    requireWriteScope(ctx, op);
    const current = await bytes(ctx, op.path);
    if ((current ? hash(current) : null) !== op.before || (op.content === null ? null : hash(op.content)) !== op.after)
      throw new Fault("COMPOSITION_DRIFT", "Planned preimage or postimage changed.", 5);
  }
}
async function stagePlan(ctx, plan) {
  const relative = `.apexrest/composer/staging/${plan.digest}`, base = await safePath(ctx.root, relative);
  await mkdir4(base, { recursive: true, mode: 448 });
  const application = path6.join(base, "application");
  await rm3(application, { recursive: true, force: true });
  await cp3(await safePath(ctx.root, ctx.config.application.sourceDir), application, { recursive: true });
  for (const op of plan.operations.filter(
    (op2) => op2.path.startsWith(ctx.config.application.sourceDir + "/")
  )) {
    const file = await safePath(application, op.path.slice(ctx.config.application.sourceDir.length + 1));
    if (op.content === null) await rm3(file, { force: true });
    else await atomicWrite(file, op.content);
  }
  return { directory: application, sourceDigest: semanticDigest(await inventory(application)) };
}
async function freeze(ctx, plan, out) {
  const text2 = documentText(validate(planSchema, plan));
  const frozen = await safePath(ctx.root, `.apexrest/composer/plans/${plan.digest}.json`);
  if (await exists(frozen)) {
    if (await readFile4(frozen, "utf8") !== text2)
      throw new Fault("PLAN_TAMPERED", "Immutable plan record changed.", 5);
  } else await atomicWrite(frozen, text2);
  const destination = await safePath(ctx.root, out);
  if (!out.endsWith(".json") || out === ctx.config.toolchain.lockFile || out === "apexrest.json" || [
    ".git",
    ".agents",
    ".codex",
    ".apexrest-composer",
    ctx.config.application.sourceDir,
    ...Object.values(ctx.config.database)
  ].some((p) => out === p || out.startsWith(p + "/")) || out.startsWith(".apexrest/composer/") && !out.startsWith(".apexrest/composer/plans/") && out !== ".apexrest/composer/panel-plan.json" || out.startsWith(".apexrest/composer/plans/") && destination !== frozen)
    throw new Fault(
      "COMPOSITION_SCOPE_DENIED",
      "Plan output cannot overwrite application source or tracked state.",
      5
    );
  if (await exists(destination) && destination !== frozen) {
    try {
      await readDocument(ctx.root, out, planSchema, planLimits);
    } catch {
      throw new Fault("COMPOSITION_SCOPE_DENIED", "Existing output is not a Composer plan.", 5);
    }
  }
  await atomicWrite(destination, text2);
}
async function readPlan(ctx, file, expectedDigest) {
  const plan = await readDocument(ctx.root, file, planSchema, planLimits);
  if (plan.digest !== expectedDigest || planDigest(plan) !== plan.digest)
    throw new Fault("PLAN_TAMPERED", "Reviewed plan digest differs.", 5);
  const frozen = await readDocument(
    ctx.root,
    `.apexrest/composer/plans/${plan.digest}.json`,
    planSchema,
    planLimits
  );
  if (semanticDigest(frozen) !== semanticDigest(plan))
    throw new Fault("PLAN_TAMPERED", "Plan differs from its original immutable record.", 5);
  return plan;
}
async function materialize(ctx, plan, options = {}) {
  await requireTrust(ctx.root);
  if (plan.status !== "materializable" || planDigest(plan) !== plan.digest)
    throw new Fault("PLAN_BLOCKED", "Only an intact materializable plan can be applied.", 5);
  await readPlan(ctx, `.apexrest/composer/plans/${plan.digest}.json`, plan.digest);
  return withLock(await safePath(ctx.root, ".apexrest/composer/ownership.lock"), async () => {
    const previous = await journal(ctx);
    if (plan.kind !== "composition") return applyRecovery(ctx, plan, previous, options);
    if (previous && previous.phase !== "completed")
      throw new Fault(
        "RECOVERY_REQUIRED",
        "Inspect the interrupted composition and create an explicit recovery plan.",
        5
      );
    await checkPreconditions(ctx, plan);
    if (!plan.state || !plan.lock)
      throw new Fault("PLAN_BLOCKED", "Materializable plan lacks durable state.", 5);
    const stateText = documentText(plan.state), lockText = documentText(plan.lock);
    const requested = [
      ...plan.operations.map((op) => ({
        path: op.path,
        before: op.before,
        after: op.after,
        content: op.content
      }))
    ];
    for (const [file, content] of [
      [".apexrest-composer/lock.json", lockText],
      [".apexrest-composer/state.json", stateText]
    ]) {
      const current = await bytes(ctx, file);
      if (current?.toString("utf8") !== content)
        requested.push({ path: file, before: current ? hash(current) : null, after: hash(content), content });
    }
    if (!requested.length) {
      const receiptFile = ".apexrest/composer/receipt.json", existing = await bytes(ctx, receiptFile);
      const receipt = receiptFor(plan);
      let current = null;
      try {
        current = existing ? JSON.parse(existing.toString("utf8")) : null;
      } catch {
        current = null;
      }
      if (current === null || canonical2(current) !== canonical2(receipt))
        await durable(ctx, receiptFile, documentText(receipt));
      return {
        status: "no-op",
        generationDigest: plan.state.generationDigest,
        stateDigest: semanticDigest(plan.state),
        changedFiles: [],
        qualification: plan.validation === "compiler" ? "offline-compiler" : "source-only"
      };
    }
    if (previous)
      await durable(
        ctx,
        `.apexrest/composer/journals/${previous.id}.json`,
        JSON.stringify(previous, null, 2) + "\n"
      );
    const record = {
      schemaVersion: 1,
      id: randomUUID2(),
      phase: "prepared",
      plan,
      records: [],
      completed: [],
      previousReceipt: (await bytes(ctx, ".apexrest/composer/receipt.json"))?.toString("utf8") ?? null
    };
    for (const entry of requested) {
      const preimage = await bytes(ctx, entry.path);
      record.records.push({ ...entry, preimage: preimage?.toString("utf8") ?? null });
    }
    await durable(ctx, activeJournal, JSON.stringify(record, null, 2) + "\n");
    try {
      await options.boundary?.("prepared", activeJournal);
      record.phase = "writing";
      await durable(ctx, activeJournal, JSON.stringify(record, null, 2) + "\n");
      await options.boundary?.("writing", activeJournal);
      for (const entry of record.records) {
        if (options.signal?.aborted)
          throw new Fault(
            "RECOVERY_REQUIRED",
            "Composition interrupted; inspect journal before retry.",
            6,
            "cancelled"
          );
        const current = await bytes(ctx, entry.path);
        if ((current ? hash(current) : null) !== entry.before)
          throw new Fault("RECOVERY_REQUIRED", "Concurrent edits interrupted composition.", 5);
        await options.boundary?.("before-write", entry.path);
        const recheck = await bytes(ctx, entry.path);
        if ((recheck ? hash(recheck) : null) !== entry.before)
          throw new Fault("RECOVERY_REQUIRED", "Concurrent edit before the write.", 5);
        await durable(ctx, entry.path, entry.content);
        await options.boundary?.("after-write", entry.path);
        const after = await bytes(ctx, entry.path);
        if ((after ? hash(after) : null) !== entry.after)
          throw new Fault("RECOVERY_REQUIRED", "Postimage differs after local write.", 5);
        record.completed.push(entry.path);
        await durable(ctx, activeJournal, JSON.stringify(record, null, 2) + "\n");
        await options.boundary?.("checkpoint", entry.path);
      }
      const expectedSources = { ...plan.sourceInventory };
      for (const op of plan.operations)
        if (op.path.startsWith(ctx.config.application.sourceDir + "/")) {
          const file = op.path.slice(ctx.config.application.sourceDir.length + 1);
          if (op.after === null) delete expectedSources[file];
          else expectedSources[file] = op.after;
        }
      const checkPostimages = async () => {
        for (const entry of record.records) {
          const after = await bytes(ctx, entry.path);
          if ((after ? hash(after) : null) !== entry.after)
            throw new Fault("RECOVERY_REQUIRED", "Concurrent changes detected before completion.", 5);
        }
        if (semanticDigest(await inventory(await safePath(ctx.root, ctx.config.application.sourceDir))) !== semanticDigest(expectedSources))
          throw new Fault("RECOVERY_REQUIRED", "Application changed during materialization.", 5);
      };
      await checkPostimages();
      const receipt = receiptFor(plan), receiptText = JSON.stringify(receipt, null, 2) + "\n";
      await options.boundary?.("before-receipt", ".apexrest/composer/receipt.json");
      await durable(ctx, ".apexrest/composer/receipt.json", receiptText);
      await options.boundary?.("after-receipt", ".apexrest/composer/receipt.json");
      await options.boundary?.("before-complete", activeJournal);
      await checkPostimages();
      if ((await bytes(ctx, ".apexrest/composer/receipt.json"))?.toString("utf8") !== receiptText)
        throw new Fault("RECOVERY_REQUIRED", "Composition receipt changed before completion.", 5);
      record.phase = "completed";
      await durable(ctx, activeJournal, JSON.stringify(record, null, 2) + "\n");
      return { status: "materialized", ...receipt, changedFiles: record.records.map((e) => e.path) };
    } catch (error) {
      if (error instanceof Fault && error.code === "RECOVERY_REQUIRED") throw error;
      throw new Fault(
        "RECOVERY_REQUIRED",
        "Local writes may be partial. Preserve the journal and request explicit recovery.",
        5
      );
    }
  });
}
async function recoveryPlan(ctx, action) {
  const record = await journal(ctx);
  if (!record || record.phase === "completed")
    throw new Fault("RECOVERY_NOT_REQUIRED", "No interrupted composition requires recovery.", 5);
  await requireFrozenPlan(ctx, record.plan);
  for (const entry of record.records) {
    const current = await bytes(ctx, entry.path), digest3 = current ? hash(current) : null;
    if (digest3 !== entry.before && digest3 !== entry.after)
      throw new Fault("RECOVERY_CONFLICT", "Recovery cannot overwrite an unrecognized concurrent edit.", 5);
  }
  const stateFile = await safePath(ctx.root, ".apexrest-composer/state.json");
  const state = await exists(stateFile) ? await readDocument(ctx.root, ".apexrest-composer/state.json", stateSchema) : null;
  const plan = {
    ...record.plan,
    kind: action === "resume" ? "recovery-resume" : "recovery-restore",
    sourceInventory: await inventory(await safePath(ctx.root, ctx.config.application.sourceDir)),
    stateDigest: state ? semanticDigest(state) : null,
    blueprintDigest: semanticDigest(await readDocument(ctx.root, record.plan.blueprintPath, blueprintSchema)),
    recovery: {
      journalId: record.id,
      sourcePlanDigest: record.plan.digest,
      recordsDigest: semanticDigest(record.records)
    },
    operations: await Promise.all(
      record.records.map(async (e) => {
        const current = await bytes(ctx, e.path), content = action === "restore" ? e.preimage : e.content;
        return {
          path: e.path,
          before: current ? hash(current) : null,
          after: content === null ? null : hash(content),
          content,
          reason: "recovery-" + action
        };
      })
    ),
    diagnostics: [
      {
        code: "EXPLICIT_LOCAL_RECOVERY",
        severity: "info",
        message: `Reviewed ${action} of a partial filesystem composition. No database recovery is performed.`
      }
    ]
  };
  plan.digest = planDigest(plan);
  return validate(planSchema, plan);
}
async function applyRecovery(ctx, plan, record, options) {
  if (!record || record.phase === "completed")
    throw new Fault("RECOVERY_NOT_REQUIRED", "No interrupted journal.", 5);
  if (plan.recovery?.journalId !== record.id || plan.recovery.sourcePlanDigest !== record.plan.digest || plan.recovery.recordsDigest !== semanticDigest(record.records))
    throw new Fault("RECOVERY_CONFLICT", "Recovery plan binds another journal.", 5);
  await requireFrozenPlan(ctx, record.plan);
  for (const entry of record.records) requireWriteScope(ctx, entry, true);
  for (const operation of plan.operations) requireWriteScope(ctx, operation, true);
  if (canonical2(plan.operations.map((operation) => operation.path)) !== canonical2(record.records.map((entry) => entry.path)))
    throw new Fault("RECOVERY_CONFLICT", "Recovery plan write set differs from its journal.", 5);
  await checkPreconditions(ctx, { ...plan, operations: [] });
  const restore = plan.kind === "recovery-restore";
  for (const entry of [...record.records].sort(
    (a, b) => restore ? record.records.indexOf(b) - record.records.indexOf(a) : record.records.indexOf(a) - record.records.indexOf(b)
  )) {
    if (options.signal?.aborted)
      throw new Fault("RECOVERY_REQUIRED", "Recovery interrupted; preserve journal.", 6, "cancelled");
    const current = await bytes(ctx, entry.path), actual = current ? hash(current) : null;
    if (actual !== entry.before && actual !== entry.after)
      throw new Fault("RECOVERY_CONFLICT", "Unknown local edit blocks recovery.", 5);
    const content = restore ? entry.preimage : entry.content, expected = restore ? entry.before : entry.after;
    await options.boundary?.("before-recovery-write", entry.path);
    const recheck = await bytes(ctx, entry.path);
    if ((recheck ? hash(recheck) : null) !== actual)
      throw new Fault("RECOVERY_CONFLICT", "Concurrent edit before recovery write.", 5);
    await durable(ctx, entry.path, content);
    await options.boundary?.("after-recovery-write", entry.path);
    const after = await bytes(ctx, entry.path);
    if ((after ? hash(after) : null) !== expected)
      throw new Fault("RECOVERY_CONFLICT", "Recovery postimage differs.", 5);
  }
  for (const entry of record.records) {
    const current = await bytes(ctx, entry.path);
    if ((current ? hash(current) : null) !== (restore ? entry.before : entry.after))
      throw new Fault("RECOVERY_CONFLICT", "Concurrent edit before recovery completion.", 5);
  }
  if (restore) await durable(ctx, ".apexrest/composer/receipt.json", record.previousReceipt);
  if (!restore && plan.state && plan.lock)
    await durable(ctx, ".apexrest/composer/receipt.json", documentText(receiptFor(record.plan)));
  record.phase = "completed";
  await durable(ctx, activeJournal, JSON.stringify(record, null, 2) + "\n");
  return {
    status: restore ? "restored" : "materialized",
    databaseEffects: [],
    changedFiles: record.records.map((e) => e.path)
  };
}
async function deploymentBinding(ctx) {
  const pending = await journal(ctx);
  if (pending && pending.phase !== "completed")
    throw new Fault("RECOVERY_REQUIRED", "Interrupted composition must be recovered before deployment.", 5);
  const file = await safePath(ctx.root, ".apexrest/composer/receipt.json");
  const stateFile = await safePath(ctx.root, ".apexrest-composer/state.json");
  if (!await exists(file)) {
    if (await exists(stateFile))
      throw new Fault(
        "COMPOSITION_RECEIPT_MISSING",
        "Tracked Composer state requires its local materialization receipt.",
        5
      );
    return null;
  }
  const receipt = JSON.parse(await readFile4(file, "utf8"));
  if (receipt.qualification !== "offline-compiler")
    throw new Fault(
      "COMPOSITION_UNQUALIFIED",
      "Source-only Composer drafts cannot bind into deployment plans; replan with compiler validation.",
      5
    );
  const state = await readDocument(ctx.root, ".apexrest-composer/state.json", stateSchema);
  const blueprintDigest = semanticDigest(
    await readDocument(ctx.root, receipt.blueprintPath, blueprintSchema)
  );
  const lock = await readDocument(ctx.root, ".apexrest-composer/lock.json", lockSchema), lockDigest = semanticDigest(lock);
  if (lock.catalogDigest !== (await loadCatalog(ctx.root)).digest || state.lockDigest !== lockDigest)
    throw new Fault("COMPOSITION_DRIFT", "Catalog or tracked lock changed.", 5);
  if (receipt.stateDigest !== semanticDigest(state) || receipt.generationDigest !== state.generationDigest || receipt.blueprintDigest !== blueprintDigest || receipt.lockDigest !== lockDigest)
    throw new Fault("COMPOSITION_DRIFT", "Composition receipt, blueprint, state or lock changed.", 5);
  for (const owner of Object.values(state.owners))
    if (owner.mode !== "detached")
      for (const [file2, digest3] of Object.entries(owner.files)) {
        const source = await bytes(ctx, ctx.config.application.sourceDir + "/" + file2);
        if (!source || hash(source) !== digest3)
          throw new Fault(
            "COMPOSITION_DRIFT",
            "Managed source changed after materialization; replan before deployment.",
            5
          );
      }
  return {
    generationDigest: receipt.generationDigest,
    blueprintDigest,
    stateDigest: receipt.stateDigest,
    lockDigest,
    catalogDigest: (await loadCatalog(ctx.root)).digest,
    blueprintPath: receipt.blueprintPath
  };
}

// packages/core/src/deploy.ts
var digestSchema = external_exports.string().regex(/^[a-f0-9]{64}$/);
var filesSchema = external_exports.record(external_exports.string(), digestSchema);
var legacyPlanSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  id: external_exports.uuid(),
  projectId: refName,
  projectRoot: external_exports.string(),
  environment: refName,
  createdAt: external_exports.iso.datetime(),
  expiresAt: external_exports.iso.datetime(),
  sourceDigest: digestSchema,
  sources: filesSchema,
  configurationDigest: digestSchema,
  toolchainDigest: digestSchema,
  compiler: external_exports.string(),
  targetDigest: digestSchema,
  target: external_exports.record(external_exports.string(), external_exports.unknown()),
  fingerprint: digestSchema,
  migrationHistory: external_exports.array(external_exports.record(external_exports.string(), external_exports.unknown())),
  // Always the local durable store; the shape is kept so existing plan digests stay stable.
  coordination: external_exports.strictObject({
    backend: external_exports.literal("local"),
    scope: external_exports.literal("managed-home-schema"),
    storeDigest: digestSchema
  }),
  scope: external_exports.literal("full-application-import"),
  operations: external_exports.array(
    external_exports.strictObject({
      kind: external_exports.enum(["migration", "package", "import", "verify", "test"]),
      file: external_exports.string().optional(),
      sha256: digestSchema.optional()
    })
  ),
  risks: external_exports.array(external_exports.string()),
  approval: external_exports.literal("external-policy-required"),
  backupRequired: external_exports.boolean(),
  digest: digestSchema,
  restore: external_exports.strictObject({ backupId: external_exports.uuid(), checksum: digestSchema, alias: refName.optional() }).optional()
});
var PLAN_LIFETIME_MS = 30 * 6e4;
var syncBindingSchema = external_exports.strictObject({
  syncId: external_exports.uuid(),
  revision: external_exports.number().int().nonnegative(),
  baselineDigest: digestSchema,
  checkpointDigest: digestSchema,
  backupId: external_exports.uuid(),
  backupChecksum: digestSchema
});
var planV2Object = legacyPlanSchema.extend({
  schemaVersion: external_exports.literal(2),
  mode: external_exports.enum(["full-export", "working-copy"]),
  backupStrategy: external_exports.enum(["fresh-export", "initial-backup"]),
  workingCopy: syncBindingSchema.nullable()
});
var planV2Schema = planV2Object.superRefine((plan, ctx) => {
  if (plan.mode === "working-copy" !== (plan.backupStrategy === "initial-backup") || plan.mode === "working-copy" !== (plan.workingCopy !== null))
    ctx.addIssue({ code: "custom", message: "Plan mode, backup strategy and sync binding must agree." });
});
var composerBindingSchema = external_exports.strictObject({
  generationDigest: digestSchema,
  blueprintDigest: digestSchema,
  stateDigest: digestSchema,
  lockDigest: digestSchema,
  catalogDigest: digestSchema,
  blueprintPath: external_exports.string().min(1)
});
var planV3Schema = planV2Object.extend({ schemaVersion: external_exports.literal(3), composer: composerBindingSchema }).superRefine((plan, ctx) => {
  if (plan.mode === "working-copy" !== (plan.backupStrategy === "initial-backup") || plan.mode === "working-copy" !== (plan.workingCopy !== null))
    ctx.addIssue({ code: "custom", message: "Plan mode, backup strategy and sync binding must agree." });
});
var deployPlanSchema = external_exports.union([legacyPlanSchema, planV2Schema, planV3Schema]);
var next = {
  planned: ["approved"],
  approved: ["backing_up"],
  backing_up: ["migrating"],
  migrating: ["importing"],
  importing: ["verifying"],
  verifying: ["testing"],
  testing: ["succeeded"],
  succeeded: [],
  failed: [],
  outcome_unknown: []
};
function assertTransition(from, to) {
  if (!next[from].includes(to) && !["failed", "outcome_unknown"].includes(to))
    throw new Fault("INVALID_DEPLOY_STATE", `Invalid transition ${from} to ${to}.`, 5);
}
function planDigest2(value) {
  const { digest: _digest, ...unsigned } = value;
  return hash(canonical(unsigned));
}
var clientCommands = [
  ["host", 2],
  ["start", 3],
  ["spool", 3],
  ["save", 3],
  ["store", 3],
  ["get", 3],
  ["edit", 2],
  ["connect", 4],
  ["disconnect", 4],
  ["password", 5],
  ["exit", 4],
  ["quit", 4],
  ["script", 6],
  ["javascript", 10],
  ["cd", 2],
  ["copy", 4],
  ["alias", 5],
  ["repeat", 6],
  ["load", 4],
  ["unload", 6],
  ["liquibase", 9],
  ["lb", 2],
  ["sshtunnel", 9],
  ["connmgr", 7],
  ["apex", 4],
  ["oci", 3],
  ["datapump", 8],
  ["dp", 2],
  ["cloudstorage", 12],
  ["cs", 2],
  ["soda", 4],
  ["mcp", 3]
];
var plsqlBlockStart = /^(?:begin|declare)\b|^create\s+(?:or\s+replace\s+)?(?:(?:editionable|noneditionable)\s+)?(?:and\s+(?:resolve|compile)\s+)?(?:noforce\s+)?(?:java|function|procedure|package|trigger|type|library)\b/i;
function sqlclControlLines(sql) {
  const found = [];
  let block = false;
  sql.split(/\r\n|\r|\n/).forEach((raw, index) => {
    let line = raw;
    for (; ; ) {
      line = line.replace(/^\s+/, "");
      if (!line.startsWith("/*")) break;
      const end = line.indexOf("*/", 2);
      line = end < 0 ? "" : line.slice(end + 2);
    }
    if (!line || line.startsWith("--")) return;
    if (/^[/.]\s*$/.test(line)) {
      block = false;
      return;
    }
    if (/^[!$@]/.test(line)) {
      found.push(index + 1);
      return;
    }
    const word = /^[A-Za-z][A-Za-z0-9_$#]*/.exec(line)?.[0].toLowerCase();
    if (!word) return;
    const rest = line.slice(word.length).trimStart();
    if (word.length >= 3 && "remark".startsWith(word)) return;
    if (plsqlBlockStart.test(line)) block = true;
    if ("start".startsWith(word) && word.length >= 3 && /^with\b/i.test(rest)) return;
    if ("connect".startsWith(word) && word.length >= 4 && /^by\b/i.test(rest)) return;
    if (block && word === "exit") return;
    if (word === "whenever" && /\bcontinue\b/i.test(rest) || word === "set" && /^(?:logsource|editfile)\b/i.test(rest) || clientCommands.some(([name2, min]) => word.length >= min && name2.startsWith(word)))
      found.push(index + 1);
  });
  return found;
}
function migrationRisk(sql) {
  const risks = [];
  if (/\b(?:drop|truncate|delete|revoke|grant)\b|\balter\s+(?:table|user|system|database)\b/i.test(sql))
    risks.push("destructive-or-privileged-sql");
  if (sqlclControlLines(sql).length) risks.push("sqlcl-script-control");
  return risks;
}
var securityHeader = /^(?:(?:authentication|authorization)(?:[-_ ]?scheme)?\s*[:=]|(?:authentication|authorization)\s*(?:\{|[\w.-]+\s*\())/i;
function securityAttributes(text2) {
  const out = [];
  let depth = 0;
  for (const raw of text2.split(/\r?\n/)) {
    const line = raw.trim();
    if (depth > 0) {
      out.push(line);
      depth += (line.match(/[{(]/g)?.length ?? 0) - (line.match(/[})]/g)?.length ?? 0);
      continue;
    }
    if (!securityHeader.test(line)) continue;
    out.push(line);
    depth = Math.max(0, (line.match(/[{(]/g)?.length ?? 0) - (line.match(/[})]/g)?.length ?? 0));
  }
  return out;
}
async function securityChanged(local, server) {
  const read = async (root, files, file) => files[file] === void 0 ? [] : securityAttributes(await readFile5(await contained(root, file), "utf8"));
  for (const file of /* @__PURE__ */ new Set([...Object.keys(server.files), ...Object.keys(local.files)])) {
    if (local.files[file] === server.files[file]) continue;
    if (/authenticat|authoriz/i.test(file)) return true;
    if (canonical(await read(local.root, local.files, file)) !== canonical(await read(server.root, server.files, file)))
      return true;
  }
  return false;
}
var attestationSchema = external_exports.strictObject({
  planDigest: digestSchema,
  planId: external_exports.uuid(),
  projectId: refName,
  targetDigest: digestSchema,
  expiresAt: external_exports.iso.datetime(),
  reviewer: external_exports.string().min(1),
  signature: external_exports.string().min(1)
});
function publicKeyFingerprint(publicKey) {
  return hash(createPublicKey(publicKey).export({ type: "spki", format: "der" }));
}
function verifyProductionApproval(trust, publicKey, value, plan, projectId) {
  const fingerprint = publicKeyFingerprint(publicKey);
  const key = trust.approvalKeys.find((k) => k.sha256 === fingerprint);
  if (!key)
    throw new Fault(
      "APPROVAL_KEY_UNTRUSTED",
      "The approval public key is not listed in the protected production trust file.",
      4,
      "blocked"
    );
  const attestation = parse(attestationSchema, value);
  const { signature, ...payload } = attestation;
  if (payload.planDigest !== plan.digest || payload.planId !== plan.id || payload.projectId !== plan.projectId || payload.projectId !== projectId || payload.targetDigest !== plan.targetDigest || key.reviewer !== void 0 && key.reviewer !== payload.reviewer || Date.parse(payload.expiresAt) <= Date.now() || !verify(
    null,
    Buffer.from(canonical(payload)),
    createPublicKey(publicKey),
    Buffer.from(signature, "base64")
  ))
    throw new Fault(
      "APPROVAL_INVALID",
      "External approval is invalid, expired or for another project/plan/target.",
      4
    );
  return payload;
}
async function authorizePlan(ctx, plan, env) {
  await requireTrust(ctx.root);
  if (plan.risks.some((r) => r !== "application-restore"))
    throw new Fault(
      "RECOVERY_REVIEW_REQUIRED",
      "Destructive, authentication or unsupported changes need an explicit recovery implementation and reviewed external workflow.",
      4,
      "blocked"
    );
  if (await isProductionTarget(env, plan.targetDigest)) {
    if (process.env.CI !== "true" || !process.env.APEXREST_APPROVAL_PUBLIC_KEY_FILE || !process.env.APEXREST_APPROVAL_FILE)
      throw new Fault(
        "PRODUCTION_CI_REQUIRED",
        "Production requires a protected CI runner and externally signed approval bound to this plan.",
        4,
        "blocked"
      );
    const trust = await protectedProductionTrust();
    verifyProductionApproval(
      trust,
      await readFile5(process.env.APEXREST_APPROVAL_PUBLIC_KEY_FILE),
      await readJson(process.env.APEXREST_APPROVAL_FILE),
      plan,
      ctx.config.projectId
    );
    return;
  }
  const grants = (await policy()).grants;
  if (!grants.some(
    (g) => g.projectRoot === ctx.root && g.targetDigest === plan.targetDigest && g.operations.includes("deploy") && g.planDigest === plan.digest && Date.parse(g.expiresAt) > Date.now() && Date.parse(g.expiresAt) <= Date.parse(plan.expiresAt)
  ))
    throw new Fault(
      "DEPLOY_APPROVAL_REQUIRED",
      "A user-owned deploy grant for this project and target is required. It must carry planDigest equal to this plan digest and expire no later than the plan.",
      4,
      "blocked"
    );
}
var migrationName = /^(\d{4,})__[A-Za-z0-9_-]+\.sql$/;
var migrationVersion = (file) => BigInt(migrationName.exec(path7.basename(file))?.[1] ?? "-1");
function operationOrder(a, b) {
  const kind = (a.kind === "migration" ? 0 : 1) - (b.kind === "migration" ? 0 : 1);
  if (kind) return kind;
  if (a.kind === "migration" && b.kind === "migration") {
    const left = migrationVersion(a.file ?? ""), right = migrationVersion(b.file ?? "");
    if (left !== right) return left < right ? -1 : 1;
  }
  return (a.file ?? "").localeCompare(b.file ?? "");
}
function checkMigrations(ctx, sources, history) {
  const prefix = ctx.config.database.migrationsDir + "/";
  const versions = /* @__PURE__ */ new Map();
  const applied = new Set(history.map((row) => String(row.version)));
  let highest = -1n;
  for (const row of history) {
    const match = migrationName.exec(String(row.version));
    if (match && BigInt(match[1]) > highest) highest = BigInt(match[1]);
  }
  for (const file of Object.keys(sources)) {
    if (!file.startsWith(prefix)) continue;
    const name2 = file.slice(prefix.length);
    if (name2.includes("/"))
      throw new Fault(
        "INVALID_MIGRATION_LAYOUT",
        `Migration ${file} is in a subdirectory. Keep migrations directly in ${ctx.config.database.migrationsDir}.`,
        2
      );
    const match = migrationName.exec(name2);
    if (!match)
      throw new Fault(
        "INVALID_MIGRATION_NAME",
        "Use ordered immutable migration names such as 0001__customers.sql.",
        2
      );
    const version2 = BigInt(match[1]);
    const duplicate = versions.get(version2);
    if (duplicate)
      throw new Fault(
        "DUPLICATE_MIGRATION_VERSION",
        `Migrations ${duplicate} and ${name2} share version ${match[1]}. Use one file per version.`,
        2
      );
    versions.set(version2, name2);
    if (!applied.has(name2) && version2 < highest)
      throw new Fault(
        "MIGRATION_OUT_OF_ORDER",
        `New migration ${name2} is older than the highest applied version. Give it a higher version.`,
        5
      );
  }
}
function applicationFiles(ctx, sources) {
  const prefix = ctx.config.application.sourceDir + "/";
  return Object.fromEntries(
    Object.entries(sources).filter(([file]) => file.startsWith(prefix)).map(([file, sha]) => [file.slice(prefix.length), sha])
  );
}
async function sourceInventory(ctx) {
  const files = {};
  for (const relative of [
    ctx.config.application.sourceDir,
    ctx.config.database.migrationsDir,
    ctx.config.database.packagesDir,
    ctx.config.database.testsDir,
    ctx.config.tests.unitDir,
    ctx.config.tests.apiDir,
    ctx.config.tests.e2eDir
  ]) {
    const dir = await contained(ctx.root, relative);
    if (await exists(dir))
      for (const [file, sha] of Object.entries(await inventory(dir))) files[relative + "/" + file] = sha;
  }
  for (const relative of [
    "package.json",
    "package-lock.json",
    "playwright.config.ts",
    "playwright.config.mjs"
  ])
    if (await exists(path7.join(ctx.root, relative)))
      files[relative] = hash(await readFile5(await contained(ctx.root, relative)));
  return Object.fromEntries(Object.entries(files).sort());
}
var DeploymentService = class {
  constructor(oracle = new OracleAdapter(), runTests) {
    this.oracle = oracle;
    this.runTests = runTests;
  }
  oracle;
  runTests;
  async history(env, _connection) {
    return new LocalDeploymentControl(env).history();
  }
  async fingerprint(env, connection) {
    const target = await this.oracle.verifyTarget(env, connection);
    const history = await this.history(env, connection);
    const exported = target.application ? await this.oracle.exportApplication(env, connection, "APEXLANG") : null;
    return {
      target,
      history,
      exported,
      fingerprint: hash(canonical({ target, history, exportDigest: exported?.digest ?? null }))
    };
  }
  async workingFingerprint(ctx, name2, state) {
    const env = environment(ctx, name2), connection = await resolveConnection(env.readConnectionRef);
    const target = await this.oracle.verifyTarget(env, connection);
    const metadata = await this.oracle.applicationMetadata(env, connection);
    if (!target.application || canonical(target) !== canonical(state.target) || canonical(metadata) !== canonical(state.observedMetadata))
      throw new Fault(
        "SYNC_SERVER_CHANGED",
        "Target or update metadata changed. Explicit refresh is required after external edits.",
        5
      );
    const history = await this.history(env, connection);
    return {
      target,
      history,
      exported: checkpoint(state),
      fingerprint: hash(canonical({ target, history, metadata }))
    };
  }
  async sync(ctx, name2, action, signal) {
    const env = environment(ctx, name2), store = new SyncStore(ctx, env, name2);
    if (action === "status") return store.status();
    await requireTrust(ctx.root);
    return store.lock(async () => {
      const previous = await store.read(action === "refresh" || action === "invalidate");
      if (previous && ["importing", "outcome_unknown"].includes(previous.status))
        throw new Fault(
          "SYNC_BLOCKED",
          "An interrupted import needs reconciliation; sync cannot clear its ownership.",
          5
        );
      if (action === "invalidate") {
        if (previous)
          await store.write({ ...previous, status: "invalidated", revision: previous.revision + 1 });
        return store.status();
      }
      if (action === "init" && previous && previous.status !== "invalidated") {
        await store.validate(previous);
        return store.status();
      }
      if (await isProductionTarget(env))
        throw new Fault(
          "SYNC_SCOPE_UNSUPPORTED",
          "Working copies support existing development/test applications only.",
          5
        );
      if (ctx.config.application.sourceDir.startsWith(".apexrest") || ctx.config.application.sourceDir === ".")
        throw new Fault(
          "SYNC_PATH_UNSAFE",
          "Working sources must be separate from private control storage.",
          5
        );
      if (action === "refresh" && previous) {
        await checkSnapshot(ctx, checkpoint(previous));
        const source = await syncPath(ctx, previous.sourceDir);
        if (!await exists(source) || canonical(await inventory(source)) !== canonical(checkpoint(previous).files))
          throw new Fault(
            "SYNC_DIRTY",
            "Save and reconcile local edits before refresh. No export was performed.",
            5
          );
      }
      const readConnection = await resolveConnection(env.readConnectionRef), deployConnection = await resolveConnection(env.deployConnectionRef), runId = randomUUID3();
      await this.lease(env, runId, true);
      try {
        if (signal?.aborted) throw new Fault("CANCELLED", "Sync cancelled before export.", 6, "cancelled");
        const target = await this.oracle.verifyTarget(env, readConnection);
        if (!target.application)
          throw new Fault("SYNC_SCOPE_UNSUPPORTED", "Sync requires an existing application.", 5);
        const metadata = await this.oracle.applicationMetadata(env, readConnection);
        const exported = await this.oracle.exportApplication(env, readConnection, "APEXLANG");
        const sql = await this.oracle.exportApplication(env, readConnection, "SQL");
        if (sql.compiler.version !== exported.compiler.version)
          throw new Fault(
            "SYNC_COMPILER_CHANGED",
            "Compiler changed during initial sync. Explicitly refresh with one toolchain.",
            5
          );
        const syncId = randomUUID3(), backupId = randomUUID3();
        const baselineDir = ".apexrest/sync/" + targetDigest(env) + "/baselines/" + syncId + "/application";
        const baselineRoot = await syncPath(ctx, baselineDir), backupRoot = await syncPath(ctx, ".apexrest/backups/" + backupId);
        await mkdir5(path7.dirname(baselineRoot), { recursive: true, mode: 448 });
        await privateCopy(exported.directory, baselineRoot);
        const baseline = { directory: baselineDir, files: exported.files, digest: exported.digest };
        await checkSnapshot(ctx, baseline);
        await mkdir5(backupRoot, { recursive: true, mode: 448 });
        await privateCopy(sql.directory, path7.join(backupRoot, "application"));
        await writeJson(path7.join(backupRoot, "backup.json"), {
          schemaVersion: 1,
          backupId,
          targetDigest: targetDigest(env),
          environment: name2,
          digest: sql.digest,
          files: sql.files,
          restoreProcedure: "Reviewed initial SQL export import; application metadata only. Schema/data recovery is separate."
        });
        await checkSyncBackup(ctx, { backupId, checksum: sql.digest }, targetDigest(env), name2);
        const observedTarget = await this.oracle.verifyTarget(env, readConnection);
        const observedMetadata = await this.oracle.applicationMetadata(env, readConnection);
        if (canonical(target) !== canonical(observedTarget) || canonical(metadata) !== canonical(observedMetadata))
          throw new Fault(
            "SYNC_SERVER_CHANGED",
            "Application changed during sync. Staged artifacts were retained.",
            5
          );
        await this.lease(env, runId, false);
        if (signal?.aborted)
          throw new Fault("CANCELLED", "Sync cancelled before installing sources.", 6, "cancelled");
        const state = {
          schemaVersion: 1,
          syncId,
          revision: (previous?.revision ?? -1) + 1,
          projectRoot: ctx.root,
          projectId: ctx.config.projectId,
          environment: name2,
          targetDigest: targetDigest(env),
          target,
          sourceDir: ctx.config.application.sourceDir,
          toolchainDigest: hash(await readFile5(await contained(ctx.root, ctx.config.toolchain.lockFile))),
          runtimeVersion: VERSION,
          compilerVersion: exported.compiler.version,
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          baseline,
          backup: { backupId, checksum: sql.digest },
          observedMetadata: metadata,
          lastSuccessfulImport: null,
          status: "ready",
          importingRunId: null
        };
        const source = await syncPath(ctx, ctx.config.application.sourceDir);
        const refreshKnown = action === "refresh" && previous?.sourceDir === ctx.config.application.sourceDir;
        if (await exists(source)) {
          const expected = refreshKnown ? checkpoint(previous).files : exported.files;
          if (canonical(await inventory(source)) !== canonical(expected))
            throw new Fault(
              "SYNC_SOURCE_CONFLICT",
              "Local sources differ from the expected inventory. Staged artifacts were retained; local files were preserved.",
              5
            );
          if (refreshKnown) {
            const retained = await syncPath(
              ctx,
              ".apexrest/sync/" + targetDigest(env) + "/baselines/" + syncId + "/previous-working-copy"
            );
            const replacement = await syncPath(
              ctx,
              ".apexrest/sync/" + targetDigest(env) + "/baselines/" + syncId + "/new-working-copy"
            );
            await privateCopy(baselineRoot, replacement);
            await store.write({ ...state, status: "importing", importingRunId: runId });
            await rename(source, retained);
            try {
              await rename(replacement, source);
            } catch (error) {
              await rename(retained, source);
              throw error;
            }
          }
        } else {
          await mkdir5(path7.dirname(source), { recursive: true });
          const replacement = await syncPath(
            ctx,
            ".apexrest/sync/" + targetDigest(env) + "/baselines/" + syncId + "/new-working-copy"
          );
          await privateCopy(baselineRoot, replacement);
          await store.write({ ...state, status: "importing", importingRunId: runId });
          await rename(replacement, source);
        }
        if (previous && previous.targetDigest !== state.targetDigest)
          await store.write({ ...previous, status: "invalidated", revision: previous.revision + 1 });
        await store.write(state);
        await this.oracle.discardStage?.(exported.stage);
        await this.oracle.discardStage?.(sql.stage);
        return store.status();
      } finally {
        await this.releaseLease(env, runId);
      }
    });
  }
  async releaseLease(env, runId) {
    await new LocalDeploymentControl(env).release(runId);
  }
  async plan(ctx, name2, restore = false) {
    await requireTrust(ctx.root);
    const env = environment(ctx, name2), connection = await resolveConnection(env.readConnectionRef);
    const syncStore = new SyncStore(ctx, env, name2), stored = await syncStore.read();
    const working = !restore && stored?.status !== "invalidated" ? stored : null;
    if (working) await syncStore.validate(working);
    if (restore && stored && ["importing", "outcome_unknown"].includes(stored.status))
      throw new Fault("SYNC_BLOCKED", "Reconcile interrupted writes before restore planning.", 5);
    const [targetCheck, sourceCheck] = await Promise.allSettled([
      working ? this.workingFingerprint(ctx, name2, working) : this.fingerprint(env, connection),
      (async () => {
        const sources2 = await sourceInventory(ctx);
        const validation2 = await this.oracle.validate(
          await contained(ctx.root, ctx.config.application.sourceDir)
        );
        const lock2 = await contained(ctx.root, ctx.config.toolchain.lockFile);
        if (!await exists(lock2))
          throw new Fault("TOOLCHAIN_LOCK_REQUIRED", "The project needs its pinned toolchain lock.", 3);
        return { sources: sources2, validation: validation2, lock: lock2 };
      })()
    ]);
    if (targetCheck.status === "rejected") throw targetCheck.reason;
    if (sourceCheck.status === "rejected") throw sourceCheck.reason;
    const current = targetCheck.value, { sources, validation, lock } = sourceCheck.value, risks = [];
    if (working && validation.compiler.version !== working.compilerVersion)
      throw new Fault(
        "SYNC_COMPILER_CHANGED",
        "SQLcl compiler version changed. Explicit working-copy refresh is required.",
        5
      );
    const operations = [];
    const history = new Map(current.history.map((row) => [String(row.version), row]));
    if (current.history.some((row) => row.status !== "succeeded"))
      throw new Fault(
        "MIGRATION_HISTORY_CONFLICT",
        "An earlier migration has an unresolved outcome. Reconcile it before any new deployment.",
        5
      );
    checkMigrations(ctx, sources, current.history);
    for (const [file, sha256] of Object.entries(sources)) {
      const migration = file.startsWith(ctx.config.database.migrationsDir + "/");
      const pkg = file.startsWith(ctx.config.database.packagesDir + "/");
      if (!migration && !pkg) continue;
      if (!file.endsWith(".sql"))
        throw new Fault("UNSUPPORTED_DB_SOURCE", "Database execution directories accept .sql files only.", 3);
      const sql = await readFile5(await contained(ctx.root, file), "utf8");
      risks.push(...migrationRisk(sql).map((r) => `${r}:${file}`));
      if (migration) {
        const version2 = path7.basename(file);
        if (!/^\d{4,}__[A-Za-z0-9_-]+\.sql$/.test(version2))
          throw new Fault(
            "INVALID_MIGRATION_NAME",
            "Use ordered immutable migration names such as 0001__customers.sql.",
            2
          );
        const previous = history.get(version2);
        if (previous && (previous.checksum !== sha256 || previous.status !== "succeeded"))
          throw new Fault(
            "MIGRATION_HISTORY_CONFLICT",
            "An existing migration changed checksum or has an unresolved outcome.",
            5
          );
        if (!previous) operations.push({ kind: "migration", file, sha256 });
      } else operations.push({ kind: "package", file, sha256 });
    }
    if (working && operations.some((o) => ["migration", "package"].includes(o.kind)))
      throw new Fault(
        "SYNC_DB_OPERATIONS_INCOMPATIBLE",
        "Invalidate working-copy mode explicitly before database operations.",
        5
      );
    if (current.exported) {
      try {
        if (await securityChanged(
          {
            root: await contained(ctx.root, ctx.config.application.sourceDir),
            files: applicationFiles(ctx, sources)
          },
          { root: path7.resolve(ctx.root, current.exported.directory), files: current.exported.files }
        ))
          risks.push("authentication-or-authorization-change");
      } finally {
        if (!working) await this.oracle.discardStage?.(current.exported.stage);
      }
    }
    operations.sort(operationOrder);
    operations.push({ kind: "import" }, { kind: "verify" }, { kind: "test" });
    const createdAt = Date.now();
    const plan = {
      schemaVersion: 2,
      mode: working ? "working-copy" : "full-export",
      backupStrategy: working ? "initial-backup" : "fresh-export",
      workingCopy: working ? this.syncBinding(working) : null,
      id: randomUUID3(),
      projectId: ctx.config.projectId,
      projectRoot: ctx.root,
      environment: name2,
      createdAt: new Date(createdAt).toISOString(),
      expiresAt: new Date(createdAt + PLAN_LIFETIME_MS).toISOString(),
      sourceDigest: hash(canonical(sources)),
      sources,
      configurationDigest: hash(canonical(ctx.config)),
      toolchainDigest: hash(await readFile5(lock)),
      compiler: validation.compiler.version,
      targetDigest: targetDigest(env),
      target: current.target,
      fingerprint: current.fingerprint,
      migrationHistory: current.history,
      coordination: coordination(env),
      scope: "full-application-import",
      operations,
      risks: [...new Set(risks)],
      approval: "external-policy-required",
      backupRequired: !!current.target.application,
      digest: "0".repeat(64)
    };
    const composer = await deploymentBinding(ctx);
    const bound = composer ? { ...plan, schemaVersion: 3, composer } : plan;
    bound.digest = planDigest2(bound);
    return bound;
  }
  syncBinding(state) {
    return {
      syncId: state.syncId,
      revision: state.revision,
      baselineDigest: state.baseline.digest,
      checkpointDigest: checkpoint(state).digest,
      backupId: state.backup.backupId,
      backupChecksum: state.backup.checksum
    };
  }
  async checkWorkingPlan(ctx, plan, permitImporting = false) {
    const store = new SyncStore(ctx, environment(ctx, plan.environment), plan.environment), state = await store.read();
    if (plan.restore && state && ["importing", "outcome_unknown"].includes(state.status))
      throw new Fault("SYNC_BLOCKED", "Reconcile interrupted imports before restoring.", 5);
    if (state && state.status !== "invalidated" && !plan.restore) {
      if (plan.schemaVersion === 1 || plan.mode !== "working-copy" || canonical(plan.workingCopy) !== canonical(this.syncBinding(state)) || plan.compiler !== state.compilerVersion)
        throw new Fault(
          "SYNC_REPLAN_REQUIRED",
          "Plan does not bind the current working-copy revision. Re-plan.",
          5
        );
      const reviewed = checkpoint(state);
      if (!plan.risks.includes("authentication-or-authorization-change") && await securityChanged(
        {
          root: await contained(ctx.root, ctx.config.application.sourceDir),
          files: applicationFiles(ctx, plan.sources)
        },
        { root: await syncPath(ctx, reviewed.directory), files: reviewed.files }
      ))
        throw new Fault("PLAN_TAMPERED", "Plan omits an authentication or authorization change.", 5);
      await store.validate(state, !(permitImporting && state.status === "importing"));
      if (plan.operations.some((o) => ["migration", "package"].includes(o.kind)))
        throw new Fault(
          "SYNC_DB_OPERATIONS_INCOMPATIBLE",
          "Working-copy plans cannot execute database operations.",
          5
        );
      return state;
    }
    if (plan.schemaVersion !== 1 && plan.mode === "working-copy")
      throw new Fault("SYNC_REPLAN_REQUIRED", "The reviewed working copy is no longer active.", 5);
    return null;
  }
  async checkLocal(ctx, value, permitImporting = false) {
    const plan = parse(deployPlanSchema, value), env = environment(ctx, plan.environment);
    const composer = await deploymentBinding(ctx);
    if (canonical(composer) !== canonical(plan.schemaVersion === 3 ? plan.composer : null))
      throw new Fault(
        "COMPOSITION_REPLAN_REQUIRED",
        "Deployment plan must bind the current materialized Composer generation.",
        5
      );
    if (plan.sourceDigest !== hash(canonical(plan.sources)) || plan.digest !== planDigest2(plan))
      throw new Fault("PLAN_TAMPERED", "Plan digest verification failed.", 5);
    if (plan.projectId !== ctx.config.projectId || plan.projectRoot !== ctx.root || plan.targetDigest !== targetDigest(env))
      throw new Fault("PLAN_TARGET_MISMATCH", "Plan project or target differs from the current request.", 5);
    if (Date.parse(plan.expiresAt) <= Date.now())
      throw new Fault("PLAN_EXPIRED", "Create and review a new plan.", 5);
    const lifetime = Date.parse(plan.expiresAt) - Date.parse(plan.createdAt);
    if (!(lifetime > 0 && lifetime <= PLAN_LIFETIME_MS) || Date.parse(plan.createdAt) > Date.now() + 6e4)
      throw new Fault("PLAN_TAMPERED", "Plan lifetime exceeds the reviewed plan limit.", 5);
    if (plan.sourceDigest !== hash(canonical(await sourceInventory(ctx))) || plan.configurationDigest !== hash(canonical(ctx.config)) || plan.toolchainDigest !== hash(await readFile5(await contained(ctx.root, ctx.config.toolchain.lockFile))))
      throw new Fault("SOURCE_DRIFT", "Sources, configuration or toolchain lock changed after review.", 5);
    if (plan.backupRequired !== Boolean(plan.target.application))
      throw new Fault("PLAN_TAMPERED", "Backup requirement does not match reviewed target.", 5);
    if (canonical(plan.coordination) !== canonical(coordination(env)))
      throw new Fault(
        "CONTROL_STORE_CHANGED",
        "Deployment control mode or local history store changed. Re-plan using the original durable state.",
        5
      );
    const expected = [];
    if (!plan.restore) {
      checkMigrations(ctx, plan.sources, plan.migrationHistory);
      const history = new Map(plan.migrationHistory.map((row) => [String(row.version), row]));
      for (const [file, sha256] of Object.entries(plan.sources)) {
        const kind = file.startsWith(ctx.config.database.migrationsDir + "/") ? "migration" : file.startsWith(ctx.config.database.packagesDir + "/") ? "package" : void 0;
        if (!kind) continue;
        if (!file.endsWith(".sql"))
          throw new Fault("UNSUPPORTED_DB_SOURCE", "Database sources must be SQL files.", 5);
        const previous = history.get(path7.basename(file));
        if (kind === "migration" && previous && (previous.checksum !== sha256 || previous.status !== "succeeded"))
          throw new Fault("MIGRATION_HISTORY_CONFLICT", "Migration requires reconciliation.", 5);
        if (kind !== "migration" || !previous) expected.push({ kind, file, sha256 });
        const risks = migrationRisk(await readFile5(await contained(ctx.root, file), "utf8")).map(
          (r) => `${r}:${file}`
        );
        if (risks.some((r) => !plan.risks.includes(r)))
          throw new Fault("PLAN_TAMPERED", "Plan omits a SQL risk.", 5);
      }
      expected.sort(operationOrder);
    }
    expected.push({ kind: "import" }, { kind: "verify" }, { kind: "test" });
    if (canonical(expected) !== canonical(plan.operations))
      throw new Fault(
        "PLAN_TAMPERED",
        "Plan operations do not match reviewed sources and migration history.",
        5
      );
    await this.checkWorkingPlan(ctx, plan, permitImporting);
    return { plan, env };
  }
  /** Acquire or re-confirm local schema ownership. No Oracle objects are touched. */
  async lease(env, runId, acquire) {
    const control = new LocalDeploymentControl(env);
    if (acquire) await control.acquire(runId);
    else await control.assertOwner(runId);
  }
  async apply(ctx, value, signal, progress) {
    await this.checkLocal(ctx, value);
    return withLock(
      await contained(ctx.root, ".apexrest/composer/ownership.lock"),
      () => this.applyLocked(ctx, value, signal, progress)
    );
  }
  async applyLocked(ctx, value, signal, progress) {
    if (signal?.aborted)
      throw new Fault("CANCELLED", "Deployment cancelled before execution.", 6, "cancelled");
    const { plan, env } = await this.checkLocal(ctx, value);
    await authorizePlan(ctx, plan, env);
    await this.oracle.requireMutationSupport();
    const readConnection = await resolveConnection(env.readConnectionRef), deployConnection = await resolveConnection(env.deployConnectionRef);
    let working = await this.checkWorkingPlan(ctx, plan);
    const syncStore = new SyncStore(ctx, env, plan.environment);
    const [deployTargetCheck, fingerprintCheck, capabilityCheck] = await Promise.allSettled([
      this.oracle.verifyTarget(env, deployConnection),
      working ? this.workingFingerprint(ctx, plan.environment, working) : this.fingerprint(env, readConnection),
      this.oracle.requireCapability("import")
    ]);
    const liveStage = !working && fingerprintCheck.status === "fulfilled" ? fingerprintCheck.value.exported?.stage : void 0;
    try {
      if (deployTargetCheck.status === "rejected") throw deployTargetCheck.reason;
      if (fingerprintCheck.status === "rejected") throw fingerprintCheck.reason;
      const live = fingerprintCheck.value;
      if (live.fingerprint !== plan.fingerprint)
        throw new Fault("TARGET_DRIFT", "Target or migration history changed after review.", 5);
      if (canonical(live.target) !== canonical(plan.target) || canonical(live.history) !== canonical(plan.migrationHistory))
        throw new Fault("PLAN_TAMPERED", "Plan target or migration history differs from the live target.", 5);
      if (!working && !plan.restore && live.exported && !plan.risks.includes("authentication-or-authorization-change") && await securityChanged(
        {
          root: await contained(ctx.root, ctx.config.application.sourceDir),
          files: applicationFiles(ctx, plan.sources)
        },
        { root: live.exported.directory, files: live.exported.files }
      ))
        throw new Fault("PLAN_TAMPERED", "Plan omits an authentication or authorization change.", 5);
    } finally {
      await this.oracle.discardStage?.(liveStage);
    }
    const liveApplication = fingerprintCheck.value.target.application ?? deployTargetCheck.value.application;
    if (capabilityCheck.status === "rejected") throw capabilityCheck.reason;
    const capability = capabilityCheck.value;
    if (capability.version !== plan.compiler)
      throw new Fault("COMPILER_DRIFT", "SQLcl version changed after plan.", 5);
    if (signal?.aborted)
      throw new Fault("CANCELLED", "Deployment cancelled before lease acquisition.", 6, "cancelled");
    const runId = randomUUID3(), runs = path7.join(ctx.root, ".apexrest/deployments"), runDir = path7.join(runs, runId);
    await mkdir5(runDir, { recursive: true, mode: 448 });
    let state = "planned", writeStarted = false, importConfirmed = false, syncMarked = false, syncSucceeded = false;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const record = async (nextState, details = {}) => {
      assertTransition(state, nextState);
      state = nextState;
      try {
        progress?.(nextState);
      } catch {
      }
      const event = {
        runId,
        planId: plan.id,
        planDigest: plan.digest,
        targetDigest: plan.targetDigest,
        state,
        at: (/* @__PURE__ */ new Date()).toISOString(),
        details
      };
      const journal2 = await open3(path7.join(runDir, "journal.jsonl"), "a", 384);
      try {
        await journal2.writeFile(JSON.stringify(event) + "\n");
        await journal2.sync();
      } finally {
        await journal2.close();
      }
      await writeJson(path7.join(runDir, "state.json"), event);
    };
    await writeJson(path7.join(runDir, "plan.json"), plan);
    await record("approved");
    await this.lease(env, runId, true);
    try {
      await record("backing_up");
      working = await this.checkWorkingPlan(ctx, plan);
      if (working) await checkSyncBackup(ctx, working.backup, plan.targetDigest, plan.environment);
      if ((plan.backupRequired || liveApplication) && !working) {
        const backup = await this.oracle.exportApplication(env, readConnection, "SQL");
        try {
          const backupId = randomUUID3(), directory = path7.join(ctx.root, ".apexrest/backups", backupId);
          await mkdir5(directory, { recursive: true, mode: 448 });
          await privateCopy(backup.directory, path7.join(directory, "application"));
          const files = await inventory(path7.join(directory, "application"));
          if (!Object.keys(files).length || hash(canonical(files)) !== backup.digest)
            throw new Fault("BACKUP_INVALID", "Backup copy failed checksum verification.", 1);
          await writeJson(path7.join(directory, "backup.json"), {
            schemaVersion: 1,
            backupId,
            targetDigest: plan.targetDigest,
            environment: plan.environment,
            digest: backup.digest,
            files,
            ...typeof liveApplication?.alias === "string" ? { alias: liveApplication.alias } : {},
            restoreProcedure: "Reviewed SQL export import; application metadata only. Schema/data recovery is separate."
          });
        } finally {
          await this.oracle.discardStage?.(backup.stage);
        }
      }
      await this.checkLocal(ctx, plan);
      const after = working ? await this.workingFingerprint(ctx, plan.environment, working) : await this.fingerprint(env, readConnection);
      if (!working) await this.oracle.discardStage?.(after.exported?.stage);
      if (after.fingerprint !== plan.fingerprint)
        throw new Fault("TARGET_DRIFT", "Target changed during backup.", 5);
      const snapshot = path7.join(runDir, "snapshot");
      await mkdir5(snapshot, { mode: 448 });
      for (const [file, sha] of Object.entries(plan.sources)) {
        const source = await contained(ctx.root, file), destination = await contained(snapshot, file);
        await mkdir5(path7.dirname(destination), { recursive: true });
        await cp4(source, destination);
        if (hash(await readFile5(destination)) !== sha)
          throw new Fault("SOURCE_DRIFT", "Source changed while freezing deployment.", 5);
      }
      if (controller.signal.aborted)
        throw new Fault("CANCELLED", "Deployment cancelled before writes.", 6, "cancelled");
      if (working) {
        await syncStore.lock(async () => {
          await this.checkWorkingPlan(ctx, plan);
          await syncStore.write({ ...working, status: "importing", importingRunId: runId });
          syncMarked = true;
        });
      }
      await record("migrating");
      await new LocalDeploymentControl(env).markWriting(runId);
      for (const operation of plan.operations.filter((o) => ["migration", "package"].includes(o.kind))) {
        if (controller.signal.aborted)
          throw new Fault(
            "LEASE_OR_CANCELLATION",
            "Execution was interrupted.",
            6,
            writeStarted ? "outcome_unknown" : "cancelled"
          );
        await this.lease(env, runId, false);
        const file = await contained(snapshot, operation.file);
        if (operation.kind === "migration")
          await new LocalDeploymentControl(env).migration(
            runId,
            path7.basename(file),
            operation.sha256,
            "started"
          );
        writeStarted = true;
        await this.oracle.session(
          `@${sqlclToken(file)}
prompt APEXREST_SCRIPT_COMPLETE`,
          deployConnection,
          true,
          controller.signal,
          void 0,
          "text",
          SCRIPT_RESTRICT_LEVEL
        );
        if (operation.kind === "migration")
          await new LocalDeploymentControl(env).migration(
            runId,
            path7.basename(file),
            operation.sha256,
            "succeeded"
          );
      }
      await record("importing");
      await this.lease(env, runId, false);
      await this.oracle.verifyTarget(env, deployConnection);
      if (plan.restore) {
        const backupRoot = await contained(
          ctx.root,
          ".apexrest/backups/" + plan.restore.backupId + "/application"
        );
        if (hash(canonical(await inventory(backupRoot))) !== plan.restore.checksum)
          throw new Fault("BACKUP_INVALID", "Restore source changed after approval.", 5);
        const frozen = path7.join(runDir, "restore");
        await privateCopy(backupRoot, frozen);
        const files = await inventory(frozen);
        if (hash(canonical(files)) !== plan.restore.checksum)
          throw new Fault("BACKUP_INVALID", "Restore copy changed.", 5);
        const main = Object.keys(files).filter((f) => /^f\d+\.sql$/i.test(f));
        if (main.length !== 1)
          throw new Fault(
            "RESTORE_LAYOUT_UNSUPPORTED",
            "Restore requires one complete non-split Oracle SQL export.",
            3
          );
        const restoredSync = await syncStore.read();
        if (restoredSync && restoredSync.status !== "invalidated")
          await syncStore.lock(
            () => syncStore.write({ ...restoredSync, status: "invalidated", revision: restoredSync.revision + 1 })
          );
        writeStarted = true;
        await this.oracle.restoreApplication(
          env,
          deployConnection,
          path7.join(frozen, main[0]),
          controller.signal
        );
      } else {
        writeStarted = true;
        await this.oracle.importApplication(
          ctx,
          env,
          deployConnection,
          path7.join(snapshot, ctx.config.application.sourceDir),
          controller.signal
        );
      }
      importConfirmed = true;
      let target;
      try {
        await record("verifying");
        target = await this.oracle.verifyTarget(env, readConnection);
        const expectedAlias = plan.restore ? plan.restore.alias ?? plan.target.application?.alias ?? ctx.config.application.alias : ctx.config.application.alias;
        if (!target.application || String(target.application.alias).toLowerCase() !== String(expectedAlias).toLowerCase())
          throw new Fault("POST_DEPLOY_IDENTITY_FAILED", "Expected imported app was not found.", 1);
        await record("testing");
        if (ctx.config.tests.requiredSuites.length) {
          if (!this.runTests)
            throw new Fault("TEST_RUNNER_REQUIRED", "Required post-deploy tests are unavailable.", 3);
          await this.checkLocal(ctx, plan, true);
          const tests = await this.runTests(ctx, plan.environment);
          if (!tests.ok)
            throw new Fault("POST_DEPLOY_TEST_FAILED", "Required post-deploy suites did not pass.", 1);
        }
      } catch (error) {
        if (error instanceof Fault) throw error;
        throw new Fault(
          "POST_DEPLOY_VERIFICATION_FAILED",
          `Import was confirmed but verification failed: ${error instanceof Error ? error.message : "unexpected error"}`,
          1
        );
      }
      if (working) {
        const metadata = await this.oracle.applicationMetadata(env, readConnection);
        const directory = ".apexrest/deployments/" + runId + "/snapshot/" + ctx.config.application.sourceDir;
        const files = await inventory(await syncPath(ctx, directory));
        const snapshot2 = { directory, files, digest: hash(canonical(files)) };
        await syncStore.lock(async () => {
          const state2 = await syncStore.read();
          if (!state2 || state2.importingRunId !== runId || state2.revision !== working.revision)
            throw new Error("Sync ownership changed after import.");
          await syncStore.write({
            ...state2,
            status: "ready",
            revision: state2.revision + 1,
            importingRunId: null,
            observedMetadata: metadata,
            target,
            lastSuccessfulImport: { at: (/* @__PURE__ */ new Date()).toISOString(), runId, snapshot: snapshot2 }
          });
        });
        syncSucceeded = true;
      }
      await record("succeeded");
      return { runId, state, directory: runDir };
    } catch (error) {
      const unknown = writeStarted && (!importConfirmed || !(error instanceof Fault) || error.exitCode === 6);
      if (working && syncMarked) {
        try {
          await syncStore.lock(async () => {
            const owned = await syncStore.read();
            if (!owned || owned.importingRunId !== runId && owned.lastSuccessfulImport?.runId !== runId)
              throw new Error("Sync ownership changed during failure recording.");
            const status = unknown ? "outcome_unknown" : writeStarted ? "verification_failed" : "ready";
            await syncStore.write(
              syncSucceeded || owned.lastSuccessfulImport?.runId === runId ? { ...owned, status, importingRunId: status === "ready" ? null : runId } : { ...working, importingRunId: writeStarted ? runId : null, status }
            );
          });
        } catch {
          state = "outcome_unknown";
          throw new Fault(
            "OUTCOME_UNKNOWN",
            `Deployment ${runId} needs reconciliation; durable sync state could not be saved.`,
            6,
            "outcome_unknown"
          );
        }
      }
      await record(unknown ? "outcome_unknown" : "failed", {
        code: error instanceof Fault ? error.code : "UNEXPECTED_FAILURE"
      });
      if (unknown)
        throw new Fault(
          "OUTCOME_UNKNOWN",
          `Deployment ${runId} requires reconciliation before retry.`,
          6,
          "outcome_unknown"
        );
      throw error;
    } finally {
      signal?.removeEventListener("abort", abort);
      if (state !== "outcome_unknown")
        await new LocalDeploymentControl(env).release(runId).catch(() => {
        });
    }
  }
  async reconcile(ctx, runId) {
    parse(external_exports.uuid(), runId);
    const directory = await contained(ctx.root, ".apexrest/deployments/" + runId);
    const plan = parse(deployPlanSchema, await readJson(path7.join(directory, "plan.json"))), env = environment(ctx, plan.environment);
    const current = await this.fingerprint(env, await resolveConnection(env.readConnectionRef));
    await this.oracle.discardStage?.(current.exported?.stage);
    const state = await readJson(path7.join(directory, "state.json"));
    return {
      runId,
      state,
      currentTarget: current.target,
      currentFingerprint: current.fingerprint,
      comparisonProvenance: "explicit-live-export",
      targetUnchanged: plan.schemaVersion !== 1 && plan.mode === "working-copy" ? canonical(current.target) === canonical(plan.target) && canonical(current.history) === canonical(plan.migrationHistory) && current.exported?.digest === plan.workingCopy.checkpointDigest : current.fingerprint === plan.fingerprint,
      importedSourcesMatch: current.exported ? canonical(current.exported.files) === canonical(
        Object.fromEntries(
          Object.entries(plan.sources).filter(([file]) => file.startsWith(ctx.config.application.sourceDir + "/")).map(([file, sha]) => [file.slice(ctx.config.application.sourceDir.length + 1), sha])
        )
      ) : false,
      history: current.history,
      retryAllowed: false,
      nextActions: [
        "Review target export and migration history. Reconciliation does not assume process termination rolled back Oracle."
      ]
    };
  }
  async restorePlan(ctx, backupId) {
    parse(external_exports.uuid(), backupId);
    const directory = await contained(ctx.root, ".apexrest/backups/" + backupId);
    const backup = await readJson(path7.join(directory, "backup.json"));
    const files = await inventory(path7.join(directory, "application"));
    if (hash(canonical(files)) !== backup.digest)
      throw new Fault("BACKUP_INVALID", "Backup digest does not match.", 5);
    const plan = await this.plan(ctx, backup.environment, true);
    if (plan.targetDigest !== backup.targetDigest)
      throw new Fault("BACKUP_TARGET_MISMATCH", "Backup belongs to another target.", 5);
    const alias = typeof backup.alias === "string" ? backup.alias : plan.target.application?.alias;
    plan.restore = {
      backupId,
      checksum: backup.digest,
      ...typeof alias === "string" && refName.safeParse(alias).success ? { alias } : {}
    };
    plan.risks = ["application-restore"];
    plan.operations = [{ kind: "import" }, { kind: "verify" }, { kind: "test" }];
    plan.digest = planDigest2(plan);
    return plan;
  }
};

// packages/core/src/testing.ts
function qualityGate(results, required) {
  return results.every((r) => !["failed", "cancelled"].includes(r.status)) && required.every(
    (s) => results.some(
      (r) => r.suite === s && r.status === "passed" && r.tests > r.skipped && r.failures === 0 && r.skipped === 0
    )
  );
}
function parseJUnit(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Fault("UNSAFE_REPORT", "DTD/entities are not allowed in test reports.", 1);
  const cases = [...xml.matchAll(/<testcase\b[^>]*?\/>|<testcase\b[^>]*>[\s\S]*?<\/testcase>/g)].map(
    (m) => m[0]
  );
  return {
    tests: cases.length,
    failures: cases.filter((c) => /<(?:failure|error)\b/.test(c)).length,
    skipped: cases.filter((c) => /<skipped\b/.test(c)).length
  };
}
function allowedOrigin(url, origins) {
  const u = new URL(url);
  if (!["https:", "http:"].includes(u.protocol) || u.username || u.password || u.hostname.endsWith(".invalid") || u.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) || !origins.includes(u.origin))
    throw new Fault("ORIGIN_DENIED", "The target origin is outside the configured allowlist.", 4);
  return u;
}
var TestService = class {
  constructor(oracle = new OracleAdapter()) {
    this.oracle = oracle;
  }
  oracle;
  async authorize(ctx, name2) {
    await requireTrust(ctx.root);
    const env = environment(ctx, name2);
    if (await isProductionTarget(env) || !ctx.config.tests.mutationAllowedEnvironments.includes(name2))
      throw new Fault(
        "TEST_MUTATION_DENIED",
        "Remote tests require a non-production environment explicitly allowed for mutations.",
        4,
        "blocked"
      );
    if (!(await policy()).grants.some(
      (g) => g.projectRoot === ctx.root && g.targetDigest === targetDigest(env) && g.operations.includes("test") && Date.parse(g.expiresAt) > Date.now()
    ))
      throw new Fault(
        "TEST_APPROVAL_REQUIRED",
        "User-owned policy must authorize tests for this exact target.",
        4,
        "blocked"
      );
    allowedOrigin(env.baseUrl, [new URL(env.baseUrl).origin, ...env.allowedOrigins]);
    return env;
  }
  async run(ctx, suite, envName, signal, headed = false) {
    try {
      await requireTrust(ctx.root);
      const dir = await contained(
        ctx.root,
        suite === "sql" ? ctx.config.database.testsDir : ctx.config.tests[`${suite}Dir`]
      );
      if (!await exists(dir)) return { suite, status: "not_configured", tests: 0, failures: 0, skipped: 0 };
      const files = Object.keys(await inventory(dir));
      if (!files.length) return { suite, status: "empty", tests: 0, failures: 0, skipped: 0 };
      const artifacts = new ArtifactService(ctx);
      if (suite === "unit") {
        const tests = files.filter((f) => /\.(?:test|spec)\.(?:mjs|js|ts)$/.test(f));
        if (!tests.length) return { suite, status: "empty", tests: 0, failures: 0, skipped: 0 };
        const result2 = await runProcess({
          executable: process.execPath,
          args: [
            "--experimental-strip-types",
            "--test",
            "--test-reporter=junit",
            ...tests.map((f) => path8.join(dir, f))
          ],
          cwd: ctx.root,
          ...signal ? { signal } : {},
          timeoutMs: 18e4
        });
        const counts2 = parseJUnit(result2.stdout);
        const artifactId2 = await artifacts.save(result2.stdout + result2.stderr, "unit-report");
        return {
          suite,
          status: result2.timedOut || result2.cancelled ? "cancelled" : !counts2.tests ? "empty" : result2.code === 0 && !counts2.failures ? "passed" : "failed",
          ...counts2,
          artifactId: artifactId2
        };
      }
      if (!envName) throw new Fault("ENVIRONMENT_REQUIRED", "Remote test suites require --env.", 2);
      const env = await this.authorize(ctx, envName);
      if (suite === "sql") {
        const scripts = files.filter((f) => f.endsWith(".sql")).sort();
        for (const file of scripts) {
          const lines = sqlclControlLines(await readFile6(await contained(dir, file), "utf8"));
          if (lines.length)
            throw new Fault(
              "SQL_TEST_SCRIPT_CONTROL",
              `SQL test ${file} uses SQLcl client commands (line ${lines.join(", ")}). Tests may contain SQL and PL/SQL only.`,
              4,
              "blocked"
            );
        }
        await this.oracle.requireMutationSupport();
        const connection = await resolveConnection(env.deployConnectionRef);
        await this.oracle.verifyTarget(env, connection);
        const framework = await this.oracle.jsonQuery(
          "select owner,object_name from all_objects where object_name='UT' and object_type='PACKAGE'",
          connection
        );
        if (!framework.length)
          return {
            suite,
            status: "dependency_missing",
            tests: 0,
            failures: 0,
            skipped: 0,
            diagnostic: "utPLSQL is absent. Review a separate framework installation plan."
          };
        for (const file of scripts)
          await this.oracle.session(
            `@${sqlclToken(await contained(dir, file))}`,
            connection,
            true,
            signal,
            void 0,
            "text",
            SCRIPT_RESTRICT_LEVEL
          );
        const result2 = await this.oracle.session(
          `set serveroutput on size unlimited
begin
 ut.run(${sqlLiteral(env.parsingSchema)}, ut_junit_reporter());
end;
/`,
          connection,
          true,
          signal
        );
        const counts2 = parseJUnit(result2.output), artifactId2 = await artifacts.save(result2.output, "utplsql-junit");
        return {
          suite,
          status: !counts2.tests ? "empty" : counts2.failures ? "failed" : "passed",
          ...counts2,
          artifactId: artifactId2
        };
      }
      const state = await runtimeState();
      if (!state.playwright || !state.node)
        return {
          suite,
          status: "dependency_missing",
          tests: 0,
          failures: 0,
          skipped: 0,
          diagnostic: "Run apexrest setup to install pinned Playwright and Chromium."
        };
      const runId = randomUUID4(), runnerRoot = path8.resolve(state.playwright, "../../../.."), run = path8.join(runnerRoot, "runs", runId);
      await mkdir6(run, { recursive: true, mode: 448 });
      await cp5(dir, path8.join(run, "tests"), { recursive: true });
      await cp5(path8.join(resourceRoot(), "testkit"), path8.join(run, "testkit"), { recursive: true });
      const auth = path8.join(ctx.root, ".apexrest/auth", envName, "state.json"), authMeta = auth + ".meta.json";
      if (suite === "e2e" && (!await exists(auth) || !await exists(authMeta) || Date.parse((await readJson(authMeta)).expiresAt) < Date.now()))
        return {
          suite,
          status: "blocked",
          tests: 0,
          failures: 0,
          skipped: 0,
          diagnostic: "Authenticated browser state is missing or expired. Run test auth interactively."
        };
      await atomicWrite(
        path8.join(run, "playwright.config.mjs"),
        `export default ${JSON.stringify({ testDir: "./tests", forbidOnly: true, retries: 0, timeout: 3e4, workers: 1, reporter: [["json", { outputFile: path8.join(run, "report.json") }]], use: { baseURL: env.baseUrl, browserName: "chromium", serviceWorkers: "block", trace: "off", screenshot: "off", video: "off", ...suite === "e2e" ? { storageState: auth } : {} } })};
`
      );
      const result = await runProcess({
        executable: state.node,
        args: [
          state.playwright,
          "test",
          "--config",
          path8.join(run, "playwright.config.mjs"),
          ...headed ? ["--headed"] : []
        ],
        cwd: run,
        env: {
          ...process.env,
          PLAYWRIGHT_BROWSERS_PATH: path8.join(managedHome(), "browsers"),
          APEXREST_ALLOWED_ORIGINS: JSON.stringify([new URL(env.baseUrl).origin, ...env.allowedOrigins]),
          APEXREST_EXPECTED_MARKER: env.expectedMarker ?? ""
        },
        timeoutMs: 3e5,
        ...signal ? { signal } : {}
      });
      const reportFile = path8.join(run, "report.json");
      if (!await exists(reportFile))
        return {
          suite,
          status: result.timedOut || result.cancelled ? "cancelled" : "failed",
          tests: 0,
          failures: 1,
          skipped: 0,
          diagnostic: redact(result.stderr).slice(0, 2e3)
        };
      const report = await readJson(reportFile);
      const stats = report.stats, counts = {
        tests: stats.expected + stats.unexpected + stats.flaky + stats.skipped,
        failures: stats.unexpected + stats.flaky + (report.errors?.length ?? 0),
        skipped: stats.skipped
      };
      const artifactId = await artifacts.save(await readFile6(reportFile, "utf8"), "playwright-report");
      return {
        suite,
        status: result.timedOut || result.cancelled ? "cancelled" : !counts.tests ? "empty" : result.code === 0 && !counts.failures ? "passed" : "failed",
        ...counts,
        artifactId
      };
    } catch (e) {
      return {
        suite,
        status: e instanceof Fault && e.exitCode === 3 ? "dependency_missing" : e instanceof Fault && e.exitCode === 6 ? "cancelled" : "blocked",
        tests: 0,
        failures: 0,
        skipped: 0,
        diagnostic: redact(e instanceof Error ? e.message : "Test runner failed.")
      };
    }
  }
  async all(ctx, name2, signal) {
    const results = [];
    for (const suite of ["unit", "sql", "api", "e2e"])
      results.push(await this.run(ctx, suite, name2, signal));
    const runId = randomUUID4(), ok = qualityGate(results, ctx.config.tests.requiredSuites);
    const report = {
      runId,
      ok,
      environment: name2,
      results,
      required: ctx.config.tests.requiredSuites,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await writeJson(path8.join(ctx.root, ".apexrest/test-runs", runId + ".json"), report);
    return { ok, data: report };
  }
  async auth(ctx, name2) {
    const env = await this.authorize(ctx, name2), state = await runtimeState();
    if (!state.playwright || !state.node)
      throw new Fault("SETUP_REQUIRED", "Install Playwright through setup first.", 3);
    if (!process.stdin.isTTY)
      throw new Fault(
        "INTERACTIVE_LOGIN_REQUIRED",
        "Run test auth in a local interactive terminal. Do not send passwords to Codex.",
        4
      );
    const destination = path8.join(ctx.root, ".apexrest/auth", name2, "state.json");
    await mkdir6(path8.dirname(destination), { recursive: true, mode: 448 });
    const helper = path8.join(path8.resolve(state.playwright, "../../../.."), "auth.mjs");
    await cp5(path8.join(resourceRoot(), "playwright/auth.mjs"), helper);
    const code = await new Promise((resolve, reject) => {
      const child = spawn(
        state.node,
        [
          helper,
          destination,
          env.baseUrl,
          JSON.stringify([new URL(env.baseUrl).origin, ...env.allowedOrigins])
        ],
        {
          cwd: ctx.root,
          env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path8.join(managedHome(), "browsers") },
          stdio: ["inherit", "ignore", "inherit"]
        }
      );
      child.once("error", reject);
      child.once("exit", resolve);
    });
    if (code !== 0 || !await exists(destination))
      throw new Fault("AUTH_NOT_SAVED", "Login did not save browser state.", 4);
    await chmod2(destination, 384);
    await writeJson(destination + ".meta.json", {
      expiresAt: new Date(Date.now() + 8 * 36e5).toISOString(),
      origin: new URL(env.baseUrl).origin
    });
    return { state: "stored", expiresInHours: 8, authentication: "verified-by-required-E2E-marker" };
  }
};

// packages/core/src/browser-preferences.ts
var browserPreferencesSchema = external_exports.strictObject({
  browserMode: external_exports.enum(["codex", "external"]).default("codex")
});
async function browserPreferences(root) {
  const file = await contained(root, ".apexrest/panel/preferences.json");
  return parse(external_exports.object(browserPreferencesSchema.shape), await exists(file) ? await readJson(file) : {});
}

export {
  ArtifactService,
  digest2 as digest,
  OWNED_TEXT_LIMIT,
  blueprintSchema,
  stateSchema,
  planSchema,
  documentText,
  semanticDigest,
  planLimits,
  validate,
  safePath,
  readDocument,
  planDigest,
  loadCatalog,
  resolvePackages,
  catalogSearch,
  catalogRead,
  journal,
  stagePlan,
  freeze,
  readPlan,
  materialize,
  recoveryPlan,
  checkpoint,
  SyncStore,
  deployPlanSchema,
  DeploymentService,
  allowedOrigin,
  TestService,
  browserPreferences
};
