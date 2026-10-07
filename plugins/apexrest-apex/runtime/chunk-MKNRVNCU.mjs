import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  ToolchainService,
  VERSION,
  canonicalHome,
  renameWithRetry,
  resourceRoot,
  runCommand,
  runtimeState
} from "./chunk-VSHK3GM5.mjs";
import {
  Client,
  ReadBuffer,
  require_applicator,
  require_codegen,
  require_compile,
  require_core,
  require_core2,
  require_dependencies,
  require_discriminator,
  require_format,
  require_metadata,
  require_names,
  require_ref,
  require_ref_error,
  require_util,
  require_validate,
  require_validation,
  require_validation_error,
  serializeMessage
} from "./chunk-XXDZEVC4.mjs";
import {
  managedHome
} from "./chunk-TFGUUAFT.mjs";
import "./chunk-U7MVLA3R.mjs";
import {
  Fault,
  __commonJS,
  __require,
  __toESM,
  atomicWrite,
  canonical,
  contained,
  containedChild,
  exists,
  hash,
  inventory,
  readJson,
  withLock,
  writeJson
} from "./chunk-I5KYBPSK.mjs";

// node_modules/isexe/windows.js
var require_windows = __commonJS({
  "node_modules/isexe/windows.js"(exports, module) {
    module.exports = isexe;
    isexe.sync = sync;
    var fs = __require("fs");
    function checkPathExt(path5, options) {
      var pathext = options.pathExt !== void 0 ? options.pathExt : process.env.PATHEXT;
      if (!pathext) {
        return true;
      }
      pathext = pathext.split(";");
      if (pathext.indexOf("") !== -1) {
        return true;
      }
      for (var i = 0; i < pathext.length; i++) {
        var p = pathext[i].toLowerCase();
        if (p && path5.substr(-p.length).toLowerCase() === p) {
          return true;
        }
      }
      return false;
    }
    function checkStat(stat, path5, options) {
      if (!stat.isSymbolicLink() && !stat.isFile()) {
        return false;
      }
      return checkPathExt(path5, options);
    }
    function isexe(path5, options, cb) {
      fs.stat(path5, function(er, stat) {
        cb(er, er ? false : checkStat(stat, path5, options));
      });
    }
    function sync(path5, options) {
      return checkStat(fs.statSync(path5), path5, options);
    }
  }
});

// node_modules/isexe/mode.js
var require_mode = __commonJS({
  "node_modules/isexe/mode.js"(exports, module) {
    module.exports = isexe;
    isexe.sync = sync;
    var fs = __require("fs");
    function isexe(path5, options, cb) {
      fs.stat(path5, function(er, stat) {
        cb(er, er ? false : checkStat(stat, options));
      });
    }
    function sync(path5, options) {
      return checkStat(fs.statSync(path5), options);
    }
    function checkStat(stat, options) {
      return stat.isFile() && checkMode(stat, options);
    }
    function checkMode(stat, options) {
      var mod = stat.mode;
      var uid = stat.uid;
      var gid = stat.gid;
      var myUid = options.uid !== void 0 ? options.uid : process.getuid && process.getuid();
      var myGid = options.gid !== void 0 ? options.gid : process.getgid && process.getgid();
      var u = parseInt("100", 8);
      var g = parseInt("010", 8);
      var o = parseInt("001", 8);
      var ug = u | g;
      var ret = mod & o || mod & g && gid === myGid || mod & u && uid === myUid || mod & ug && myUid === 0;
      return ret;
    }
  }
});

// node_modules/isexe/index.js
var require_isexe = __commonJS({
  "node_modules/isexe/index.js"(exports, module) {
    var fs = __require("fs");
    var core;
    if (process.platform === "win32" || global.TESTING_WINDOWS) {
      core = require_windows();
    } else {
      core = require_mode();
    }
    module.exports = isexe;
    isexe.sync = sync;
    function isexe(path5, options, cb) {
      if (typeof options === "function") {
        cb = options;
        options = {};
      }
      if (!cb) {
        if (typeof Promise !== "function") {
          throw new TypeError("callback not provided");
        }
        return new Promise(function(resolve, reject) {
          isexe(path5, options || {}, function(er, is) {
            if (er) {
              reject(er);
            } else {
              resolve(is);
            }
          });
        });
      }
      core(path5, options || {}, function(er, is) {
        if (er) {
          if (er.code === "EACCES" || options && options.ignoreErrors) {
            er = null;
            is = false;
          }
        }
        cb(er, is);
      });
    }
    function sync(path5, options) {
      try {
        return core.sync(path5, options || {});
      } catch (er) {
        if (options && options.ignoreErrors || er.code === "EACCES") {
          return false;
        } else {
          throw er;
        }
      }
    }
  }
});

// node_modules/which/which.js
var require_which = __commonJS({
  "node_modules/which/which.js"(exports, module) {
    var isWindows = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys";
    var path5 = __require("path");
    var COLON = isWindows ? ";" : ":";
    var isexe = require_isexe();
    var getNotFoundError = (cmd) => Object.assign(new Error(`not found: ${cmd}`), { code: "ENOENT" });
    var getPathInfo = (cmd, opt) => {
      const colon = opt.colon || COLON;
      const pathEnv = cmd.match(/\//) || isWindows && cmd.match(/\\/) ? [""] : [
        // windows always checks the cwd first
        ...isWindows ? [process.cwd()] : [],
        ...(opt.path || process.env.PATH || /* istanbul ignore next: very unusual */
        "").split(colon)
      ];
      const pathExtExe = isWindows ? opt.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "";
      const pathExt = isWindows ? pathExtExe.split(colon) : [""];
      if (isWindows) {
        if (cmd.indexOf(".") !== -1 && pathExt[0] !== "")
          pathExt.unshift("");
      }
      return {
        pathEnv,
        pathExt,
        pathExtExe
      };
    };
    var which = (cmd, opt, cb) => {
      if (typeof opt === "function") {
        cb = opt;
        opt = {};
      }
      if (!opt)
        opt = {};
      const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
      const found = [];
      const step = (i) => new Promise((resolve, reject) => {
        if (i === pathEnv.length)
          return opt.all && found.length ? resolve(found) : reject(getNotFoundError(cmd));
        const ppRaw = pathEnv[i];
        const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
        const pCmd = path5.join(pathPart, cmd);
        const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
        resolve(subStep(p, i, 0));
      });
      const subStep = (p, i, ii) => new Promise((resolve, reject) => {
        if (ii === pathExt.length)
          return resolve(step(i + 1));
        const ext = pathExt[ii];
        isexe(p + ext, { pathExt: pathExtExe }, (er, is) => {
          if (!er && is) {
            if (opt.all)
              found.push(p + ext);
            else
              return resolve(p + ext);
          }
          return resolve(subStep(p, i, ii + 1));
        });
      });
      return cb ? step(0).then((res) => cb(null, res), cb) : step(0);
    };
    var whichSync = (cmd, opt) => {
      opt = opt || {};
      const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
      const found = [];
      for (let i = 0; i < pathEnv.length; i++) {
        const ppRaw = pathEnv[i];
        const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
        const pCmd = path5.join(pathPart, cmd);
        const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
        for (let j = 0; j < pathExt.length; j++) {
          const cur = p + pathExt[j];
          try {
            const is = isexe.sync(cur, { pathExt: pathExtExe });
            if (is) {
              if (opt.all)
                found.push(cur);
              else
                return cur;
            }
          } catch (ex) {
          }
        }
      }
      if (opt.all && found.length)
        return found;
      if (opt.nothrow)
        return null;
      throw getNotFoundError(cmd);
    };
    module.exports = which;
    which.sync = whichSync;
  }
});

// node_modules/path-key/index.js
var require_path_key = __commonJS({
  "node_modules/path-key/index.js"(exports, module) {
    "use strict";
    var pathKey = (options = {}) => {
      const environment = options.env || process.env;
      const platform = options.platform || process.platform;
      if (platform !== "win32") {
        return "PATH";
      }
      return Object.keys(environment).reverse().find((key) => key.toUpperCase() === "PATH") || "Path";
    };
    module.exports = pathKey;
    module.exports.default = pathKey;
  }
});

// node_modules/cross-spawn/lib/util/resolveCommand.js
var require_resolveCommand = __commonJS({
  "node_modules/cross-spawn/lib/util/resolveCommand.js"(exports, module) {
    "use strict";
    var path5 = __require("path");
    var which = require_which();
    var getPathKey = require_path_key();
    function resolveCommandAttempt(parsed, withoutPathExt) {
      const env = parsed.options.env || process.env;
      const cwd = process.cwd();
      const hasCustomCwd = parsed.options.cwd != null;
      const shouldSwitchCwd = hasCustomCwd && process.chdir !== void 0 && !process.chdir.disabled;
      if (shouldSwitchCwd) {
        try {
          process.chdir(parsed.options.cwd);
        } catch (err) {
        }
      }
      let resolved;
      try {
        resolved = which.sync(parsed.command, {
          path: env[getPathKey({ env })],
          pathExt: withoutPathExt ? path5.delimiter : void 0
        });
      } catch (e) {
      } finally {
        if (shouldSwitchCwd) {
          process.chdir(cwd);
        }
      }
      if (resolved) {
        resolved = path5.resolve(hasCustomCwd ? parsed.options.cwd : "", resolved);
      }
      return resolved;
    }
    function resolveCommand(parsed) {
      return resolveCommandAttempt(parsed) || resolveCommandAttempt(parsed, true);
    }
    module.exports = resolveCommand;
  }
});

// node_modules/cross-spawn/lib/util/escape.js
var require_escape = __commonJS({
  "node_modules/cross-spawn/lib/util/escape.js"(exports, module) {
    "use strict";
    var metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;
    function escapeCommand(arg) {
      arg = arg.replace(metaCharsRegExp, "^$1");
      return arg;
    }
    function escapeArgument(arg, doubleEscapeMetaChars) {
      arg = `${arg}`;
      arg = arg.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
      arg = arg.replace(/(?=(\\+?)?)\1$/, "$1$1");
      arg = `"${arg}"`;
      arg = arg.replace(metaCharsRegExp, "^$1");
      if (doubleEscapeMetaChars) {
        arg = arg.replace(metaCharsRegExp, "^$1");
      }
      return arg;
    }
    module.exports.command = escapeCommand;
    module.exports.argument = escapeArgument;
  }
});

// node_modules/shebang-regex/index.js
var require_shebang_regex = __commonJS({
  "node_modules/shebang-regex/index.js"(exports, module) {
    "use strict";
    module.exports = /^#!(.*)/;
  }
});

// node_modules/shebang-command/index.js
var require_shebang_command = __commonJS({
  "node_modules/shebang-command/index.js"(exports, module) {
    "use strict";
    var shebangRegex = require_shebang_regex();
    module.exports = (string = "") => {
      const match = string.match(shebangRegex);
      if (!match) {
        return null;
      }
      const [path5, argument] = match[0].replace(/#! ?/, "").split(" ");
      const binary = path5.split("/").pop();
      if (binary === "env") {
        return argument;
      }
      return argument ? `${binary} ${argument}` : binary;
    };
  }
});

// node_modules/cross-spawn/lib/util/readShebang.js
var require_readShebang = __commonJS({
  "node_modules/cross-spawn/lib/util/readShebang.js"(exports, module) {
    "use strict";
    var fs = __require("fs");
    var shebangCommand = require_shebang_command();
    function readShebang(command) {
      const size = 150;
      const buffer = Buffer.alloc(size);
      let fd;
      try {
        fd = fs.openSync(command, "r");
        fs.readSync(fd, buffer, 0, size, 0);
        fs.closeSync(fd);
      } catch (e) {
      }
      return shebangCommand(buffer.toString());
    }
    module.exports = readShebang;
  }
});

// node_modules/cross-spawn/lib/parse.js
var require_parse = __commonJS({
  "node_modules/cross-spawn/lib/parse.js"(exports, module) {
    "use strict";
    var path5 = __require("path");
    var resolveCommand = require_resolveCommand();
    var escape = require_escape();
    var readShebang = require_readShebang();
    var isWin = process.platform === "win32";
    var isExecutableRegExp = /\.(?:com|exe)$/i;
    var isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
    function detectShebang(parsed) {
      parsed.file = resolveCommand(parsed);
      const shebang = parsed.file && readShebang(parsed.file);
      if (shebang) {
        parsed.args.unshift(parsed.file);
        parsed.command = shebang;
        return resolveCommand(parsed);
      }
      return parsed.file;
    }
    function parseNonShell(parsed) {
      if (!isWin) {
        return parsed;
      }
      const commandFile = detectShebang(parsed);
      const needsShell = !isExecutableRegExp.test(commandFile);
      if (parsed.options.forceShell || needsShell) {
        const needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile);
        parsed.command = path5.normalize(parsed.command);
        parsed.command = escape.command(parsed.command);
        parsed.args = parsed.args.map((arg) => escape.argument(arg, needsDoubleEscapeMetaChars));
        const shellCommand = [parsed.command].concat(parsed.args).join(" ");
        parsed.args = ["/d", "/s", "/c", `"${shellCommand}"`];
        parsed.command = process.env.comspec || "cmd.exe";
        parsed.options.windowsVerbatimArguments = true;
      }
      return parsed;
    }
    function parse(command, args, options) {
      if (args && !Array.isArray(args)) {
        options = args;
        args = null;
      }
      args = args ? args.slice(0) : [];
      options = Object.assign({}, options);
      const parsed = {
        command,
        args,
        options,
        file: void 0,
        original: {
          command,
          args
        }
      };
      return options.shell ? parsed : parseNonShell(parsed);
    }
    module.exports = parse;
  }
});

// node_modules/cross-spawn/lib/enoent.js
var require_enoent = __commonJS({
  "node_modules/cross-spawn/lib/enoent.js"(exports, module) {
    "use strict";
    var isWin = process.platform === "win32";
    function notFoundError(original, syscall) {
      return Object.assign(new Error(`${syscall} ${original.command} ENOENT`), {
        code: "ENOENT",
        errno: "ENOENT",
        syscall: `${syscall} ${original.command}`,
        path: original.command,
        spawnargs: original.args
      });
    }
    function hookChildProcess(cp2, parsed) {
      if (!isWin) {
        return;
      }
      const originalEmit = cp2.emit;
      cp2.emit = function(name, arg1) {
        if (name === "exit") {
          const err = verifyENOENT(arg1, parsed);
          if (err) {
            return originalEmit.call(cp2, "error", err);
          }
        }
        return originalEmit.apply(cp2, arguments);
      };
    }
    function verifyENOENT(status, parsed) {
      if (isWin && status === 1 && !parsed.file) {
        return notFoundError(parsed.original, "spawn");
      }
      return null;
    }
    function verifyENOENTSync(status, parsed) {
      if (isWin && status === 1 && !parsed.file) {
        return notFoundError(parsed.original, "spawnSync");
      }
      return null;
    }
    module.exports = {
      hookChildProcess,
      verifyENOENT,
      verifyENOENTSync,
      notFoundError
    };
  }
});

// node_modules/cross-spawn/index.js
var require_cross_spawn = __commonJS({
  "node_modules/cross-spawn/index.js"(exports, module) {
    "use strict";
    var cp2 = __require("child_process");
    var parse = require_parse();
    var enoent = require_enoent();
    function spawn2(command, args, options) {
      const parsed = parse(command, args, options);
      const spawned = cp2.spawn(parsed.command, parsed.args, parsed.options);
      enoent.hookChildProcess(spawned, parsed);
      return spawned;
    }
    function spawnSync(command, args, options) {
      const parsed = parse(command, args, options);
      const result = cp2.spawnSync(parsed.command, parsed.args, parsed.options);
      result.error = result.error || enoent.verifyENOENTSync(result.status, parsed);
      return result;
    }
    module.exports = spawn2;
    module.exports.spawn = spawn2;
    module.exports.sync = spawnSync;
    module.exports._parse = parse;
    module.exports._enoent = enoent;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js
var require_dynamicAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicAnchor = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicAnchor",
      schemaType: "string",
      code: (cxt) => dynamicAnchor(cxt, cxt.schema)
    };
    function dynamicAnchor(cxt, anchor) {
      const { gen, it } = cxt;
      it.schemaEnv.root.dynamicAnchors[anchor] = true;
      const v = (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`;
      const validate = it.errSchemaPath === "#" ? it.validateName : _getValidate(cxt);
      gen.if((0, codegen_1._)`!${v}`, () => gen.assign(v, validate));
    }
    exports.dynamicAnchor = dynamicAnchor;
    function _getValidate(cxt) {
      const { schemaEnv, schema, self } = cxt.it;
      const { root, baseId, localRefs, meta } = schemaEnv.root;
      const { schemaId } = self.opts;
      const sch = new compile_1.SchemaEnv({ schema, schemaId, root, baseId, localRefs, meta });
      compile_1.compileSchema.call(self, sch);
      return (0, ref_1.getValidate)(cxt, sch);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js
var require_dynamicRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicRef = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicRef",
      schemaType: "string",
      code: (cxt) => dynamicRef(cxt, cxt.schema)
    };
    function dynamicRef(cxt, ref) {
      const { gen, keyword, it } = cxt;
      if (ref[0] !== "#")
        throw new Error(`"${keyword}" only supports hash fragment reference`);
      const anchor = ref.slice(1);
      if (it.allErrors) {
        _dynamicRef();
      } else {
        const valid = gen.let("valid", false);
        _dynamicRef(valid);
        cxt.ok(valid);
      }
      function _dynamicRef(valid) {
        if (it.schemaEnv.root.dynamicAnchors[anchor]) {
          const v = gen.let("_v", (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`);
          gen.if(v, _callRef(v, valid), _callRef(it.validateName, valid));
        } else {
          _callRef(it.validateName, valid)();
        }
      }
      function _callRef(validate, valid) {
        return valid ? () => gen.block(() => {
          (0, ref_1.callRef)(cxt, validate);
          gen.let(valid, true);
        }) : () => (0, ref_1.callRef)(cxt, validate);
      }
    }
    exports.dynamicRef = dynamicRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js
var require_recursiveAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var util_1 = require_util();
    var def = {
      keyword: "$recursiveAnchor",
      schemaType: "boolean",
      code(cxt) {
        if (cxt.schema)
          (0, dynamicAnchor_1.dynamicAnchor)(cxt, "");
        else
          (0, util_1.checkStrictMode)(cxt.it, "$recursiveAnchor: false is ignored");
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js
var require_recursiveRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicRef_1 = require_dynamicRef();
    var def = {
      keyword: "$recursiveRef",
      schemaType: "string",
      code: (cxt) => (0, dynamicRef_1.dynamicRef)(cxt, cxt.schema)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/index.js
var require_dynamic = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var dynamicRef_1 = require_dynamicRef();
    var recursiveAnchor_1 = require_recursiveAnchor();
    var recursiveRef_1 = require_recursiveRef();
    var dynamic = [dynamicAnchor_1.default, dynamicRef_1.default, recursiveAnchor_1.default, recursiveRef_1.default];
    exports.default = dynamic;
  }
});

// node_modules/ajv/dist/vocabularies/validation/dependentRequired.js
var require_dependentRequired = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/dependentRequired.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentRequired",
      type: "object",
      schemaType: "object",
      error: dependencies_1.error,
      code: (cxt) => (0, dependencies_1.validatePropertyDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js
var require_dependentSchemas = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentSchemas",
      type: "object",
      schemaType: "object",
      code: (cxt) => (0, dependencies_1.validateSchemaDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitContains.js
var require_limitContains = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitContains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["maxContains", "minContains"],
      type: "array",
      schemaType: "number",
      code({ keyword, parentSchema, it }) {
        if (parentSchema.contains === void 0) {
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "contains" is ignored`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/next.js
var require_next = __commonJS({
  "node_modules/ajv/dist/vocabularies/next.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependentRequired_1 = require_dependentRequired();
    var dependentSchemas_1 = require_dependentSchemas();
    var limitContains_1 = require_limitContains();
    var next = [dependentRequired_1.default, dependentSchemas_1.default, limitContains_1.default];
    exports.default = next;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js
var require_unevaluatedProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var error = {
      message: "must NOT have unevaluated properties",
      params: ({ params }) => (0, codegen_1._)`{unevaluatedProperty: ${params.unevaluatedProperty}}`
    };
    var def = {
      keyword: "unevaluatedProperties",
      type: "object",
      schemaType: ["boolean", "object"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, props } = it;
        if (props instanceof codegen_1.Name) {
          gen.if((0, codegen_1._)`${props} !== true`, () => gen.forIn("key", data, (key) => gen.if(unevaluatedDynamic(props, key), () => unevaluatedPropCode(key))));
        } else if (props !== true) {
          gen.forIn("key", data, (key) => props === void 0 ? unevaluatedPropCode(key) : gen.if(unevaluatedStatic(props, key), () => unevaluatedPropCode(key)));
        }
        it.props = true;
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function unevaluatedPropCode(key) {
          if (schema === false) {
            cxt.setParams({ unevaluatedProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (!(0, util_1.alwaysValidSchema)(it, schema)) {
            const valid = gen.name("valid");
            cxt.subschema({
              keyword: "unevaluatedProperties",
              dataProp: key,
              dataPropType: util_1.Type.Str
            }, valid);
            if (!allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          }
        }
        function unevaluatedDynamic(evaluatedProps, key) {
          return (0, codegen_1._)`!${evaluatedProps} || !${evaluatedProps}[${key}]`;
        }
        function unevaluatedStatic(evaluatedProps, key) {
          const ps = [];
          for (const p in evaluatedProps) {
            if (evaluatedProps[p] === true)
              ps.push((0, codegen_1._)`${key} !== ${p}`);
          }
          return (0, codegen_1.and)(...ps);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js
var require_unevaluatedItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "unevaluatedItems",
      type: "array",
      schemaType: ["boolean", "object"],
      error,
      code(cxt) {
        const { gen, schema, data, it } = cxt;
        const items = it.items || 0;
        if (items === true)
          return;
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        if (schema === false) {
          cxt.setParams({ len: items });
          cxt.fail((0, codegen_1._)`${len} > ${items}`);
        } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
          const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items}`);
          gen.if((0, codegen_1.not)(valid), () => validateItems(valid, items));
          cxt.ok(valid);
        }
        it.items = true;
        function validateItems(valid, from) {
          gen.forRange("i", from, len, (i) => {
            cxt.subschema({ keyword: "unevaluatedItems", dataProp: i, dataPropType: util_1.Type.Num }, valid);
            if (!it.allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/index.js
var require_unevaluated = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var unevaluatedProperties_1 = require_unevaluatedProperties();
    var unevaluatedItems_1 = require_unevaluatedItems();
    var unevaluated = [unevaluatedProperties_1.default, unevaluatedItems_1.default];
    exports.default = unevaluated;
  }
});

// node_modules/ajv/dist/vocabularies/draft2020.js
var require_draft2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var dynamic_1 = require_dynamic();
    var next_1 = require_next();
    var unevaluated_1 = require_unevaluated();
    var format_1 = require_format();
    var metadata_1 = require_metadata();
    var draft2020Vocabularies = [
      dynamic_1.default,
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(true),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary,
      next_1.default,
      unevaluated_1.default
    ];
    exports.default = draft2020Vocabularies;
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/schema.json
var require_schema = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/schema.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/schema",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://json-schema.org/draft/2020-12/vocab/applicator": true,
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true,
        "https://json-schema.org/draft/2020-12/vocab/validation": true,
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true,
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true,
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Core and Validation specifications meta-schema",
      allOf: [
        { $ref: "meta/core" },
        { $ref: "meta/applicator" },
        { $ref: "meta/unevaluated" },
        { $ref: "meta/validation" },
        { $ref: "meta/meta-data" },
        { $ref: "meta/format-annotation" },
        { $ref: "meta/content" }
      ],
      type: ["object", "boolean"],
      $comment: "This meta-schema also defines keywords that have appeared in previous drafts in order to prevent incompatible extensions as they remain in common use.",
      properties: {
        definitions: {
          $comment: '"definitions" has been replaced by "$defs".',
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          deprecated: true,
          default: {}
        },
        dependencies: {
          $comment: '"dependencies" has been split and replaced by "dependentSchemas" and "dependentRequired" in order to serve their differing semantics.',
          type: "object",
          additionalProperties: {
            anyOf: [{ $dynamicRef: "#meta" }, { $ref: "meta/validation#/$defs/stringArray" }]
          },
          deprecated: true,
          default: {}
        },
        $recursiveAnchor: {
          $comment: '"$recursiveAnchor" has been replaced by "$dynamicAnchor".',
          $ref: "meta/core#/$defs/anchorString",
          deprecated: true
        },
        $recursiveRef: {
          $comment: '"$recursiveRef" has been replaced by "$dynamicRef".',
          $ref: "meta/core#/$defs/uriReferenceString",
          deprecated: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json
var require_applicator2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/applicator",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/applicator": true
      },
      $dynamicAnchor: "meta",
      title: "Applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        prefixItems: { $ref: "#/$defs/schemaArray" },
        items: { $dynamicRef: "#meta" },
        contains: { $dynamicRef: "#meta" },
        additionalProperties: { $dynamicRef: "#meta" },
        properties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependentSchemas: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        propertyNames: { $dynamicRef: "#meta" },
        if: { $dynamicRef: "#meta" },
        then: { $dynamicRef: "#meta" },
        else: { $dynamicRef: "#meta" },
        allOf: { $ref: "#/$defs/schemaArray" },
        anyOf: { $ref: "#/$defs/schemaArray" },
        oneOf: { $ref: "#/$defs/schemaArray" },
        not: { $dynamicRef: "#meta" }
      },
      $defs: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $dynamicRef: "#meta" }
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json
var require_unevaluated2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/unevaluated",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true
      },
      $dynamicAnchor: "meta",
      title: "Unevaluated applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        unevaluatedItems: { $dynamicRef: "#meta" },
        unevaluatedProperties: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json
var require_content = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/content",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Content vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        contentEncoding: { type: "string" },
        contentMediaType: { type: "string" },
        contentSchema: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json
var require_core3 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/core",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true
      },
      $dynamicAnchor: "meta",
      title: "Core vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        $id: {
          $ref: "#/$defs/uriReferenceString",
          $comment: "Non-empty fragments not allowed.",
          pattern: "^[^#]*#?$"
        },
        $schema: { $ref: "#/$defs/uriString" },
        $ref: { $ref: "#/$defs/uriReferenceString" },
        $anchor: { $ref: "#/$defs/anchorString" },
        $dynamicRef: { $ref: "#/$defs/uriReferenceString" },
        $dynamicAnchor: { $ref: "#/$defs/anchorString" },
        $vocabulary: {
          type: "object",
          propertyNames: { $ref: "#/$defs/uriString" },
          additionalProperties: {
            type: "boolean"
          }
        },
        $comment: {
          type: "string"
        },
        $defs: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" }
        }
      },
      $defs: {
        anchorString: {
          type: "string",
          pattern: "^[A-Za-z_][-A-Za-z0-9._]*$"
        },
        uriString: {
          type: "string",
          format: "uri"
        },
        uriReferenceString: {
          type: "string",
          format: "uri-reference"
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json
var require_format_annotation = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/format-annotation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true
      },
      $dynamicAnchor: "meta",
      title: "Format vocabulary meta-schema for annotation results",
      type: ["object", "boolean"],
      properties: {
        format: { type: "string" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json
var require_meta_data = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/meta-data",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true
      },
      $dynamicAnchor: "meta",
      title: "Meta-data vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        deprecated: {
          type: "boolean",
          default: false
        },
        readOnly: {
          type: "boolean",
          default: false
        },
        writeOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json
var require_validation2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/validation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/validation": true
      },
      $dynamicAnchor: "meta",
      title: "Validation vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        type: {
          anyOf: [
            { $ref: "#/$defs/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/$defs/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        const: true,
        enum: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/$defs/nonNegativeInteger" },
        minLength: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        maxItems: { $ref: "#/$defs/nonNegativeInteger" },
        minItems: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        maxContains: { $ref: "#/$defs/nonNegativeInteger" },
        minContains: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 1
        },
        maxProperties: { $ref: "#/$defs/nonNegativeInteger" },
        minProperties: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        required: { $ref: "#/$defs/stringArray" },
        dependentRequired: {
          type: "object",
          additionalProperties: {
            $ref: "#/$defs/stringArray"
          }
        }
      },
      $defs: {
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 0
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/index.js
var require_json_schema_2020_12 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var metaSchema = require_schema();
    var applicator = require_applicator2();
    var unevaluated = require_unevaluated2();
    var content = require_content();
    var core = require_core3();
    var format = require_format_annotation();
    var metadata = require_meta_data();
    var validation = require_validation2();
    var META_SUPPORT_DATA = ["/properties"];
    function addMetaSchema2020($data) {
      ;
      [
        metaSchema,
        applicator,
        unevaluated,
        content,
        core,
        with$data(this, format),
        metadata,
        with$data(this, validation)
      ].forEach((sch) => this.addMetaSchema(sch, void 0, false));
      return this;
      function with$data(ajv, sch) {
        return $data ? ajv.$dataMetaSchema(sch, META_SUPPORT_DATA) : sch;
      }
    }
    exports.default = addMetaSchema2020;
  }
});

// node_modules/ajv/dist/2020.js
var require__ = __commonJS({
  "node_modules/ajv/dist/2020.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv2020 = void 0;
    var core_1 = require_core();
    var draft2020_1 = require_draft2020();
    var discriminator_1 = require_discriminator();
    var json_schema_2020_12_1 = require_json_schema_2020_12();
    var META_SCHEMA_ID = "https://json-schema.org/draft/2020-12/schema";
    var Ajv20202 = class extends core_1.default {
      constructor(opts = {}) {
        super({
          ...opts,
          dynamicRef: true,
          next: true,
          unevaluated: true
        });
      }
      _addVocabularies() {
        super._addVocabularies();
        draft2020_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        const { $data, meta } = this.opts;
        if (!meta)
          return;
        json_schema_2020_12_1.default.call(this, $data);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv2020 = Ajv20202;
    module.exports = exports = Ajv20202;
    module.exports.Ajv2020 = Ajv20202;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv20202;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// packages/installer/src/setup.ts
import path4 from "node:path";
import { homedir } from "node:os";
import { readFile as readFile2, rm as rm2 } from "node:fs/promises";

// node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js
var import_cross_spawn = __toESM(require_cross_spawn(), 1);
import process2 from "node:process";
import { PassThrough } from "node:stream";
var DEFAULT_INHERITED_ENV_VARS = process2.platform === "win32" ? [
  "APPDATA",
  "HOMEDRIVE",
  "HOMEPATH",
  "LOCALAPPDATA",
  "PATH",
  "PROCESSOR_ARCHITECTURE",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "USERNAME",
  "USERPROFILE",
  "PROGRAMFILES"
] : (
  /* list inspired by the default env inheritance of sudo */
  ["HOME", "LOGNAME", "PATH", "SHELL", "TERM", "USER"]
);
function getDefaultEnvironment() {
  const env = {};
  for (const key of DEFAULT_INHERITED_ENV_VARS) {
    const value = process2.env[key];
    if (value === void 0) {
      continue;
    }
    if (value.startsWith("()")) {
      continue;
    }
    env[key] = value;
  }
  return env;
}
var StdioClientTransport = class {
  constructor(server) {
    this._stderrStream = null;
    this._serverParams = server;
    this._readBuffer = new ReadBuffer({ maxBufferSize: server.maxBufferSize });
    if (server.stderr === "pipe" || server.stderr === "overlapped") {
      this._stderrStream = new PassThrough();
    }
  }
  /**
   * Starts the server process and prepares to communicate with it.
   */
  async start() {
    if (this._process) {
      throw new Error("StdioClientTransport already started! If using Client class, note that connect() calls start() automatically.");
    }
    return new Promise((resolve, reject) => {
      this._process = (0, import_cross_spawn.default)(this._serverParams.command, this._serverParams.args ?? [], {
        // merge default env with server env because mcp server needs some env vars
        env: {
          ...getDefaultEnvironment(),
          ...this._serverParams.env
        },
        stdio: ["pipe", "pipe", this._serverParams.stderr ?? "inherit"],
        shell: false,
        windowsHide: process2.platform === "win32",
        cwd: this._serverParams.cwd
      });
      this._process.on("error", (error) => {
        reject(error);
        this.onerror?.(error);
      });
      this._process.on("spawn", () => {
        resolve();
      });
      this._process.on("close", (_code) => {
        this._process = void 0;
        this.onclose?.();
      });
      this._process.stdin?.on("error", (error) => {
        this.onerror?.(error);
      });
      this._process.stdout?.on("data", (chunk) => {
        try {
          this._readBuffer.append(chunk);
          this.processReadBuffer();
        } catch (error) {
          this.onerror?.(error);
          this.close().catch(() => {
          });
        }
      });
      this._process.stdout?.on("error", (error) => {
        this.onerror?.(error);
      });
      if (this._stderrStream && this._process.stderr) {
        this._process.stderr.pipe(this._stderrStream);
      }
    });
  }
  /**
   * The stderr stream of the child process, if `StdioServerParameters.stderr` was set to "pipe" or "overlapped".
   *
   * If stderr piping was requested, a PassThrough stream is returned _immediately_, allowing callers to
   * attach listeners before the start method is invoked. This prevents loss of any early
   * error output emitted by the child process.
   */
  get stderr() {
    if (this._stderrStream) {
      return this._stderrStream;
    }
    return this._process?.stderr ?? null;
  }
  /**
   * The child process pid spawned by this transport.
   *
   * This is only available after the transport has been started.
   */
  get pid() {
    return this._process?.pid ?? null;
  }
  processReadBuffer() {
    while (true) {
      try {
        const message = this._readBuffer.readMessage();
        if (message === null) {
          break;
        }
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error);
      }
    }
  }
  async close() {
    if (this._process) {
      const processToClose = this._process;
      this._process = void 0;
      const closePromise = new Promise((resolve) => {
        processToClose.once("close", () => {
          resolve();
        });
      });
      try {
        processToClose.stdin?.end();
      } catch {
      }
      await Promise.race([closePromise, new Promise((resolve) => setTimeout(resolve, 2e3).unref())]);
      if (processToClose.exitCode === null) {
        try {
          processToClose.kill("SIGTERM");
        } catch {
        }
        await Promise.race([closePromise, new Promise((resolve) => setTimeout(resolve, 2e3).unref())]);
      }
      if (processToClose.exitCode === null) {
        try {
          processToClose.kill("SIGKILL");
        } catch {
        }
      }
    }
    this._readBuffer.clear();
  }
  send(message) {
    return new Promise((resolve) => {
      if (!this._process?.stdin) {
        throw new Error("Not connected");
      }
      const json = serializeMessage(message);
      if (this._process.stdin.write(json)) {
        resolve();
      } else {
        this._process.stdin.once("drain", resolve);
      }
    });
  }
};

// packages/installer/src/registration.ts
import path2 from "node:path";

// packages/installer/src/package-source.ts
var import__ = __toESM(require__(), 1);
import path from "node:path";
import { lstat, realpath } from "node:fs/promises";
async function rejectLink(file) {
  if ((await lstat(file)).isSymbolicLink())
    throw new Fault("SYMLINK_NOT_ALLOWED", "Source and bundle inventories reject symlinks.", 2);
}
async function pluginAt(root) {
  if (await exists(path.join(root, ".codex-plugin/plugin.json")) || await exists(path.join(root, "plugin.json")))
    return root;
  const plugins = path.join(root, "plugins");
  if (!await exists(plugins)) return;
  await rejectLink(plugins);
  const plugin = path.join(plugins, "apexrest-apex");
  if (!await exists(plugin)) return;
  await rejectLink(plugin);
  if (await exists(path.join(plugin, ".codex-plugin/plugin.json")) || await exists(path.join(plugin, "plugin.json")))
    return plugin;
}
async function resolveNativePlugin(source) {
  const candidates = source ? [path.resolve(source)] : [path.resolve(resourceRoot(), ".."), path.resolve(resourceRoot(), "../codex-compat")];
  for (const candidate of candidates) {
    if (!await exists(candidate)) continue;
    const plugin = await pluginAt(await realpath(candidate));
    if (plugin) return plugin;
  }
  throw new Fault(
    "INVALID_PACKAGE",
    "No APEXREST plugin bundle found. Set the source to a built plugin directory or its marketplace directory.",
    2
  );
}
var nativeMarketplace = {
  name: "apexrest",
  interface: { displayName: "APEXREST" },
  plugins: [
    {
      name: "apexrest-apex",
      source: { source: "local", path: "./plugins/apexrest-apex" },
      policy: { installation: "AVAILABLE", authentication: "ON_USE", products: ["codex"] },
      category: "Productivity"
    }
  ]
};
async function validateNative(source) {
  const root = await resolveNativePlugin(source);
  await inventory(root);
  const portable = await exists(path.join(root, "plugin.json"));
  const manifest = await readJson(
    path.join(root, portable ? "plugin.json" : ".codex-plugin/plugin.json")
  );
  if (manifest.name !== "apexrest-apex" || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(manifest.version))
    throw new Fault("INVALID_PACKAGE", "Invalid plugin identity or version.", 2);
  const mcp = await readJson(path.join(root, portable ? "mcp.json" : ".mcp.json"));
  if (!mcp.mcpServers.apexrest || Object.keys(mcp.mcpServers).length !== 1)
    throw new Fault("INVALID_PACKAGE", "Package must expose exactly its own MCP server.", 2);
  if (portable) {
    const ajv = new import__.Ajv2020({ strict: false });
    for (const [file, value] of [
      ["plugin", manifest],
      ["mcp", mcp]
    ])
      if (!ajv.validate(
        await readJson(path.join(resourceRoot(), `schemas/vendor/${file}.schema.json`)),
        value
      ))
        throw new Fault("MANIFEST_SCHEMA_INVALID", ajv.errorsText(), 2);
  } else if (manifest.mcpServers !== "./.mcp.json")
    throw new Fault("MANIFEST_SCHEMA_INVALID", "Compatibility manifest must use the companion .mcp.json.", 2);
  if (await exists(path.join(root, ".claude-plugin/plugin.json"))) {
    const claude = await readJson(path.join(root, ".claude-plugin/plugin.json"));
    if (claude.name !== "apexrest" || claude.version !== manifest.version || claude.skills !== (manifest.skills ?? "./skills/") || !claude.mcpServers?.apexrest || Object.keys(claude.mcpServers).length !== 1 || JSON.stringify(claude.mcpServers.apexrest.args) !== JSON.stringify(["${CLAUDE_PLUGIN_ROOT}/runtime/mcp.mjs"]))
      throw new Fault(
        "MANIFEST_SCHEMA_INVALID",
        "Claude Code must use the same version, skills and runtime as Codex.",
        2
      );
  }
  for (const file of ["runtime/mcp.mjs", "runtime/apexrest.mjs", "skills/apexrest-setup/SKILL.md"])
    if (!await exists(path.join(root, file))) throw new Fault("INCOMPLETE_PACKAGE", `Missing ${file}`, 2);
  return { status: "valid", profile: portable ? "portable" : "codex-compat", version: manifest.version };
}

// packages/installer/src/registration.ts
async function checkCodex(codexHome, codex = "codex") {
  const result = await runCommand({
    executable: codex,
    args: ["--version"],
    cwd: process.cwd(),
    env: { ...process.env, CODEX_HOME: codexHome },
    timeoutMs: 1e4
  });
  if (result.code !== 0 || result.timedOut || result.truncated || !/^codex-cli\s+\d+\./.test(result.stdout))
    throw new Fault(
      "DEPENDENCY_MISSING",
      "A working Codex CLI is required for plugin setup. Install Codex, then preview setup again.",
      3,
      "dependency_missing"
    );
}
function codexRun(codexHome, cwd, codex = "codex") {
  return (args, timeoutMs = 6e4) => runCommand({
    executable: codex,
    args,
    cwd,
    env: { ...process.env, CODEX_HOME: codexHome },
    timeoutMs
  });
}
function codexInvoke(codexHome, cwd, codex = "codex") {
  const run = codexRun(codexHome, cwd, codex);
  return async (args) => {
    const result = await run(args);
    if (result.timedOut || result.cancelled || result.truncated || result.code === null)
      throw new Fault(
        "CODEX_REGISTRATION_UNKNOWN",
        "Codex did not return a complete result. Inspect the registration before retrying.",
        6,
        "outcome_unknown"
      );
    if (result.code !== 0)
      throw new Fault("CODEX_REGISTRATION_FAILED", result.stderr || result.stdout, 3, "blocked");
    try {
      return JSON.parse(result.stdout);
    } catch {
      throw new Fault(
        "CODEX_REGISTRATION_UNKNOWN",
        "Codex returned an invalid registration response.",
        6,
        "outcome_unknown"
      );
    }
  };
}
async function listMarketplaces(invoke) {
  const result = await invoke(["plugin", "marketplace", "list", "--json"]);
  if (!Array.isArray(result.marketplaces) || result.marketplaces.some((m) => typeof m.name !== "string" || typeof m.root !== "string"))
    throw new Fault(
      "CODEX_REGISTRATION_UNKNOWN",
      "Codex returned an invalid marketplace listing.",
      6,
      "outcome_unknown"
    );
  return result.marketplaces;
}
async function inspectRegistration(markets, home, codexHome, destination) {
  const entries = markets.filter((m) => m.name === "apexrest");
  const conflict = (reason) => {
    throw new Fault(
      "MARKETPLACE_OWNERSHIP_CONFLICT",
      `Cannot update the apexrest marketplace at ${entries[0]?.root ?? "(unknown)"} in ${codexHome}: ${reason} It was left unchanged. Select another Codex profile directory in Advanced options, or review this registration in Codex.`,
      5,
      "conflict"
    );
  };
  if (entries.length > 1) conflict("more than one registration was found.");
  const existing = entries[0];
  if (!existing) return { action: "install", fingerprint: hash(canonical(markets)), markets };
  let version, files;
  try {
    if (existing.marketplaceSource && existing.marketplaceSource.sourceType !== "local")
      conflict("automatic migration supports a local APEXREST marketplace only.");
    const metadata = await readJson(path2.join(existing.root, ".agents/plugins/marketplace.json"));
    if (canonical(metadata) !== canonical(nativeMarketplace))
      conflict("its metadata does not identify the dedicated APEXREST marketplace.");
    const plugin = await resolveNativePlugin(existing.root);
    if (path2.relative(existing.root, plugin).split(path2.sep).join("/") !== "plugins/apexrest-apex")
      conflict("its plugin source is not the expected local bundle.");
    version = (await validateNative(plugin)).version;
    files = await inventory(plugin);
  } catch (error) {
    if (error instanceof Fault && error.code === "MARKETPLACE_OWNERSHIP_CONFLICT") throw error;
    conflict("its APEXREST plugin bundle could not be validated.");
  }
  const receipt = path2.join(home, "installation.json");
  const previous = await exists(receipt) ? await readJson(receipt) : void 0;
  const managed = existing.root === destination || existing.root === previous?.destination && previous?.codexHome === codexHome;
  return {
    action: managed ? "update" : "adopt",
    previousRoot: existing.root,
    previousVersion: version,
    fingerprint: hash(canonical({ markets, files })),
    markets
  };
}

// packages/installer/src/native.ts
import path3 from "node:path";
import { cp, mkdir, readFile, rm, chmod } from "node:fs/promises";
var claudeFile = ".claude-plugin/plugin.json";
function normalizeClaude(manifest) {
  const server = manifest.mcpServers?.apexrest;
  if (manifest.name !== "apexrest" || !server || Object.keys(manifest.mcpServers).length !== 1)
    throw new Fault("INVALID_PACKAGE", "Claude Code must expose the same apexrest MCP server.", 2);
  server.command = "node";
  server.args = ["${CLAUDE_PLUGIN_ROOT}/runtime/mcp.mjs"];
  delete server.env;
  return manifest;
}
async function installNative(r) {
  const source = await resolveNativePlugin(r.source);
  await validateNative(source);
  const payload = Object.fromEntries(
    Object.entries(await inventory(source)).map(([file, digest2]) => [
      "plugins/apexrest-apex/" + file,
      digest2
    ])
  );
  payload[".agents/plugins/marketplace.json"] = hash(JSON.stringify(nativeMarketplace, null, 2) + "\n");
  const claude = await exists(path3.join(source, claudeFile)) ? await readJson(path3.join(source, claudeFile)) : void 0;
  const claudeMarketplace = claude ? {
    name: "apexrest",
    owner: claude.author ?? { name: "APEXREST" },
    metadata: { description: "Oracle APEX development, deployment and testing", version: claude.version },
    plugins: [
      {
        name: claude.name,
        source: "./plugins/apexrest-apex",
        description: claude.description,
        version: claude.version,
        category: "productivity"
      }
    ]
  } : void 0;
  if (claudeMarketplace)
    payload[".claude-plugin/marketplace.json"] = hash(JSON.stringify(claudeMarketplace, null, 2) + "\n");
  const copyDigest = hash(canonical(payload));
  const sourceMcpFile = await exists(path3.join(source, "plugin.json")) ? "mcp.json" : ".mcp.json";
  const mcpKey = "plugins/apexrest-apex/" + sourceMcpFile;
  const claudeKey = "plugins/apexrest-apex/" + claudeFile;
  const expectedFiles = canonical({
    ...payload,
    [mcpKey]: void 0,
    ...claude ? { [claudeKey]: void 0 } : {}
  });
  const expectedClaude = claude ? canonical(normalizeClaude(claude)) : void 0;
  const sourceMcp = await readJson(path3.join(source, sourceMcpFile));
  const sourceServer = sourceMcp.mcpServers.apexrest;
  if (!sourceServer) throw new Fault("INVALID_PACKAGE", "Native package has no apexrest MCP server.", 2);
  sourceServer.command = "node";
  sourceServer.args = ["runtime/mcp.mjs"];
  delete sourceServer.env;
  payload[mcpKey] = hash(JSON.stringify(sourceMcp, null, 2) + "\n");
  if (claude) payload[claudeKey] = hash(JSON.stringify(claude, null, 2) + "\n");
  const digest = hash(canonical(payload));
  if (!r.dryRun) {
    await mkdir(r.home, { recursive: true, mode: 448 });
    await mkdir(r.codexHome, { recursive: true, mode: 448 });
  }
  const home = await canonicalHome(r.home);
  const codexHome = await canonicalHome(r.codexHome);
  const node = r.node ?? process.execPath;
  const destination = path3.join(home, "native", hash(canonical({ sourceDigest: digest, node, home })));
  const root = path3.join(destination, "plugins/apexrest-apex");
  const cli = path3.join(root, "runtime/apexrest.mjs");
  const launchers = launcherScripts(home, node, cli);
  const invoke = codexInvoke(codexHome, await exists(home) ? home : process.cwd(), r.codex);
  if (!await exists(codexHome)) await checkCodex(codexHome, r.codex);
  const inspect = async () => inspectRegistration(
    await exists(codexHome) ? await listMarketplaces(invoke) : [],
    home,
    codexHome,
    destination
  );
  let registration = await inspect();
  if (r.expectedRegistration && r.expectedRegistration !== registration.fingerprint)
    throw new Fault(
      "MARKETPLACE_CHANGED",
      "The Codex registration changed after setup preflight. Review setup again.",
      5,
      "conflict"
    );
  if (r.dryRun)
    return {
      state: "planned",
      source,
      scope: "apexrest-plugin-only",
      sourceDigest: digest,
      destination,
      node,
      codexHome,
      registration
    };
  return withLock(path3.join(home, "install.lock"), async () => {
    await mkdir(codexHome, { recursive: true, mode: 448 });
    const config = path3.join(codexHome, "config.toml");
    const stamp = Date.now();
    const configBackup = path3.join(home, "config-before-install-" + stamp + ".toml");
    if (await exists(config)) await cp(config, configBackup);
    const repaired = await exists(destination) && !await reusable(destination, expectedFiles, mcpKey, expectedClaude);
    if (repaired) {
      const broken = `${destination}.broken-${stamp}`;
      await renameWithRetry(destination, broken);
      await rm(broken, { recursive: true, force: true });
    }
    if (!await exists(destination)) {
      const staging = destination + ".staging";
      await rm(staging, { recursive: true, force: true });
      await mkdir(staging, { recursive: true, mode: 448 });
      await mkdir(path3.join(staging, "plugins"), { recursive: true });
      await cp(source, path3.join(staging, "plugins/apexrest-apex"), { recursive: true });
      await writeJson(path3.join(staging, ".agents/plugins/marketplace.json"), nativeMarketplace);
      if (claudeMarketplace)
        await writeJson(path3.join(staging, ".claude-plugin/marketplace.json"), claudeMarketplace);
      if (hash(canonical(await inventory(staging))) !== copyDigest)
        throw new Fault("PACKAGE_COPY_INVALID", "Native package copy changed.", 5);
      await renameWithRetry(staging, destination);
    }
    const portable = await exists(path3.join(root, "plugin.json"));
    const mcpPath = path3.join(root, portable ? "mcp.json" : ".mcp.json");
    const mcp = JSON.parse(await readFile(mcpPath, "utf8"));
    const server = mcp.mcpServers.apexrest;
    if (!server) throw new Fault("INVALID_PACKAGE", "Native package has no apexrest MCP server.", 2);
    server.command = node;
    server.args = [path3.join(root, "runtime/mcp.mjs")];
    server.env = { APEXREST_HOME: home };
    await writeJson(mcpPath, mcp);
    if (claude) {
      const installedClaude = normalizeClaude(
        await readJson(path3.join(root, claudeFile))
      );
      installedClaude.mcpServers.apexrest.command = node;
      installedClaude.mcpServers.apexrest.env = { APEXREST_HOME: home };
      await writeJson(path3.join(root, claudeFile), installedClaude);
    }
    if (repaired && registration.previousRoot === destination) registration = await inspect();
    const current = await inspect();
    if (current.fingerprint !== registration.fingerprint)
      throw new Fault(
        "MARKETPLACE_CHANGED",
        "The Codex registration changed during setup. Nothing was re-registered; review setup again.",
        5,
        "conflict"
      );
    const transition = path3.join(home, "registration-before-install-" + stamp + ".json");
    const previousListing = registration.previousRoot ? await invoke(["plugin", "list", "--marketplace", "apexrest", "--json"]) : void 0;
    const previousPlugin = previousListing?.installed?.find((plugin) => plugin.pluginId === "apexrest-apex@apexrest");
    const record = { registration, destination, codexHome, configBackup, previousListing };
    await writeJson(transition, { status: "prepared", ...record });
    let marketplace, installed, listing;
    const replacing = registration.previousRoot && registration.previousRoot !== destination;
    try {
      if (replacing) await invoke(["plugin", "marketplace", "remove", "apexrest", "--json"]);
      marketplace = await invoke(["plugin", "marketplace", "add", destination, "--json"]);
      installed = await invoke(["plugin", "add", "apexrest-apex@apexrest", "--json"]);
      const cached = installed.installedPath;
      if (!cached || canonical(await inventory(await contained(codexHome, cached))) !== canonical(await inventory(root)))
        throw new Fault("NATIVE_CACHE_MISMATCH", "Codex did not install the reviewed plugin files.", 5);
      listing = await invoke(["plugin", "list", "--marketplace", "apexrest", "--json"]);
      if (!listing.installed?.some(
        (plugin) => plugin.pluginId === "apexrest-apex@apexrest" && plugin.enabled
      ))
        throw new Fault(
          "NATIVE_PLUGIN_NOT_ENABLED",
          "Codex did not enable the installed APEXREST plugin.",
          3
        );
      const after = await listMarketplaces(invoke);
      if (after.find((m) => m.name === "apexrest")?.root !== destination || canonical(after.filter((m) => m.name !== "apexrest")) !== canonical(registration.markets.filter((m) => m.name !== "apexrest")))
        throw new Fault(
          "MARKETPLACE_CHANGED",
          "Codex registration verification failed. Inspect the saved registration record before retrying.",
          5,
          "conflict"
        );
      await writeJson(transition, { status: "registered", ...record });
    } catch (error) {
      let recovery = "needs-review";
      let unknown = error instanceof Fault && error.status === "outcome_unknown";
      if (replacing && !(error instanceof Fault && error.status === "outcome_unknown")) {
        try {
          const after = await listMarketplaces(invoke);
          const selected = after.find((m) => m.name === "apexrest");
          if (canonical(after.filter((m) => m.name !== "apexrest")) !== canonical(registration.markets.filter((m) => m.name !== "apexrest")) || (await inspectRegistration(registration.markets, home, codexHome, destination)).fingerprint !== registration.fingerprint)
            throw new Error("The prior registration or source changed externally.");
          if (selected && selected.root !== destination && selected.root !== registration.previousRoot)
            throw new Error("Registration changed externally.");
          if (selected?.root === destination)
            await invoke(["plugin", "marketplace", "remove", "apexrest", "--json"]);
          if (selected?.root !== registration.previousRoot)
            await invoke(["plugin", "marketplace", "add", registration.previousRoot, "--json"]);
          if (previousPlugin?.enabled) {
            const restored = await invoke(["plugin", "add", "apexrest-apex@apexrest", "--json"]);
            const previousRoot = await resolveNativePlugin(registration.previousRoot);
            if (!restored.installedPath || canonical(await inventory(await contained(codexHome, restored.installedPath))) !== canonical(await inventory(previousRoot)))
              throw new Error("The previous cached plugin could not be verified.");
          }
          if ((await listMarketplaces(invoke)).find((m) => m.name === "apexrest")?.root !== registration.previousRoot)
            throw new Error("The previous marketplace could not be verified.");
          recovery = previousPlugin?.enabled ? "previous-registration-restored" : "previous-marketplace-restored; plugin-state-needs-review";
        } catch (recoveryError) {
          unknown ||= recoveryError instanceof Fault && recoveryError.status === "outcome_unknown";
          recovery = unknown ? "outcome-unknown" : "needs-review";
        }
      } else if (error instanceof Fault && error.status === "outcome_unknown") recovery = "outcome-unknown";
      await writeJson(transition, { status: "failed", recovery, ...record });
      throw new Fault(
        error instanceof Fault ? error.code : "CODEX_REGISTRATION_FAILED",
        `${error instanceof Error ? error.message : "Registration failed."} Recovery: ${recovery}. Record: ${transition}`,
        unknown ? 6 : error instanceof Fault ? error.exitCode : 3,
        unknown ? "outcome_unknown" : error instanceof Fault ? error.status : "blocked"
      );
    }
    const state = {
      schemaVersion: 1,
      state: "registered",
      sourceDigest: digest,
      destination,
      root,
      node,
      codexHome,
      marketplace,
      installed,
      listing,
      registration: { ...registration, transition },
      actions: ["CODEX_RELOAD_REQUIRED", "NATIVE_HOST_VERIFICATION_REQUIRED"]
    };
    await writeJson(path3.join(home, "installation.json"), state);
    await mkdir(path3.join(home, "bin"), { recursive: true });
    for (const [name, contents] of Object.entries(launchers)) {
      await atomicWrite(path3.join(home, "bin", name), contents);
      if (name === "apexrest") await chmod(path3.join(home, "bin", name), 448);
    }
    await writeJson(transition, { status: "completed", ...record });
    return state;
  });
}
async function installationState(home) {
  return readJson(path3.join(home, "installation.json"));
}
async function reusable(destination, expectedFiles, mcpKey, expectedClaude) {
  try {
    const files = await inventory(destination);
    if (!files[mcpKey]) return false;
    if (expectedClaude) {
      const claudeKey = "plugins/apexrest-apex/" + claudeFile;
      if (!files[claudeKey]) return false;
      if (canonical(normalizeClaude(await readJson(path3.join(destination, claudeKey)))) !== expectedClaude)
        return false;
      files[claudeKey] = void 0;
    }
    return canonical({ ...files, [mcpKey]: void 0 }) === expectedFiles;
  } catch {
    return false;
  }
}
var cmdUnsafe = /[%!"\x00-\x1f]/;
function launcherScripts(home, node, cli, platform = process.platform) {
  if (platform !== "win32") {
    const quote = (value) => "'" + value.replaceAll("'", `'"'"'`) + "'";
    return {
      apexrest: `#!/bin/sh
export APEXREST_HOME=${quote(home)}
exec ${quote(node)} ${quote(cli)} "$@"
`
    };
  }
  if ([home, node, cli].some((value) => cmdUnsafe.test(value)))
    throw new Fault(
      "UNSAFE_LAUNCHER_PATH",
      'The managed home, Node.js or plugin path contains characters a Windows launcher cannot represent safely (% ! " or control characters). Choose another home directory.',
      2,
      "blocked"
    );
  const ps = (value) => "'" + value.replaceAll("'", "''") + "'";
  return {
    // Restore the caller's APEXREST_HOME: a dot-sourced or in-session call must not leak it.
    "apexrest.ps1": `$apexrestPreviousHome = $env:APEXREST_HOME
$env:APEXREST_HOME = ${ps(home)}
try {
  & ${ps(node)} ${ps(cli)} @args
  $apexrestExitCode = $LASTEXITCODE
} finally {
  $env:APEXREST_HOME = $apexrestPreviousHome
}
exit $apexrestExitCode
`,
    "apexrest.cmd": `@echo off\r
setlocal\r
set "APEXREST_HOME=${home}"\r
"${node}" "${cli}" %*\r
exit /b %ERRORLEVEL%\r
`
  };
}

// packages/installer/src/setup.ts
async function setup(input) {
  const text = (key) => input[key];
  const home = await canonicalHome(
    text("home") ?? (input.scope === "project" ? path4.join(text("project") ?? process.cwd(), ".apexrest/managed") : managedHome())
  );
  if (input.scope === "project") {
    throw new Fault(
      "PROJECT_HOST_SCOPE_UNAVAILABLE",
      "Codex 0.154.0 plugin add enables in the selected user profile. Use --scope user with a dedicated --codex-home until project-only enablement is verified.",
      3,
      "blocked"
    );
  }
  const source = await resolveNativePlugin(text("from"));
  const validation = await validateNative(source);
  if (text("version") && text("version") !== validation.version)
    throw new Fault(
      "VERSION_MISMATCH",
      "Requested version does not match the supplied immutable package.",
      2
    );
  const codexHome = await canonicalHome(
    text("codexHome") ?? process.env.CODEX_HOME ?? path4.join(homedir(), ".codex")
  );
  const codex = text("codex");
  const request = {
    home,
    ...text("cacheDir") ? { cacheDir: text("cacheDir") } : {},
    offline: Boolean(input.offline),
    dryRun: Boolean(input.dryRun),
    yes: Boolean(input.yes),
    nonInteractive: Boolean(input.nonInteractive),
    acceptOracleLicense: Boolean(input.acceptOracleLicense)
  };
  const existingRuntime = await runtimeState(home);
  const nativePlan = await installNative({
    source,
    home,
    codexHome,
    ...codex ? { codex } : {},
    dryRun: true,
    node: existingRuntime.node ?? process.execPath
  });
  if (input.dryRun)
    return {
      status: "planned",
      package: validation,
      toolchain: input.nativeOnly ? { status: "not-requested", components: {} } : await new ToolchainService().plan(request),
      native: nativePlan
    };
  if (!input.yes)
    throw new Fault(
      "SETUP_APPROVAL_REQUIRED",
      "Use --dry-run to review, then --yes for technical installation steps.",
      4,
      "needs-user-action"
    );
  const toolchain = input.nativeOnly ? { status: "not-requested", components: {} } : await new ToolchainService().apply(request);
  const runtime = await runtimeState(home);
  const native = await installNative({
    source,
    home,
    codexHome,
    ...codex ? { codex } : {},
    node: runtime.node ?? process.execPath,
    expectedRegistration: nativePlan.registration.fingerprint
  });
  if (!("root" in native)) throw new Fault("INSTALL_NOT_COMPLETED", "Native install remained a plan.", 3);
  const mcp = JSON.parse(
    await readFile2(
      path4.join(native.root, validation.profile === "portable" ? "mcp.json" : ".mcp.json"),
      "utf8"
    )
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry) => entry[1] !== void 0)
  );
  env.APEXREST_HOME = home;
  const client = new Client({ name: "apexrest-installer", version: VERSION });
  const transport = new StdioClientTransport({ ...mcp.mcpServers.apexrest, env, stderr: "pipe" });
  try {
    await client.connect(transport);
    await client.listTools();
  } finally {
    await client.close();
  }
  const result = {
    schemaVersion: 1,
    status: "needs-user-action",
    components: {
      ..."components" in toolchain ? toolchain.components : {},
      nativePlugin: "registered",
      mcp: "verified",
      database: "not-configured"
    },
    actions: [{ code: "CODEX_RELOAD_REQUIRED" }, { code: "DATABASE_CONNECTION_REQUIRED" }],
    native,
    toolchain
  };
  await writeJson(path4.join(home, "setup-result.json"), result);
  return result;
}
var ownedDestination = (home, destination) => {
  if (typeof destination !== "string" || !path4.isAbsolute(destination) || path4.dirname(destination) !== path4.join(home, "native") || !/^[a-f0-9]{64}$/.test(path4.basename(destination)))
    throw new Fault(
      "MARKETPLACE_OWNERSHIP_CONFLICT",
      "The installation record does not name a managed native payload under this home; nothing was removed.",
      5,
      "conflict"
    );
  return destination;
};
async function uninstallNative(homeInput, keepRuntime, options = {}) {
  const home = await canonicalHome(homeInput);
  return withLock(path4.join(home, "install.lock"), async () => {
    const state = await installationState(home);
    if (typeof state.codexHome !== "string" || !path4.isAbsolute(state.codexHome))
      throw new Fault("INSTALLATION_RECORD_INVALID", "The installation record has no Codex profile.", 5);
    const codexHome = state.codexHome;
    const destination = ownedDestination(home, state.destination);
    const run = codexRun(codexHome, home, options.codex);
    const markets = await listMarketplaces(codexInvoke(codexHome, home, options.codex));
    if (!markets.some((m) => m.name === "apexrest" && m.root === destination))
      throw new Fault(
        "MARKETPLACE_OWNERSHIP_CONFLICT",
        "Current marketplace no longer belongs to this installation; nothing was removed.",
        5
      );
    const result = await run(["plugin", "remove", "apexrest-apex@apexrest"], 3e4);
    if (result.code !== 0) throw new Fault("UNINSTALL_FAILED", result.stderr, 3);
    const removal = await run(["plugin", "marketplace", "remove", "apexrest"], 3e4);
    if (removal.code !== 0) throw new Fault("MARKETPLACE_REMOVE_FAILED", removal.stderr, 3);
    const listing = await run(["plugin", "list", "--json"], 3e4);
    if (listing.code !== 0 || listing.stdout.includes("apexrest-apex@apexrest"))
      throw new Fault("UNINSTALL_UNCONFIRMED", "Codex still lists this plugin.", 3);
    if (!keepRuntime && await exists(destination))
      await rm2(await containedChild(path4.join(home, "native"), destination), {
        recursive: true,
        force: true
      });
    await writeJson(path4.join(home, "uninstalled.json"), {
      at: (/* @__PURE__ */ new Date()).toISOString(),
      keepRuntime,
      sharedRuntimePreserved: true
    });
    return {
      status: "uninstalled",
      projectsPreserved: true,
      backupsPreserved: true,
      credentialsPreserved: true,
      sharedRuntimePreserved: true
    };
  });
}
export {
  setup,
  uninstallNative,
  validateNative
};
