import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  runPooledSqlcl,
  runSqlclMcp
} from "./chunk-XXDZEVC4.mjs";
import {
  isProductionTarget,
  managedHome,
  parse,
  refName,
  relativePath,
  targetDigest
} from "./chunk-TFGUUAFT.mjs";
import {
  external_exports
} from "./chunk-U7MVLA3R.mjs";
import {
  Fault,
  __commonJS,
  __export,
  __require,
  __toESM,
  atomicWrite,
  canonical,
  contained,
  exists,
  hash,
  hashFile,
  inventory,
  readJson,
  redact,
  withLock,
  writeJson
} from "./chunk-I5KYBPSK.mjs";

// node_modules/pend/index.js
var require_pend = __commonJS({
  "node_modules/pend/index.js"(exports, module) {
    module.exports = Pend;
    function Pend() {
      this.pending = 0;
      this.max = Infinity;
      this.listeners = [];
      this.waiting = [];
      this.error = null;
    }
    Pend.prototype.go = function(fn) {
      if (this.pending < this.max) {
        pendGo(this, fn);
      } else {
        this.waiting.push(fn);
      }
    };
    Pend.prototype.wait = function(cb) {
      if (this.pending === 0) {
        cb(this.error);
      } else {
        this.listeners.push(cb);
      }
    };
    Pend.prototype.hold = function() {
      return pendHold(this);
    };
    function pendHold(self) {
      self.pending += 1;
      var called = false;
      return onCb;
      function onCb(err) {
        if (called) throw new Error("callback called twice");
        called = true;
        self.error = self.error || err;
        self.pending -= 1;
        if (self.waiting.length > 0 && self.pending < self.max) {
          pendGo(self, self.waiting.shift());
        } else if (self.pending === 0) {
          var listeners = self.listeners;
          self.listeners = [];
          listeners.forEach(cbListener);
        }
      }
      function cbListener(listener) {
        listener(self.error);
      }
    }
    function pendGo(self, fn) {
      fn(pendHold(self));
    }
  }
});

// node_modules/yauzl/fd-slicer.js
var require_fd_slicer = __commonJS({
  "node_modules/yauzl/fd-slicer.js"(exports) {
    var fs2 = __require("fs");
    var util = __require("util");
    var stream = __require("stream");
    var Readable = stream.Readable;
    var PassThrough = stream.PassThrough;
    var Pend = require_pend();
    var EventEmitter = __require("events").EventEmitter;
    exports.BufferSlicer = BufferSlicer;
    exports.FdSlicer = FdSlicer;
    util.inherits(FdSlicer, EventEmitter);
    function FdSlicer(fd) {
      EventEmitter.call(this);
      this.fd = fd;
      this.pend = new Pend();
      this.pend.max = 1;
      this.refCount = 0;
    }
    FdSlicer.prototype.read = function(buffer, offset, length, position, callback) {
      var self = this;
      self.pend.go(function(cb) {
        fs2.read(self.fd, buffer, offset, length, position, function(err, bytesRead, buffer2) {
          cb();
          callback(err, bytesRead, buffer2);
        });
      });
    };
    FdSlicer.prototype.createReadStream = function(options2) {
      return new ReadStream(this, options2);
    };
    FdSlicer.prototype.ref = function() {
      this.refCount += 1;
    };
    FdSlicer.prototype.unref = function() {
      var self = this;
      self.refCount -= 1;
      if (self.refCount < 0) throw new Error("invalid unref");
      if (self.refCount > 0) return;
      fs2.close(self.fd, onCloseDone);
      function onCloseDone(err) {
        if (err) {
          self.emit("error", err);
        } else {
          self.emit("close");
        }
      }
    };
    util.inherits(ReadStream, Readable);
    function ReadStream(context, options2) {
      options2 = options2 || {};
      Readable.call(this, options2);
      this.context = context;
      this.context.ref();
      this.start = options2.start || 0;
      this.endOffset = options2.end;
      this.pos = this.start;
    }
    ReadStream.prototype._read = function(n) {
      var self = this;
      var toRead = Math.min(self._readableState.highWaterMark, n);
      if (self.endOffset != null) {
        toRead = Math.min(toRead, self.endOffset - self.pos);
      }
      if (toRead <= 0) {
        self.push(null);
        this._cleanup();
        return;
      }
      self.context.pend.go(function(cb) {
        var buffer = Buffer.allocUnsafe(toRead);
        fs2.read(self.context.fd, buffer, 0, toRead, self.pos, function(err, bytesRead) {
          if (err) {
            self.destroy(err);
          } else if (bytesRead === 0) {
            self.push(null);
            self._cleanup();
          } else {
            self.pos += bytesRead;
            self.push(buffer.slice(0, bytesRead));
          }
          cb();
        });
      });
    };
    ReadStream.prototype._destroy = function(err, cb) {
      this._cleanup();
      cb(err);
    };
    ReadStream.prototype._cleanup = function() {
      if (this.context != null) {
        this.context.unref();
        this.context = null;
      }
    };
    util.inherits(BufferSlicer, EventEmitter);
    function BufferSlicer(buffer) {
      EventEmitter.call(this);
      this.refCount = 0;
      this.buffer = buffer;
    }
    BufferSlicer.prototype.read = function(buffer, offset, length, position, callback) {
      if (!(0 <= offset && offset <= buffer.length)) throw new RangeError("offset outside buffer: 0 <= " + offset + " <= " + buffer.length);
      if (position < 0) throw new RangeError("position is negative: " + position);
      if (offset + length > buffer.length) {
        length = buffer.length - offset;
      }
      if (position + length > this.buffer.length) {
        length = this.buffer.length - position;
      }
      if (length <= 0) {
        setImmediate(function() {
          callback(null, 0);
        });
        return;
      }
      this.buffer.copy(buffer, offset, position, position + length);
      setImmediate(function() {
        callback(null, length);
      });
    };
    BufferSlicer.prototype.createReadStream = function(options2) {
      options2 = options2 || {};
      var readStream = new PassThrough(options2);
      readStream.start = options2.start || 0;
      readStream.endOffset = options2.end;
      readStream.pos = readStream.endOffset || this.buffer.length;
      var entireSlice = this.buffer.slice(readStream.start, readStream.pos);
      var maxChunkSize = 65536;
      var offset = 0;
      while (true) {
        var nextOffset = offset + maxChunkSize;
        if (nextOffset >= entireSlice.length) {
          if (offset < entireSlice.length) {
            readStream.write(entireSlice.slice(offset, entireSlice.length));
          }
          break;
        }
        readStream.write(entireSlice.slice(offset, nextOffset));
        offset = nextOffset;
      }
      readStream.end();
      return readStream;
    };
    BufferSlicer.prototype.ref = function() {
      this.refCount += 1;
    };
    BufferSlicer.prototype.unref = function() {
      this.refCount -= 1;
      if (this.refCount < 0) {
        throw new Error("invalid unref");
      }
    };
  }
});

// node_modules/yauzl/crc32.js
var require_crc32 = __commonJS({
  "node_modules/yauzl/crc32.js"(exports, module) {
    var CRC_TABLE = new Int32Array([
      0,
      1996959894,
      3993919788,
      2567524794,
      124634137,
      1886057615,
      3915621685,
      2657392035,
      249268274,
      2044508324,
      3772115230,
      2547177864,
      162941995,
      2125561021,
      3887607047,
      2428444049,
      498536548,
      1789927666,
      4089016648,
      2227061214,
      450548861,
      1843258603,
      4107580753,
      2211677639,
      325883990,
      1684777152,
      4251122042,
      2321926636,
      335633487,
      1661365465,
      4195302755,
      2366115317,
      997073096,
      1281953886,
      3579855332,
      2724688242,
      1006888145,
      1258607687,
      3524101629,
      2768942443,
      901097722,
      1119000684,
      3686517206,
      2898065728,
      853044451,
      1172266101,
      3705015759,
      2882616665,
      651767980,
      1373503546,
      3369554304,
      3218104598,
      565507253,
      1454621731,
      3485111705,
      3099436303,
      671266974,
      1594198024,
      3322730930,
      2970347812,
      795835527,
      1483230225,
      3244367275,
      3060149565,
      1994146192,
      31158534,
      2563907772,
      4023717930,
      1907459465,
      112637215,
      2680153253,
      3904427059,
      2013776290,
      251722036,
      2517215374,
      3775830040,
      2137656763,
      141376813,
      2439277719,
      3865271297,
      1802195444,
      476864866,
      2238001368,
      4066508878,
      1812370925,
      453092731,
      2181625025,
      4111451223,
      1706088902,
      314042704,
      2344532202,
      4240017532,
      1658658271,
      366619977,
      2362670323,
      4224994405,
      1303535960,
      984961486,
      2747007092,
      3569037538,
      1256170817,
      1037604311,
      2765210733,
      3554079995,
      1131014506,
      879679996,
      2909243462,
      3663771856,
      1141124467,
      855842277,
      2852801631,
      3708648649,
      1342533948,
      654459306,
      3188396048,
      3373015174,
      1466479909,
      544179635,
      3110523913,
      3462522015,
      1591671054,
      702138776,
      2966460450,
      3352799412,
      1504918807,
      783551873,
      3082640443,
      3233442989,
      3988292384,
      2596254646,
      62317068,
      1957810842,
      3939845945,
      2647816111,
      81470997,
      1943803523,
      3814918930,
      2489596804,
      225274430,
      2053790376,
      3826175755,
      2466906013,
      167816743,
      2097651377,
      4027552580,
      2265490386,
      503444072,
      1762050814,
      4150417245,
      2154129355,
      426522225,
      1852507879,
      4275313526,
      2312317920,
      282753626,
      1742555852,
      4189708143,
      2394877945,
      397917763,
      1622183637,
      3604390888,
      2714866558,
      953729732,
      1340076626,
      3518719985,
      2797360999,
      1068828381,
      1219638859,
      3624741850,
      2936675148,
      906185462,
      1090812512,
      3747672003,
      2825379669,
      829329135,
      1181335161,
      3412177804,
      3160834842,
      628085408,
      1382605366,
      3423369109,
      3138078467,
      570562233,
      1426400815,
      3317316542,
      2998733608,
      733239954,
      1555261956,
      3268935591,
      3050360625,
      752459403,
      1541320221,
      2607071920,
      3965973030,
      1969922972,
      40735498,
      2617837225,
      3943577151,
      1913087877,
      83908371,
      2512341634,
      3803740692,
      2075208622,
      213261112,
      2463272603,
      3855990285,
      2094854071,
      198958881,
      2262029012,
      4057260610,
      1759359992,
      534414190,
      2176718541,
      4139329115,
      1873836001,
      414664567,
      2282248934,
      4279200368,
      1711684554,
      285281116,
      2405801727,
      4167216745,
      1634467795,
      376229701,
      2685067896,
      3608007406,
      1308918612,
      956543938,
      2808555105,
      3495958263,
      1231636301,
      1047427035,
      2932959818,
      3654703836,
      1088359270,
      936918e3,
      2847714899,
      3736837829,
      1202900863,
      817233897,
      3183342108,
      3401237130,
      1404277552,
      615818150,
      3134207493,
      3453421203,
      1423857449,
      601450431,
      3009837614,
      3294710456,
      1567103746,
      711928724,
      3020668471,
      3272380065,
      1510334235,
      755167117
    ]);
    function crc32(buf) {
      let crc = -1;
      for (let x of buf) {
        crc = CRC_TABLE[(crc ^ x) & 255] ^ crc >>> 8;
      }
      return (crc ^ -1) >>> 0;
    }
    module.exports = crc32;
  }
});

// node_modules/yauzl/index.js
var require_yauzl = __commonJS({
  "node_modules/yauzl/index.js"(exports) {
    var fs2 = __require("fs");
    var zlib = __require("zlib");
    var fd_slicer = require_fd_slicer();
    var util = __require("util");
    var EventEmitter = __require("events").EventEmitter;
    var Transform = __require("stream").Transform;
    var PassThrough = __require("stream").PassThrough;
    var Writable = __require("stream").Writable;
    var crc32 = typeof zlib.crc32 === "function" ? zlib.crc32 : require_crc32();
    exports.open = open4;
    exports.fromFd = fromFd;
    exports.fromBuffer = fromBuffer;
    exports.fromRandomAccessReader = fromRandomAccessReader;
    exports.openPromise = openPromise;
    exports.fromFdPromise = fromFdPromise;
    exports.fromBufferPromise = fromBufferPromise;
    exports.fromRandomAccessReaderPromise = fromRandomAccessReaderPromise;
    exports.dosDateTimeToDate = dosDateTimeToDate;
    exports.getFileNameLowLevel = getFileNameLowLevel;
    exports.validateFileName = validateFileName;
    exports.parseExtraFields = parseExtraFields;
    exports.ZipFile = ZipFile;
    exports.Entry = Entry;
    exports.LocalFileHeader = LocalFileHeader;
    exports.RandomAccessReader = RandomAccessReader;
    function openPromise(path17, options2) {
      return new Promise((resolve, reject) => {
        open4(path17, { ...options2, lazyEntries: true }, function(err, zipfile) {
          if (err) return reject(err);
          resolve(zipfile);
        });
      });
    }
    function fromFdPromise(fd, options2) {
      return new Promise((resolve, reject) => {
        fromFd(fd, { ...options2, lazyEntries: true }, function(err, zipfile) {
          if (err) return reject(err);
          resolve(zipfile);
        });
      });
    }
    function fromBufferPromise(buffer, options2) {
      return new Promise((resolve, reject) => {
        fromBuffer(buffer, { ...options2, lazyEntries: true }, function(err, zipfile) {
          if (err) return reject(err);
          resolve(zipfile);
        });
      });
    }
    function fromRandomAccessReaderPromise(reader, totalSize, options2) {
      return new Promise((resolve, reject) => {
        fromRandomAccessReader(reader, totalSize, { ...options2, lazyEntries: true }, function(err, zipfile) {
          if (err) return reject(err);
          resolve(zipfile);
        });
      });
    }
    function open4(path17, options2, callback) {
      if (typeof options2 === "function") {
        callback = options2;
        options2 = null;
      }
      if (options2 == null) options2 = {};
      if (options2.autoClose == null) options2.autoClose = true;
      if (options2.lazyEntries == null) options2.lazyEntries = false;
      if (options2.decodeStrings == null) options2.decodeStrings = true;
      if (options2.validateEntrySizes == null) options2.validateEntrySizes = true;
      if (options2.strictFileNames == null) options2.strictFileNames = false;
      if (callback == null) callback = defaultCallback;
      fs2.open(path17, "r", function(err, fd) {
        if (err) return callback(err);
        fromFd(fd, options2, function(err2, zipfile) {
          if (err2) fs2.close(fd, defaultCallback);
          callback(err2, zipfile);
        });
      });
    }
    function fromFd(fd, options2, callback) {
      if (typeof options2 === "function") {
        callback = options2;
        options2 = null;
      }
      if (options2 == null) options2 = {};
      if (options2.autoClose == null) options2.autoClose = false;
      if (options2.lazyEntries == null) options2.lazyEntries = false;
      if (options2.decodeStrings == null) options2.decodeStrings = true;
      if (options2.validateEntrySizes == null) options2.validateEntrySizes = true;
      if (options2.strictFileNames == null) options2.strictFileNames = false;
      if (callback == null) callback = defaultCallback;
      fs2.fstat(fd, function(err, stats) {
        if (err) return callback(err);
        var reader = new fd_slicer.FdSlicer(fd);
        fromRandomAccessReader(reader, stats.size, options2, callback);
      });
    }
    function fromBuffer(buffer, options2, callback) {
      if (typeof options2 === "function") {
        callback = options2;
        options2 = null;
      }
      if (options2 == null) options2 = {};
      options2.autoClose = false;
      if (options2.lazyEntries == null) options2.lazyEntries = false;
      if (options2.decodeStrings == null) options2.decodeStrings = true;
      if (options2.validateEntrySizes == null) options2.validateEntrySizes = true;
      if (options2.strictFileNames == null) options2.strictFileNames = false;
      var reader = new fd_slicer.BufferSlicer(buffer);
      fromRandomAccessReader(reader, buffer.length, options2, callback);
    }
    function fromRandomAccessReader(reader, totalSize, options2, callback) {
      if (typeof options2 === "function") {
        callback = options2;
        options2 = null;
      }
      if (options2 == null) options2 = {};
      if (options2.autoClose == null) options2.autoClose = true;
      if (options2.lazyEntries == null) options2.lazyEntries = false;
      if (options2.decodeStrings == null) options2.decodeStrings = true;
      var decodeStrings = !!options2.decodeStrings;
      if (options2.validateEntrySizes == null) options2.validateEntrySizes = true;
      if (options2.strictFileNames == null) options2.strictFileNames = false;
      if (callback == null) callback = defaultCallback;
      if (typeof totalSize !== "number") throw new Error("expected totalSize parameter to be a number");
      if (totalSize > Number.MAX_SAFE_INTEGER) {
        throw new Error("zip file too large. only file sizes up to 2^52 are supported due to JavaScript's Number type being an IEEE 754 double.");
      }
      reader.ref();
      var eocdrWithoutCommentSize = 22;
      var zip64EocdlSize = 20;
      var maxCommentSize = 65535;
      var bufferSize = Math.min(zip64EocdlSize + eocdrWithoutCommentSize + maxCommentSize, totalSize);
      var buffer = newBuffer(bufferSize);
      var bufferReadStart = totalSize - buffer.length;
      readAndAssertNoEof(reader, buffer, 0, bufferSize, bufferReadStart, function(err) {
        if (err) return callback(err);
        for (var i = bufferSize - eocdrWithoutCommentSize; i >= 0; i -= 1) {
          if (buffer.readUInt32LE(i) !== 101010256) continue;
          var eocdrBuffer = buffer.subarray(i);
          var diskNumber = eocdrBuffer.readUInt16LE(4);
          var entryCount = eocdrBuffer.readUInt16LE(10);
          var centralDirectoryOffset = eocdrBuffer.readUInt32LE(16);
          var commentLength = eocdrBuffer.readUInt16LE(20);
          var expectedCommentLength = eocdrBuffer.length - eocdrWithoutCommentSize;
          if (commentLength !== expectedCommentLength) {
            return callback(new Error("Invalid comment length. Expected: " + expectedCommentLength + ". Found: " + commentLength + ". Are there extra bytes at the end of the file? Or is the end of central dir signature `PK\u263A\u263B` in the comment?"));
          }
          var comment = decodeStrings ? decodeBuffer(eocdrBuffer.subarray(22), false) : eocdrBuffer.subarray(22);
          if (i - zip64EocdlSize >= 0 && buffer.readUInt32LE(i - zip64EocdlSize) === 117853008) {
            var zip64EocdlBuffer = buffer.subarray(i - zip64EocdlSize, i - zip64EocdlSize + zip64EocdlSize);
            var zip64EocdrOffset = readUInt64LE(zip64EocdlBuffer, 8);
            var zip64EocdrBuffer = newBuffer(56);
            return readAndAssertNoEof(reader, zip64EocdrBuffer, 0, zip64EocdrBuffer.length, zip64EocdrOffset, function(err2) {
              if (err2) return callback(err2);
              if (zip64EocdrBuffer.readUInt32LE(0) !== 101075792) {
                return callback(new Error("invalid zip64 end of central directory record signature"));
              }
              diskNumber = zip64EocdrBuffer.readUInt32LE(16);
              if (diskNumber !== 0) {
                return callback(new Error("multi-disk zip files are not supported: found disk number: " + diskNumber));
              }
              entryCount = readUInt64LE(zip64EocdrBuffer, 32);
              centralDirectoryOffset = readUInt64LE(zip64EocdrBuffer, 48);
              return callback(null, new ZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options2.autoClose, options2.lazyEntries, decodeStrings, options2.validateEntrySizes, options2.strictFileNames));
            });
          }
          if (diskNumber !== 0) {
            return callback(new Error("multi-disk zip files are not supported: found disk number: " + diskNumber));
          }
          return callback(null, new ZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options2.autoClose, options2.lazyEntries, decodeStrings, options2.validateEntrySizes, options2.strictFileNames));
        }
        callback(new Error("End of central directory record signature not found. Either not a zip file, or file is truncated."));
      });
    }
    util.inherits(ZipFile, EventEmitter);
    function ZipFile(reader, centralDirectoryOffset, fileSize, entryCount, comment, autoClose, lazyEntries, decodeStrings, validateEntrySizes, strictFileNames) {
      var self = this;
      EventEmitter.call(self);
      self.reader = reader;
      self.reader.on("error", function(err) {
        emitError(self, err);
      });
      self.reader.once("close", function() {
        self.emit("close");
      });
      self.readEntryCursor = centralDirectoryOffset;
      self.fileSize = fileSize;
      self.entryCount = entryCount;
      self.comment = comment;
      self.entriesRead = 0;
      self.autoClose = !!autoClose;
      self.lazyEntries = !!lazyEntries;
      self.decodeStrings = !!decodeStrings;
      self.validateEntrySizes = !!validateEntrySizes;
      self.strictFileNames = !!strictFileNames;
      self.isOpen = true;
      self.emittedError = false;
      self.hasEachEntryBeenCalled = false;
      if (!self.lazyEntries) self._readEntry();
    }
    ZipFile.prototype.close = function() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.reader.unref();
    };
    function emitErrorAndAutoClose(self, err) {
      if (self.autoClose) self.close();
      emitError(self, err);
    }
    function emitError(self, err) {
      if (self.emittedError) return;
      self.emittedError = true;
      self.emit("error", err);
    }
    ZipFile.prototype.readEntry = function() {
      if (!this.lazyEntries) throw new Error("readEntry() called without lazyEntries:true");
      this._readEntry();
    };
    ZipFile.prototype._readEntry = function() {
      var self = this;
      if (self.entryCount === self.entriesRead) {
        setImmediate(function() {
          if (self.autoClose) self.close();
          if (self.emittedError) return;
          self.emit("end");
        });
        return;
      }
      if (self.emittedError) return;
      var buffer = newBuffer(46);
      readAndAssertNoEof(self.reader, buffer, 0, buffer.length, self.readEntryCursor, function(err) {
        if (err) return emitErrorAndAutoClose(self, err);
        if (self.emittedError) return;
        var entry = new Entry();
        var signature = buffer.readUInt32LE(0);
        if (signature !== 33639248) return emitErrorAndAutoClose(self, new Error("invalid central directory file header signature: 0x" + signature.toString(16)));
        entry.versionMadeBy = buffer.readUInt16LE(4);
        entry.versionNeededToExtract = buffer.readUInt16LE(6);
        entry.generalPurposeBitFlag = buffer.readUInt16LE(8);
        entry.compressionMethod = buffer.readUInt16LE(10);
        entry.lastModFileTime = buffer.readUInt16LE(12);
        entry.lastModFileDate = buffer.readUInt16LE(14);
        entry.crc32 = buffer.readUInt32LE(16);
        entry.compressedSize = buffer.readUInt32LE(20);
        entry.uncompressedSize = buffer.readUInt32LE(24);
        entry.fileNameLength = buffer.readUInt16LE(28);
        entry.extraFieldLength = buffer.readUInt16LE(30);
        entry.fileCommentLength = buffer.readUInt16LE(32);
        entry.internalFileAttributes = buffer.readUInt16LE(36);
        entry.externalFileAttributes = buffer.readUInt32LE(38);
        entry.relativeOffsetOfLocalHeader = buffer.readUInt32LE(42);
        if (entry.generalPurposeBitFlag & 64) return emitErrorAndAutoClose(self, new Error("strong encryption is not supported"));
        self.readEntryCursor += 46;
        buffer = newBuffer(entry.fileNameLength + entry.extraFieldLength + entry.fileCommentLength);
        readAndAssertNoEof(self.reader, buffer, 0, buffer.length, self.readEntryCursor, function(err2) {
          if (err2) return emitErrorAndAutoClose(self, err2);
          if (self.emittedError) return;
          entry.fileNameRaw = buffer.subarray(0, entry.fileNameLength);
          var fileCommentStart = entry.fileNameLength + entry.extraFieldLength;
          entry.extraFieldRaw = buffer.subarray(entry.fileNameLength, fileCommentStart);
          entry.fileCommentRaw = buffer.subarray(fileCommentStart, fileCommentStart + entry.fileCommentLength);
          try {
            entry.extraFields = parseExtraFields(entry.extraFieldRaw);
          } catch (err3) {
            return emitErrorAndAutoClose(self, err3);
          }
          if (self.decodeStrings) {
            var isUtf8 = (entry.generalPurposeBitFlag & 2048) !== 0;
            entry.fileComment = decodeBuffer(entry.fileCommentRaw, isUtf8);
            entry.fileName = getFileNameLowLevel(entry.generalPurposeBitFlag, entry.fileNameRaw, entry.extraFields, self.strictFileNames);
            var errorMessage = validateFileName(entry.fileName);
            if (errorMessage != null) return emitErrorAndAutoClose(self, new Error(errorMessage));
          } else {
            entry.fileComment = entry.fileCommentRaw;
            entry.fileName = entry.fileNameRaw;
          }
          entry.comment = entry.fileComment;
          self.readEntryCursor += buffer.length;
          self.entriesRead += 1;
          for (var i = 0; i < entry.extraFields.length; i++) {
            var extraField = entry.extraFields[i];
            if (extraField.id !== 1) continue;
            var zip64EiefBuffer = extraField.data;
            var index = 0;
            if (entry.uncompressedSize === 4294967295) {
              if (index + 8 > zip64EiefBuffer.length) {
                return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include uncompressed size"));
              }
              entry.uncompressedSize = readUInt64LE(zip64EiefBuffer, index);
              index += 8;
            }
            if (entry.compressedSize === 4294967295) {
              if (index + 8 > zip64EiefBuffer.length) {
                return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include compressed size"));
              }
              entry.compressedSize = readUInt64LE(zip64EiefBuffer, index);
              index += 8;
            }
            if (entry.relativeOffsetOfLocalHeader === 4294967295) {
              if (index + 8 > zip64EiefBuffer.length) {
                return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include relative header offset"));
              }
              entry.relativeOffsetOfLocalHeader = readUInt64LE(zip64EiefBuffer, index);
              index += 8;
            }
            break;
          }
          if (self.validateEntrySizes && entry.compressionMethod === 0) {
            var expectedCompressedSize = entry.uncompressedSize;
            if (entry.isEncrypted()) {
              expectedCompressedSize += 12;
            }
            if (entry.compressedSize !== expectedCompressedSize) {
              var msg = "compressed/uncompressed size mismatch for stored file: " + entry.compressedSize + " != " + entry.uncompressedSize;
              return emitErrorAndAutoClose(self, new Error(msg));
            }
          }
          self.emit("entry", entry);
          if (!self.lazyEntries) self._readEntry();
        });
      });
    };
    ZipFile.prototype.eachEntry = function() {
      const self = this;
      if (!self.lazyEntries) throw new Error("eachEntry() requires lazyEntries: true");
      if (self.hasEachEntryBeenCalled) throw new Error("eachEntry() must only be called once per ZipFile");
      self.hasEachEntryBeenCalled = true;
      let pendingResolveReject = null;
      self.on("entry", onEntry);
      self.on("end", onEnd);
      self.on("error", onError);
      function cleanup() {
        self.removeListener("entry", onEntry);
        self.removeListener("end", onEnd);
        self.removeListener("error", onError);
        if (self.autoClose) self.close();
      }
      function onEntry(entry) {
        let { resolve } = pendingResolveReject;
        pendingResolveReject = null;
        resolve({ value: entry });
      }
      function onEnd() {
        let { resolve } = pendingResolveReject;
        pendingResolveReject = null;
        cleanup();
        resolve({ done: true });
      }
      function onError(err) {
        let { reject } = pendingResolveReject;
        pendingResolveReject = null;
        cleanup();
        reject(err);
      }
      return {
        [Symbol.asyncIterator]() {
          return this;
        },
        next() {
          const promise = new Promise((resolve, reject) => {
            if (pendingResolveReject != null) throw new Error("next() called before previous Promise was resolved.");
            pendingResolveReject = { resolve, reject };
          });
          self.readEntry();
          return promise;
        },
        return(value) {
          cleanup();
          return Promise.resolve({ done: true, value });
        },
        throw(value) {
          cleanup();
          return Promise.reject(value);
        }
      };
    };
    ZipFile.prototype.openReadStream = function(entry, options2, callback) {
      var self = this;
      var relativeStart = 0;
      var relativeEnd = entry.compressedSize;
      if (callback == null) {
        callback = options2;
        options2 = null;
      }
      if (options2 == null) {
        options2 = {};
      } else {
        if (options2.decodeFileData === false) {
          if (options2.decrypt != null) {
            throw new Error("cannot use options.decrypt when options.decodeFileData === false");
          }
          if (options2.decompress != null) {
            throw new Error("cannot use options.decompress when options.decodeFileData === false");
          }
        } else {
          if (options2.decrypt != null) {
            if (!entry.isEncrypted()) {
              throw new Error("options.decrypt can only be specified for encrypted entries. See also option decodeFileData.");
            }
            if (options2.decrypt !== false) throw new Error("invalid options.decrypt value: " + options2.decrypt);
            if (entry.isCompressed()) {
              if (options2.decompress !== false) throw new Error("entry is encrypted and compressed, and options.decompress !== false. See also option decodeFileData.");
            }
          }
          if (options2.decompress != null) {
            if (!entry.isCompressed()) {
              throw new Error("options.decompress can only be specified for compressed entries. See also option decodeFileData.");
            }
            if (!(options2.decompress === false || options2.decompress === true)) {
              throw new Error("invalid options.decompress value: " + options2.decompress);
            }
            decompress = options2.decompress;
          }
        }
        if (options2.start != null) {
          relativeStart = options2.start;
          if (relativeStart < 0) throw new Error("options.start < 0");
          if (relativeStart > entry.compressedSize) throw new Error("options.start > entry.compressedSize");
        }
        if (options2.end != null) {
          relativeEnd = options2.end;
          if (relativeEnd < 0) throw new Error("options.end < 0");
          if (relativeEnd > entry.compressedSize) throw new Error("options.end > entry.compressedSize");
          if (relativeEnd < relativeStart) throw new Error("options.end < options.start");
        }
      }
      var rawMode = options2.decodeFileData === false || // Explicitly requested raw.
      (entry.compressionMethod === 0 || // Naturally without compression.
      entry.compressionMethod === 8 && options2.decompress === false) && (!entry.isEncrypted() || // Naturally without encryption.
      options2.decrypt === false);
      if (options2.start != null || options2.end != null) {
        if (!rawMode) throw new Error("start/end range require options.decodeFileData === false for non-trivial encoded entries.");
      }
      if (!self.isOpen) return callback(new Error("closed"));
      if (entry.isEncrypted() && !rawMode) {
        if (options2.decrypt !== false) return callback(new Error("entry is encrypted, and options.decodeFileData !== false"));
      }
      var decompress;
      if (rawMode) {
        decompress = false;
      } else if (entry.compressionMethod === 8) {
        decompress = options2.decodeFileData !== true;
      } else {
        return callback(new Error("unsupported compression method: " + entry.compressionMethod));
      }
      self.readLocalFileHeader(entry, { minimal: true }, function(err, localFileHeader) {
        if (err) return callback(err);
        self.openReadStreamLowLevel(
          localFileHeader.fileDataStart,
          entry.compressedSize,
          relativeStart,
          relativeEnd,
          decompress,
          entry.uncompressedSize,
          callback
        );
      });
    };
    ZipFile.prototype.openReadStreamLowLevel = function(fileDataStart, compressedSize, relativeStart, relativeEnd, decompress, uncompressedSize, callback) {
      var self = this;
      var fileDataEnd = fileDataStart + compressedSize;
      var readStream = self.reader.createReadStream({
        start: fileDataStart + relativeStart,
        end: fileDataStart + relativeEnd
      });
      var endpointStream = readStream;
      if (decompress) {
        var destroyed = false;
        var inflateFilter = zlib.createInflateRaw();
        readStream.on("error", function(err) {
          setImmediate(function() {
            if (!destroyed) inflateFilter.emit("error", err);
          });
        });
        readStream.pipe(inflateFilter);
        if (self.validateEntrySizes) {
          endpointStream = new AssertByteCountStream(uncompressedSize);
          inflateFilter.on("error", function(err) {
            setImmediate(function() {
              if (!destroyed) endpointStream.emit("error", err);
            });
          });
          inflateFilter.pipe(endpointStream);
        } else {
          endpointStream = inflateFilter;
        }
        installDestroyFn(endpointStream, function() {
          destroyed = true;
          if (inflateFilter !== endpointStream) inflateFilter.unpipe(endpointStream);
          readStream.unpipe(inflateFilter);
          readStream.destroy();
        });
      }
      callback(null, endpointStream);
    };
    ZipFile.prototype.readLocalFileHeader = function(entry, options2, callback) {
      var self = this;
      if (callback == null) {
        callback = options2;
        options2 = null;
      }
      if (options2 == null) options2 = {};
      self.reader.ref();
      var buffer = newBuffer(30);
      readAndAssertNoEof(self.reader, buffer, 0, buffer.length, entry.relativeOffsetOfLocalHeader, function(err) {
        try {
          if (err) return callback(err);
          var signature = buffer.readUInt32LE(0);
          if (signature !== 67324752) {
            return callback(new Error("invalid local file header signature: 0x" + signature.toString(16)));
          }
          var fileNameLength = buffer.readUInt16LE(26);
          var extraFieldLength = buffer.readUInt16LE(28);
          var fileDataStart = entry.relativeOffsetOfLocalHeader + 30 + fileNameLength + extraFieldLength;
          if (fileDataStart + entry.compressedSize > self.fileSize) {
            return callback(new Error("file data overflows file bounds: " + fileDataStart + " + " + entry.compressedSize + " > " + self.fileSize));
          }
          if (options2.minimal) {
            return callback(null, { fileDataStart });
          }
          var localFileHeader = new LocalFileHeader();
          localFileHeader.fileDataStart = fileDataStart;
          localFileHeader.versionNeededToExtract = buffer.readUInt16LE(4);
          localFileHeader.generalPurposeBitFlag = buffer.readUInt16LE(6);
          localFileHeader.compressionMethod = buffer.readUInt16LE(8);
          localFileHeader.lastModFileTime = buffer.readUInt16LE(10);
          localFileHeader.lastModFileDate = buffer.readUInt16LE(12);
          localFileHeader.crc32 = buffer.readUInt32LE(14);
          localFileHeader.compressedSize = buffer.readUInt32LE(18);
          localFileHeader.uncompressedSize = buffer.readUInt32LE(22);
          localFileHeader.fileNameLength = fileNameLength;
          localFileHeader.extraFieldLength = extraFieldLength;
          buffer = newBuffer(fileNameLength + extraFieldLength);
          self.reader.ref();
          readAndAssertNoEof(self.reader, buffer, 0, buffer.length, entry.relativeOffsetOfLocalHeader + 30, function(err2) {
            try {
              if (err2) return callback(err2);
              localFileHeader.fileName = buffer.subarray(0, fileNameLength);
              localFileHeader.extraField = buffer.subarray(fileNameLength);
              return callback(null, localFileHeader);
            } finally {
              self.reader.unref();
            }
          });
        } finally {
          self.reader.unref();
        }
      });
    };
    ZipFile.prototype.openReadStreamPromise = function(entry, options2) {
      return new Promise((resolve, reject) => {
        this.openReadStream(entry, options2, function(err, readStream) {
          if (err) return reject(err);
          resolve(readStream);
        });
      });
    };
    ZipFile.prototype.openReadStreamLowLevelPromise = function(fileDataStart, compressedSize, relativeStart, relativeEnd, decompress, uncompressedSize) {
      return new Promise((resolve, reject) => {
        this.openReadStream(fileDataStart, compressedSize, relativeStart, relativeEnd, decompress, uncompressedSize, function(err, readStream) {
          if (err) return reject(err);
          resolve(readStream);
        });
      });
    };
    ZipFile.prototype.readLocalFileHeaderPromise = function(entry, options2) {
      return new Promise((resolve, reject) => {
        this.readLocalFileHeader(entry, options2, function(err, localFileHeader) {
          if (err) return reject(err);
          resolve(localFileHeader);
        });
      });
    };
    function Entry() {
    }
    Entry.prototype.getLastModDate = function(options2) {
      if (options2 == null) options2 = {};
      if (!options2.forceDosFormat) {
        for (var i = 0; i < this.extraFields.length; i++) {
          var extraField = this.extraFields[i];
          if (extraField.id === 21589) {
            var data = extraField.data;
            if (data.length < 5) continue;
            var flags = data[0];
            var HAS_MTIME = 1;
            if (!(flags & HAS_MTIME)) continue;
            var posixTimestamp = data.readInt32LE(1);
            return new Date(posixTimestamp * 1e3);
          } else if (extraField.id === 10) {
            var data = extraField.data;
            if (data.length !== 32) continue;
            if (data.readUInt16LE(4) !== 1) continue;
            if (data.readUInt16LE(6) !== 24) continue;
            var hundredNanoSecondsSince1601 = data.readUInt32LE(8) + 4294967296 * data.readInt32LE(12);
            var millisecondsSince1970 = hundredNanoSecondsSince1601 / 1e4 - 116444736e5;
            return new Date(millisecondsSince1970);
          }
        }
      }
      return dosDateTimeToDate(this.lastModFileDate, this.lastModFileTime, options2.timezone);
    };
    Entry.prototype.canDecodeFileData = function() {
      return !this.isEncrypted() && (this.compressionMethod === 0 || this.compressionMethod === 8);
    };
    Entry.prototype.isEncrypted = function() {
      return (this.generalPurposeBitFlag & 1) !== 0;
    };
    Entry.prototype.isCompressed = function() {
      return this.compressionMethod === 8;
    };
    function LocalFileHeader() {
    }
    function dosDateTimeToDate(date, time, timezone) {
      var day = date & 31;
      var month = (date >> 5 & 15) - 1;
      var year = (date >> 9 & 127) + 1980;
      var millisecond = 0;
      var second = (time & 31) * 2;
      var minute = time >> 5 & 63;
      var hour = time >> 11 & 31;
      if (timezone == null || timezone === "local") {
        return new Date(year, month, day, hour, minute, second, millisecond);
      } else if (timezone === "UTC") {
        return new Date(Date.UTC(year, month, day, hour, minute, second, millisecond));
      } else {
        throw new Error("unrecognized options.timezone: " + options.timezone);
      }
    }
    function getFileNameLowLevel(generalPurposeBitFlag, fileNameBuffer, extraFields, strictFileNames) {
      var fileName = null;
      for (var i = 0; i < extraFields.length; i++) {
        var extraField = extraFields[i];
        if (extraField.id === 28789) {
          if (extraField.data.length < 6) {
            continue;
          }
          if (extraField.data.readUInt8(0) !== 1) {
            continue;
          }
          var oldNameCrc32 = extraField.data.readUInt32LE(1);
          if (crc32(fileNameBuffer) !== oldNameCrc32) {
            continue;
          }
          fileName = decodeBuffer(extraField.data.subarray(5), true);
          break;
        }
      }
      if (fileName == null) {
        var isUtf8 = (generalPurposeBitFlag & 2048) !== 0;
        fileName = decodeBuffer(fileNameBuffer, isUtf8);
      }
      if (!strictFileNames) {
        fileName = fileName.replace(/\\/g, "/");
      }
      return fileName;
    }
    function validateFileName(fileName) {
      if (fileName.indexOf("\\") !== -1) {
        return "invalid characters in fileName: " + fileName;
      }
      if (/^[a-zA-Z]:/.test(fileName) || /^\//.test(fileName)) {
        return "absolute path: " + fileName;
      }
      if (fileName.split("/").indexOf("..") !== -1) {
        return "invalid relative path: " + fileName;
      }
      return null;
    }
    function parseExtraFields(extraFieldBuffer) {
      var extraFields = [];
      var i = 0;
      while (i < extraFieldBuffer.length - 3) {
        var headerId = extraFieldBuffer.readUInt16LE(i + 0);
        var dataSize = extraFieldBuffer.readUInt16LE(i + 2);
        var dataStart = i + 4;
        var dataEnd = dataStart + dataSize;
        if (dataEnd > extraFieldBuffer.length) throw new Error("extra field length exceeds extra field buffer size");
        var dataBuffer = extraFieldBuffer.subarray(dataStart, dataEnd);
        extraFields.push({
          id: headerId,
          data: dataBuffer
        });
        i = dataEnd;
      }
      return extraFields;
    }
    function readAndAssertNoEof(reader, buffer, offset, length, position, callback) {
      if (length === 0) {
        return setImmediate(function() {
          callback(null, newBuffer(0));
        });
      }
      reader.read(buffer, offset, length, position, function(err, bytesRead) {
        if (err) return callback(err);
        if (bytesRead < length) {
          return callback(new Error("unexpected EOF"));
        }
        callback();
      });
    }
    util.inherits(AssertByteCountStream, Transform);
    function AssertByteCountStream(byteCount) {
      Transform.call(this);
      this.actualByteCount = 0;
      this.expectedByteCount = byteCount;
    }
    AssertByteCountStream.prototype._transform = function(chunk, encoding, cb) {
      this.actualByteCount += chunk.length;
      if (this.actualByteCount > this.expectedByteCount) {
        var msg = "too many bytes in the stream. expected " + this.expectedByteCount + ". got at least " + this.actualByteCount;
        return cb(new Error(msg));
      }
      cb(null, chunk);
    };
    AssertByteCountStream.prototype._flush = function(cb) {
      if (this.actualByteCount < this.expectedByteCount) {
        var msg = "not enough bytes in the stream. expected " + this.expectedByteCount + ". got only " + this.actualByteCount;
        return cb(new Error(msg));
      }
      cb();
    };
    util.inherits(RandomAccessReader, EventEmitter);
    function RandomAccessReader() {
      EventEmitter.call(this);
      this.refCount = 0;
    }
    RandomAccessReader.prototype.ref = function() {
      this.refCount += 1;
    };
    RandomAccessReader.prototype.unref = function() {
      var self = this;
      self.refCount -= 1;
      if (self.refCount > 0) return;
      if (self.refCount < 0) throw new Error("invalid unref");
      self.close(onCloseDone);
      function onCloseDone(err) {
        if (err) return self.emit("error", err);
        self.emit("close");
      }
    };
    RandomAccessReader.prototype.createReadStream = function(options2) {
      if (options2 == null) options2 = {};
      var start = options2.start;
      var end = options2.end;
      if (start === end) {
        var emptyStream = new PassThrough();
        setImmediate(function() {
          emptyStream.end();
        });
        return emptyStream;
      }
      var stream = this._readStreamForRange(start, end);
      var destroyed = false;
      var refUnrefFilter = new RefUnrefFilter(this);
      stream.on("error", function(err) {
        setImmediate(function() {
          if (!destroyed) refUnrefFilter.emit("error", err);
        });
      });
      installDestroyFn(refUnrefFilter, function() {
        stream.unpipe(refUnrefFilter);
        refUnrefFilter.unref();
        stream.destroy();
      });
      var byteCounter = new AssertByteCountStream(end - start);
      refUnrefFilter.on("error", function(err) {
        setImmediate(function() {
          if (!destroyed) byteCounter.emit("error", err);
        });
      });
      installDestroyFn(byteCounter, function() {
        destroyed = true;
        refUnrefFilter.unpipe(byteCounter);
        refUnrefFilter.destroy();
      });
      return stream.pipe(refUnrefFilter).pipe(byteCounter);
    };
    RandomAccessReader.prototype._readStreamForRange = function(start, end) {
      throw new Error("not implemented");
    };
    RandomAccessReader.prototype.read = function(buffer, offset, length, position, callback) {
      var readStream = this.createReadStream({ start: position, end: position + length });
      var writeStream = new Writable();
      var written = 0;
      writeStream._write = function(chunk, encoding, cb) {
        chunk.copy(buffer, offset + written, 0, chunk.length);
        written += chunk.length;
        cb();
      };
      writeStream.on("finish", callback);
      readStream.on("error", function(error) {
        callback(error);
      });
      readStream.pipe(writeStream);
    };
    RandomAccessReader.prototype.close = function(callback) {
      setImmediate(callback);
    };
    util.inherits(RefUnrefFilter, PassThrough);
    function RefUnrefFilter(context) {
      PassThrough.call(this);
      this.context = context;
      this.context.ref();
      this.unreffedYet = false;
    }
    RefUnrefFilter.prototype._flush = function(cb) {
      this.unref();
      cb();
    };
    RefUnrefFilter.prototype.unref = function(cb) {
      if (this.unreffedYet) return;
      this.unreffedYet = true;
      this.context.unref();
    };
    var cp437 = "\0\u263A\u263B\u2665\u2666\u2663\u2660\u2022\u25D8\u25CB\u25D9\u2642\u2640\u266A\u266B\u263C\u25BA\u25C4\u2195\u203C\xB6\xA7\u25AC\u21A8\u2191\u2193\u2192\u2190\u221F\u2194\u25B2\u25BC !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u2302\xC7\xFC\xE9\xE2\xE4\xE0\xE5\xE7\xEA\xEB\xE8\xEF\xEE\xEC\xC4\xC5\xC9\xE6\xC6\xF4\xF6\xF2\xFB\xF9\xFF\xD6\xDC\xA2\xA3\xA5\u20A7\u0192\xE1\xED\xF3\xFA\xF1\xD1\xAA\xBA\xBF\u2310\xAC\xBD\xBC\xA1\xAB\xBB\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255D\u255C\u255B\u2510\u2514\u2534\u252C\u251C\u2500\u253C\u255E\u255F\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256B\u256A\u2518\u250C\u2588\u2584\u258C\u2590\u2580\u03B1\xDF\u0393\u03C0\u03A3\u03C3\xB5\u03C4\u03A6\u0398\u03A9\u03B4\u221E\u03C6\u03B5\u2229\u2261\xB1\u2265\u2264\u2320\u2321\xF7\u2248\xB0\u2219\xB7\u221A\u207F\xB2\u25A0\xA0";
    function decodeBuffer(buffer, isUtf8) {
      if (isUtf8) {
        return buffer.toString("utf8");
      } else {
        var result = "";
        for (var i = 0; i < buffer.length; i++) {
          result += cp437[buffer[i]];
        }
        return result;
      }
    }
    function readUInt64LE(buffer, offset) {
      var lower32 = buffer.readUInt32LE(offset);
      var upper32 = buffer.readUInt32LE(offset + 4);
      return upper32 * 4294967296 + lower32;
    }
    var newBuffer;
    if (typeof Buffer.allocUnsafe === "function") {
      newBuffer = function(len) {
        return Buffer.allocUnsafe(len);
      };
    } else {
      newBuffer = function(len) {
        return new Buffer(len);
      };
    }
    function installDestroyFn(stream, fn) {
      if (typeof stream.destroy === "function") {
        stream._destroy = function(err, cb) {
          fn();
          if (cb != null) cb(err);
        };
      } else {
        stream.destroy = fn;
      }
    }
    function defaultCallback(err) {
      if (err) throw err;
    }
  }
});

// packages/installer/src/toolchain.ts
import path16 from "node:path";
import { mkdir as mkdir8, mkdtemp as mkdtemp4, readdir as readdir4, readlink, rename as rename4, rm as rm8, chmod as chmod3, statfs, realpath as realpath6 } from "node:fs/promises";

// packages/core/src/project.ts
import path12 from "node:path";
import { cp as cp4, mkdir as mkdir5, lstat as lstat3, readdir as readdir3, writeFile, mkdtemp as mkdtemp2, rm as rm6, rename as rename3 } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// packages/core/src/oracle.ts
var oracle_exports = {};
__export(oracle_exports, {
  OracleAdapter: () => OracleAdapter,
  SCRIPT_RESTRICT_LEVEL: () => SCRIPT_RESTRICT_LEVEL,
  compilerDetails: () => compilerDetails,
  compilerFault: () => compilerFault,
  compilerSucceeded: () => compilerSucceeded,
  diagnosticHint: () => diagnosticHint,
  installSources: () => installSources,
  jsonDocuments: () => jsonDocuments,
  oracleDiagnostics: () => oracleDiagnostics,
  parseCompilerDiagnostics: () => parseCompilerDiagnostics,
  resetCapabilityCache: () => resetCapabilityCache,
  sqlLiteral: () => sqlLiteral,
  sqlclToken: () => sqlclToken
});
import path11 from "node:path";
import { randomUUID } from "node:crypto";
import { cp as cp3, mkdir as mkdir4, mkdtemp, readFile as readFile5, readdir as readdir2, realpath as realpath4, rename as rename2, rm as rm5, stat as stat3 } from "node:fs/promises";

// packages/core/src/connections.ts
import path2 from "node:path";
import { chmod, constants as constants2, lstat, mkdir, open as open2, rm, stat } from "node:fs/promises";

// packages/core/src/local-env.ts
import path from "node:path";
import { constants, open, realpath } from "node:fs/promises";

// packages/core/src/process.ts
import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
async function runProcess(r) {
  if (r.signal?.aborted)
    return { code: null, stdout: "", stderr: "", timedOut: false, cancelled: true, truncated: false };
  return new Promise((resolve, reject) => {
    const child = spawn(r.executable, r.args, {
      cwd: r.cwd,
      env: r.env ?? process.env,
      shell: false,
      stdio: "pipe",
      windowsHide: true
    });
    let stdout = "", stderr = "", bytes = 0, timedOut = false, cancelled = false, truncated = false;
    const decoders = [new StringDecoder("utf8"), new StringDecoder("utf8")];
    const max = r.maxBytes ?? 1024 * 1024;
    const stop = () => {
      child.kill("SIGTERM");
      const hard = setTimeout(() => child.kill("SIGKILL"), 1500);
      hard.unref();
    };
    const collect = (isError) => (data) => {
      const room = Math.max(0, max - bytes);
      bytes += data.length;
      const s3 = decoders[isError ? 1 : 0].write(data.subarray(0, room));
      if (isError) stderr += s3;
      else stdout += s3;
      if (bytes > max) {
        truncated = true;
        stop();
      }
    };
    child.stdout.on("data", collect(false));
    child.stderr.on("data", collect(true));
    child.stdin.on("error", () => {
    });
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, r.timeoutMs ?? 3e4);
    const abort = () => {
      cancelled = true;
      stop();
    };
    r.signal?.addEventListener("abort", abort, { once: true });
    if (r.signal?.aborted) abort();
    child.on("error", (e) => {
      clearTimeout(timer);
      r.signal?.removeEventListener("abort", abort);
      reject(new Fault("DEPENDENCY_MISSING", e.message, 3, "dependency_missing"));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      r.signal?.removeEventListener("abort", abort);
      resolve({
        code,
        stdout: stdout + (truncated ? "" : decoders[0].end()),
        stderr: redact(stderr + (truncated ? "" : decoders[1].end())),
        timedOut,
        cancelled,
        truncated
      });
    });
    child.stdin.end(r.input ?? "");
  });
}

// packages/core/src/local-env.ts
function parseLocalEnv(contents) {
  const result = /* @__PURE__ */ Object.create(null);
  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line.trim());
    if (!match || Object.hasOwn(result, match[1]))
      throw new Fault("ENV_FILE_INVALID", "The local ENV file has an invalid or duplicate entry.", 2);
    let value = match[2];
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0], end = value.lastIndexOf(quote);
      if (end === 0 || !/^\s*(?:#.*)?$/.test(value.slice(end + 1)))
        throw new Fault("ENV_FILE_INVALID", "The local ENV file has an invalid quoted entry.", 2);
      value = value.slice(1, end);
    } else value = value.replace(/\s+#.*$/, "").trimEnd();
    result[match[1]] = value;
  }
  return result;
}
async function readLocalEnv(file) {
  const requested = path.resolve(file), physical = await realpath(requested);
  if (requested !== physical)
    throw new Fault("ENV_FILE_UNSAFE", "Credential ENV paths cannot use symlink aliases.", 2);
  const cwd = path.dirname(physical);
  const root = await runProcess({
    executable: "git",
    args: ["rev-parse", "--show-toplevel"],
    cwd,
    timeoutMs: 5e3
  });
  if (root.code !== 0)
    throw new Fault("ENV_FILE_UNSAFE", "Credential ENV files must belong to a Git working tree.", 2);
  const relative = path.relative(root.stdout.trim(), physical);
  const tracked = await runProcess({
    executable: "git",
    args: ["ls-files", "--error-unmatch", "--", relative],
    cwd: root.stdout.trim(),
    timeoutMs: 5e3
  });
  const ignored = await runProcess({
    executable: "git",
    args: ["check-ignore", "-q", "--", relative],
    cwd: root.stdout.trim(),
    timeoutMs: 5e3
  });
  if (tracked.code === 0 || ignored.code !== 0)
    throw new Fault(
      "ENV_FILE_UNSAFE",
      "Credential ENV files must be ignored by Git and absent from tracked files.",
      2
    );
  const handle = await open(physical, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 65536 || typeof process.getuid === "function" && info.uid !== process.getuid())
      throw new Fault(
        "ENV_FILE_UNSAFE",
        "Credential ENV files must be bounded regular files owned by the current user.",
        2
      );
    return parseLocalEnv(await handle.readFile("utf8"));
  } finally {
    await handle.close();
  }
}

// packages/core/src/connections.ts
var savedConnectionName = external_exports.string().min(1).max(512).regex(/^[^\x00-\x1f\x7f-\x9f]+$/);
var ordsUrl = external_exports.string().url().max(2048).refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && // Plaintext HTTP would expose the ORDS password; allow it for loopback only.
  (url.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) && !url.username && !url.password && !url.search && !url.hash && url.pathname.endsWith("/") && !url.pathname.replace(/\/+$/, "").endsWith("/_/sql") && !/[\s"\x00-\x1f]/.test(value);
}, "Use the ORDS schema HTTPS URL ending in / (HTTP only for localhost), without credentials, query or fragment.");
var ordsUsername = external_exports.string().min(1).max(128).regex(/^[^"\x00-\x1f\x7f-\x9f]+$/);
var ordsSchema = external_exports.strictObject({ url: ordsUrl, username: ordsUsername });
var connectionSchema = external_exports.strictObject({
  kind: external_exports.literal("sqlcl-store"),
  name: savedConnectionName.optional(),
  ords: ordsSchema.optional()
}).refine((value) => !!(value.name || value.ords), "Configure a direct connection or ORDS endpoint.");
var storeSchema = external_exports.record(refName, connectionSchema);
var references = /* @__PURE__ */ new WeakMap();
var connectionReference = (connection) => references.get(connection);
var credentialSchema = ordsSchema.extend({ password: external_exports.string().min(1).max(4096) }).strict();
function checkPassword(password) {
  if (!password || password.length > 4096 || /["\x00-\x1f\x7f-\x9f]/.test(password))
    throw new Fault(
      "INVALID_ORDS_PASSWORD",
      "ORDS passwords must be nonempty and cannot contain control characters or double quotes.",
      2
    );
  return password;
}
async function credentialPath(name) {
  parse(refName, name);
  return contained(managedHome(), path2.join("credentials", name + ".json"));
}
async function ordsCredentials(connection) {
  const name = references.get(connection);
  if (!name || !connection.ords)
    throw new Fault(
      "ORDS_CONNECTION_REQUIRED",
      "Configure this connection reference with a plugin-level ORDS endpoint and credentials.",
      3,
      "blocked"
    );
  const file = await credentialPath(name);
  if (!await exists(file))
    throw new Fault(
      "ORDS_CREDENTIALS_REQUIRED",
      "Save the ORDS password locally in plugin connection settings.",
      3,
      "blocked"
    );
  if (process.platform !== "win32" && ((await stat(file)).mode & 63) !== 0)
    throw new Fault(
      "ORDS_CREDENTIAL_PERMISSIONS",
      "ORDS credential files must only be readable by their owner (0600).",
      3,
      "blocked"
    );
  let value;
  try {
    value = parse(credentialSchema, await readJson(file));
  } catch {
    throw new Fault(
      "ORDS_CREDENTIALS_INVALID",
      "The local ORDS credential file is invalid. Save it again in plugin settings.",
      3,
      "blocked"
    );
  }
  if (value.url !== connection.ords.url || value.username !== connection.ords.username)
    throw new Fault(
      "ORDS_CREDENTIALS_REQUIRED",
      "Save credentials for the configured ORDS endpoint and username.",
      3,
      "blocked"
    );
  checkPassword(value.password);
  return value;
}
async function connections() {
  const file = path2.join(managedHome(), "connections.json");
  return await exists(file) ? parse(storeSchema, await readJson(file)) : {};
}
async function resolveConnection(name) {
  const connection = (await connections())[name];
  if (!connection)
    throw new Fault(
      "CONNECTION_REQUIRED",
      "Configure the requested SQLcl connection reference locally; do not send credentials in chat.",
      3,
      "blocked"
    );
  references.set(connection, name);
  return connection;
}
async function editConnection(name, value) {
  parse(refName, name);
  return withLock(path2.join(managedHome(), "connections.lock"), async () => {
    const current = await connections();
    let credentialsDeleted = false;
    if (value) current[name] = parse(connectionSchema, { ...current[name], ...value });
    else {
      delete current[name];
      const file = await credentialPath(name);
      credentialsDeleted = await exists(file);
      await rm(file, { force: true });
    }
    await writeJson(path2.join(managedHome(), "connections.json"), current);
    return { name, status: value ? "configured" : "removed", credentialsDeleted };
  });
}
async function readPasswordFile(file) {
  let handle;
  let before;
  try {
    before = await lstat(file);
    if (before.isSymbolicLink() || !before.isFile())
      throw new Fault("PASSWORD_FILE_UNSAFE", "The password file must be a regular non-symlink file.", 2);
    handle = await open2(file, constants2.O_RDONLY | (constants2.O_NOFOLLOW ?? 0));
  } catch (error) {
    if (error instanceof Fault) throw error;
    const code = error.code;
    throw new Fault(
      "PASSWORD_FILE_UNSAFE",
      code === "ELOOP" || code === "EMLINK" ? "The password file must not be a symbolic link." : "The password file cannot be opened.",
      2
    );
  }
  try {
    const info = await handle.stat();
    const current = await lstat(file);
    if (!info.isFile() || !current.isFile() || current.isSymbolicLink() || before.dev !== info.dev || before.ino !== info.ino || current.dev !== info.dev || current.ino !== info.ino)
      throw new Fault("PASSWORD_FILE_UNSAFE", "The password file changed or is not a regular file.", 2);
    if (process.platform !== "win32" && (info.mode & 63) !== 0)
      throw new Fault(
        "PASSWORD_FILE_UNSAFE",
        "The password file must only be accessible by its owner (chmod 600).",
        2
      );
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}
async function configureConnection(name, input) {
  parse(refName, name);
  if (input.envFile) {
    if (input.password !== void 0 || input.passwordFile)
      throw new Fault("INVALID_INPUT", "Select one local credential source.", 2);
    const values = await readLocalEnv(input.envFile);
    const password = values[input.passwordKey ?? "ORDS_PASSWORD"];
    const username = values[input.usernameKey ?? "ORDS_USERNAME"];
    const url = values[input.urlKey ?? "ORDS_URL"];
    if (!password || !(input.ordsUsername ?? username) || !(input.ordsUrl ?? url))
      throw new Fault("ENV_CREDENTIALS_MISSING", "The selected local ENV credential keys are missing.", 2);
    input = {
      ...input,
      password,
      ordsUsername: input.ordsUsername ?? username,
      ordsUrl: input.ordsUrl ?? url
    };
  }
  return withLock(path2.join(managedHome(), "connections.lock"), async () => {
    const current = await connections();
    const previous = current[name];
    const ords = input.ordsUrl || input.ordsUsername ? parse(ordsSchema, { url: input.ordsUrl, username: input.ordsUsername }) : previous?.ords;
    const value = parse(connectionSchema, {
      ...previous,
      kind: "sqlcl-store",
      ...input.sqlclName ? { name: input.sqlclName } : {},
      ...ords ? { ords } : {}
    });
    let password = input.password;
    if (input.passwordFile) {
      if (password !== void 0) throw new Fault("INVALID_INPUT", "Supply one local password source.", 2);
      password = (await readPasswordFile(path2.resolve(input.passwordFile))).replace(/\r?\n$/, "");
    }
    if (password !== void 0 && !ords)
      throw new Fault(
        "INVALID_INPUT",
        "Configure the ORDS endpoint and username before saving its password.",
        2
      );
    if (ords && (input.ordsUrl || input.ordsUsername || password !== void 0)) {
      if (password !== void 0) {
        const folder = await contained(managedHome(), "credentials");
        await mkdir(folder, { recursive: true, mode: 448 });
        if (process.platform !== "win32") await chmod(folder, 448);
        await writeJson(await credentialPath(name), { ...ords, password: checkPassword(password) });
      } else {
        references.set(value, name);
        await ordsCredentials(value);
      }
    }
    current[name] = value;
    await writeJson(path2.join(managedHome(), "connections.json"), current);
    return { name, status: "configured" };
  });
}

// packages/core/src/sqlcl-config.ts
import path3 from "node:path";
var sqlclMode = external_exports.enum(["cli", "mcp"]);
var sqlclRestriction = external_exports.enum(["4", "1"]);
var databaseTransport = external_exports.enum(["direct", "ords"]);
var sqlclConfigSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  mode: sqlclMode,
  mcpRestrictLevel: sqlclRestriction,
  databaseTransport: databaseTransport.optional()
});
async function sqlclConfig() {
  const home = managedHome();
  if (!await exists(home)) return { schemaVersion: 1, mode: "cli", mcpRestrictLevel: "4" };
  const file = await contained(home, "sqlcl.json");
  return await exists(file) ? parse(sqlclConfigSchema, await readJson(file)) : { schemaVersion: 1, mode: "cli", mcpRestrictLevel: "4" };
}
async function configureSqlcl(mode, level, transport) {
  const home = managedHome();
  return withLock(path3.join(home, "sqlcl-config.lock"), async () => {
    const previous = await sqlclConfig();
    const configuration = parse(sqlclConfigSchema, {
      ...previous,
      mode,
      mcpRestrictLevel: level ?? previous.mcpRestrictLevel,
      ...transport ? { databaseTransport: transport } : {}
    });
    if (configuration.mode === "mcp" && configuration.databaseTransport === "ords")
      throw new Fault(
        "ORDS_CLI_REQUIRED",
        "ORDS HTTP requires SQLcl CLI mode. Select CLI execution for this transport.",
        3,
        "blocked"
      );
    await writeJson(await contained(home, "sqlcl.json"), configuration);
    return configuration;
  });
}

// packages/core/src/ords.ts
import path4 from "node:path";
import { realpath as realpath2, rm as rm2 } from "node:fs/promises";
async function sqlclHome(executable) {
  const candidates = path4.isAbsolute(executable) ? [executable] : executable.includes(path4.sep) ? [path4.resolve(executable)] : (process.env.PATH ?? "").split(path4.delimiter).flatMap(
    (directory) => process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"].map((extension) => path4.join(directory, executable + extension)) : [path4.join(directory, executable)]
  );
  for (const candidate of candidates) {
    if (!await exists(candidate)) continue;
    const home = path4.dirname(path4.dirname(await realpath2(candidate)));
    if (await exists(path4.join(home, "lib", "jdbcrest.jar"))) return home;
    break;
  }
  throw new Fault(
    "ORDS_SQLCL_LIBRARIES_REQUIRED",
    "ORDS APEX operations require the selected SQLcl installation with lib/jdbcrest.jar and the Oracle APEXlang compiler. Set APEXREST_SQLCL to its bin/sql executable.",
    3,
    "blocked"
  );
}
async function resolveOrdsJava(javaHome, stage, env, signal, runner = runProcess) {
  const executableName = process.platform === "win32" ? "java.exe" : "java";
  const candidates = [
    ...[javaHome, process.env.JAVA_HOME].filter((home) => !!home).map((home) => ({ executable: path4.join(home, "bin", executableName), javaHome: home })),
    { executable: executableName, javaHome: void 0 }
  ];
  const attempted = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    if (attempted.has(candidate.executable)) continue;
    attempted.add(candidate.executable);
    if (signal?.aborted) throw new Fault("CANCELLED", "ORDS operation cancelled.", 6, "cancelled");
    try {
      const result = await runner({
        executable: candidate.executable,
        args: ["--list-modules"],
        cwd: stage,
        env: { ...env, JAVA_HOME: candidate.javaHome },
        timeoutMs: 1e4,
        ...signal ? { signal } : {}
      });
      if (result.cancelled || signal?.aborted)
        throw new Fault("CANCELLED", "ORDS operation cancelled.", 6, "cancelled");
      const major = Number(result.stdout.match(/^java\.base@(\d+)/m)?.[1] ?? 0);
      if (result.code === 0 && !result.timedOut && !result.truncated && major >= 21 && /^jdk\.compiler@/m.test(result.stdout))
        return candidate;
    } catch (error) {
      if (!(error instanceof Fault) || error.code !== "DEPENDENCY_MISSING") throw error;
    }
  }
  throw new Fault(
    "ORDS_JDK_REQUIRED",
    "ORDS APEX operations need an installed JDK 21 or newer with jdk.compiler. The configured Java runtime and JAVA_HOME/PATH do not provide one. Set APEXREST_JAVA_HOME or JAVA_HOME to an existing JDK; ordinary SQLcl can continue using its managed JRE.",
    3,
    "blocked"
  );
}
async function runOrdsBridge(settings, job, credentials, stage, signal, runner = runProcess) {
  if (signal?.aborted) throw new Fault("CANCELLED", "ORDS operation cancelled.", 6, "cancelled");
  const home = await sqlclHome(settings.executable);
  const helper = path4.join(resourceRoot(), "ords", "OrdsBridge.java");
  if (!await exists(helper))
    throw new Fault("ORDS_HELPER_REQUIRED", "The installed plugin is missing its ORDS helper.", 3, "blocked");
  const jobFile = path4.join(stage, "ords-job.json");
  const output = path4.join(stage, "ords-result.json");
  await rm2(output, { force: true });
  await writeJson(jobFile, { ...job, output });
  const env = { ...process.env, JAVA_HOME: settings.javaHome };
  delete env.NODE_OPTIONS;
  delete env.JAVA_TOOL_OPTIONS;
  delete env._JAVA_OPTIONS;
  delete env.JDK_JAVA_OPTIONS;
  const java = await resolveOrdsJava(settings.javaHome, stage, env, signal, runner);
  env.JAVA_HOME = java.javaHome;
  const processResult = await runner({
    executable: java.executable,
    args: [
      "-cp",
      [path4.join(home, "lib", "*"), path4.join(home, "lib", "ext", "*")].join(path4.delimiter),
      helper,
      jobFile
    ],
    cwd: stage,
    env,
    input: credentials ? JSON.stringify(credentials) : "",
    timeoutMs: 18e4,
    ...signal ? { signal } : {}
  });
  const mutation = job.operation === "import" || job.operation === "script";
  if (processResult.timedOut || processResult.cancelled || processResult.truncated)
    throw new Fault(
      processResult.truncated ? "OUTPUT_LIMIT" : processResult.cancelled ? "CANCELLED" : "TIMEOUT",
      "The ORDS helper did not confirm completion. Reconcile any import before retrying.",
      6,
      mutation ? "outcome_unknown" : "cancelled"
    );
  let result;
  if (await exists(output)) {
    try {
      const value = await readJson(output);
      if (value && value.operation === job.operation && ["succeeded", "failed"].includes(value.status))
        result = value;
    } catch {
    }
  }
  if (processResult.code !== 0 || result?.status !== "succeeded" || !processResult.stdout.split(/\r?\n/).some((line) => line.trim() === "APEXREST_ORDS_COMPLETE")) {
    const unknown = mutation && (!result || result.writeStarted === true);
    throw new Fault(
      unknown ? "ORDS_OUTCOME_UNKNOWN" : result?.code ?? "ORDS_BRIDGE_FAILED",
      unknown ? "ORDS import did not confirm a complete outcome; reconcile the target before retrying." : "The Oracle ORDS helper failed. Check the SQLcl/Java prerequisites, ORDS authentication and schema privileges.",
      unknown ? 6 : 1,
      unknown ? "outcome_unknown" : "failed"
    );
  }
  return result;
}

// packages/core/src/compatibility.ts
import path5 from "node:path";
import { readFile } from "node:fs/promises";
var APEX_262_PROFILE = {
  id: "apex262-sqlcl263-mmd3479",
  apex: "26.2",
  sqlcl: "26.3.0.260.1620",
  mmd: "26.2.0+3479",
  qualification: "partial-local"
};
function databaseMeetsApex262Minimum(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\.|$)/.exec(version);
  if (!match) return false;
  const major = Number(match[1]), minor = Number(match[2]);
  if (major === 23) return minor >= 26;
  return major > 19 || major === 19 && minor >= 18;
}
async function sourceMmdVersion(source) {
  try {
    const value = JSON.parse(await readFile(path5.join(source, ".apex/apexlang.json"), "utf8"));
    const version = value?.mmdVersion;
    return typeof version === "string" && /^\d+\.\d+\.\d+\+\d+$/.test(version) ? version : null;
  } catch {
    return null;
  }
}
function evaluatePartialImportCompatibility(input) {
  const reasons = [];
  if (input.mode !== "cli" || input.databaseTransport !== "direct")
    reasons.push("Partial import requires direct SQLcl CLI transport.");
  if (!input.importFiles) reasons.push("The selected SQLcl import help does not advertise -files.");
  if (!input.compilerVersion.includes(APEX_262_PROFILE.sqlcl))
    reasons.push("The SQLcl build is outside the reviewed partial-import profile.");
  if (input.mmdVersion !== APEX_262_PROFILE.mmd)
    reasons.push("Source MMD is outside the reviewed APEX 26.2 profile.");
  if (!/^26\.2(?:\.|$)/.test(input.apexVersion))
    reasons.push("The target APEX release is outside the reviewed 26.2 profile.");
  if (!databaseMeetsApex262Minimum(input.databaseVersion))
    reasons.push("Target database release is unconfirmed or below the APEX 26.2 minimum.");
  return { ...input, supported: reasons.length === 0, reasons };
}

// packages/core/src/upgrade-audit.ts
import path6 from "node:path";
import { readFile as readFile2, stat as stat2, opendir } from "node:fs/promises";
function parseCodeScan(output, source) {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, "");
  const from = clean.indexOf("["), to2 = clean.lastIndexOf("]");
  if (from < 0 || to2 < from) throw new Error("CodeScan did not return its JSON report.");
  const report = JSON.parse(clean.slice(from, to2 + 1));
  if (!Array.isArray(report)) throw new Error("CodeScan report is not a list.");
  const findings = [];
  for (const entry of report) {
    if (!entry || typeof entry.file !== "string" || !Array.isArray(entry.issues))
      throw new Error("CodeScan report entry is incomplete.");
    const file = path6.relative(source, path6.resolve(source, entry.file)).replaceAll(path6.sep, "/");
    if (!file || file.startsWith("../") || path6.isAbsolute(file))
      throw new Error("CodeScan returned a file outside the inspected source.");
    for (const issue of entry.issues) {
      if (typeof issue?.ruleNo !== "string" || typeof issue.msg !== "string" || !Number.isInteger(issue.line) || issue.line < 0 || !Number.isInteger(issue.col) || issue.col < 0)
        throw new Error("CodeScan issue is incomplete.");
      findings.push({
        code: issue.ruleNo,
        file,
        line: issue.line,
        column: issue.col,
        message: issue.msg,
        severity: "warning"
      });
    }
  }
  return findings;
}
var upgradeRules = [
  {
    code: "APEX262_AI_TOOL_CALLS",
    pattern: /\btool_calls\b/i,
    message: "Review legacy AI tool_calls handling against the APEX 26.2 response contract."
  },
  {
    code: "APEX262_AI_MESSAGE",
    pattern: /\bt_chat_response\b/i,
    message: "Review APEX_AI t_chat_response and response.message usage against the 26.2 response contract."
  },
  {
    code: "APEX262_ASSSO",
    pattern: /\bASSSO\b/i,
    message: "Review legacy ASSSO authentication against the APEX 26.2 desupport guidance."
  },
  {
    code: "APEX262_REST_RESOURCE",
    pattern: /\bAPEX_REST_RESOURCE\b/i,
    message: "Review legacy APEX_REST_RESOURCE references against APEX 26.2 migration guidance."
  },
  {
    code: "APEX262_ADVISOR",
    pattern: /\b(?:apex_advisor|advisor)\b/i,
    message: "Review Advisor references against the APEX 26.2 Advisor changes; this text match may be unrelated."
  }
];
async function auditUpgradeSource(source) {
  const files = [], directories = [""];
  const findings = [], skipped = [];
  let inspected = 0, traversalTruncated = false;
  discovery: while (directories.length) {
    const relative = directories.pop();
    for await (const entry of await opendir(path6.join(source, relative))) {
      if (++inspected > 1e4) {
        traversalTruncated = true;
        break discovery;
      }
      const file = path6.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) skipped.push(file);
      else if (entry.isDirectory()) directories.push(file);
      else if (entry.isFile() && /\.(?:apx|sql|js)$/i.test(file)) files.push(file);
    }
  }
  files.sort();
  let bytes = 0, scannedFiles = 0;
  for (const file of files) {
    const absolute = path6.join(source, file), size = (await stat2(absolute)).size;
    if (size > 1024 * 1024 || bytes + size > 16 * 1024 * 1024 || scannedFiles >= 2e3) {
      skipped.push(file);
      continue;
    }
    bytes += size;
    scannedFiles++;
    const lines = (await readFile2(absolute, "utf8")).split(/\r?\n/);
    for (const rule of upgradeRules) {
      const at2 = lines.findIndex((line) => rule.pattern.test(line));
      if (at2 >= 0)
        findings.push({ code: rule.code, file, line: at2 + 1, message: rule.message, severity: "warning" });
    }
  }
  return {
    status: "advisory",
    targetRelease: "26.2",
    scannedFiles,
    findings,
    skipped,
    traversalTruncated,
    limitation: "Source text review hints only; not a complete dependency, SQL, security or runtime audit."
  };
}

// packages/core/src/locality.ts
import { hostname } from "node:os";
var loopback = (host) => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host.toLowerCase());
function localConnectionEndpoint(description) {
  const jdbc = /jdbc:oracle:(thin|oci):(?:[^@\r\n]*@)?([^\r\n]*)/i.exec(description);
  if (!jdbc) return { local: false, evidence: "unconfirmed-connection-endpoint" };
  if (jdbc[1].toLowerCase() === "oci" && !jdbc[2].trim())
    return { local: true, evidence: "native-local-transport" };
  const address = jdbc[2].trim();
  const descriptorHosts = [...address.matchAll(/\(host\s*=\s*([^\s)]+)\)/gi)].map((m2) => m2[1]);
  const easy = /^(?:\/\/)?(\[[^\]]+\]|[^/:,?\s]+)(?::\d+)?(?:\/|:)/.exec(address);
  const hosts = descriptorHosts.length ? descriptorHosts : easy ? [easy[1]] : [];
  return {
    local: hosts.length > 0 && hosts.every(loopback),
    evidence: hosts.length && hosts.every(loopback) ? "effective-loopback-endpoint" : "remote-or-unresolved-endpoint"
  };
}
async function localServerHost(serverHost) {
  const host = serverHost.toLowerCase();
  if (loopback(host) || host === hostname().toLowerCase()) return true;
  const engines = [
    "docker",
    "podman",
    ...process.platform === "darwin" ? ["/opt/podman/bin/podman", "/Applications/Docker.app/Contents/Resources/bin/docker"] : []
  ];
  for (const executable of engines) {
    const podman = executable.endsWith("podman");
    try {
      if (podman) {
        if (process.env.CONTAINER_HOST && !process.env.CONTAINER_HOST.startsWith("unix://")) continue;
        if (process.platform !== "linux") {
          const connections2 = await runProcess({
            executable,
            args: ["system", "connection", "list", "--format", "json"],
            cwd: process.cwd(),
            timeoutMs: 5e3
          });
          const entries = JSON.parse(connections2.stdout);
          const active = process.env.CONTAINER_CONNECTION ? entries.find((entry) => entry.Name === process.env.CONTAINER_CONNECTION) : entries.find((entry) => entry.Default);
          if (!active?.URI) continue;
          const endpoint = new URL(active.URI);
          if (!loopback(endpoint.hostname)) continue;
          const machines = await runProcess({
            executable,
            args: ["machine", "list", "--format", "json"],
            cwd: process.cwd(),
            timeoutMs: 5e3
          });
          if (machines.code !== 0 || !JSON.parse(machines.stdout).some(
            (machine) => machine.Running && machine.Port === Number(endpoint.port)
          ))
            continue;
        }
      } else {
        const context = process.env.DOCKER_HOST ?? (await runProcess({
          executable,
          args: ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
          cwd: process.cwd(),
          timeoutMs: 5e3
        })).stdout.trim();
        if (!/^(unix|npipe):\/\//.test(context)) continue;
      }
      const list = await runProcess({ executable, args: ["ps", "-q"], cwd: process.cwd(), timeoutMs: 5e3 });
      const ids = list.stdout.trim().split(/\s+/).filter((id) => /^[a-f0-9]{12,64}$/.test(id));
      if (list.code !== 0 || !ids.length) continue;
      const names = await runProcess({
        executable,
        args: ["inspect", "--format", "{{.Config.Hostname}}", ...ids],
        cwd: process.cwd(),
        timeoutMs: 5e3
      });
      if (names.code === 0 && names.stdout.trim().split(/\s+/).some((name) => name.toLowerCase() === host))
        return true;
    } catch {
    }
  }
  return false;
}

// packages/core/src/partial-import.ts
import path10 from "node:path";
import { cp as cp2, mkdir as mkdir3, rename, rm as rm4 } from "node:fs/promises";

// packages/core/src/sync.ts
import path8 from "node:path";
import { lstat as lstat2, mkdir as mkdir2, readdir, realpath as realpath3, open as open3, cp, chmod as chmod2 } from "node:fs/promises";

// packages/core/src/deployment-control.ts
import path7 from "node:path";
import { hostname as hostname2 } from "node:os";
import { rm as rm3 } from "node:fs/promises";
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
    this.directory = path7.join(managedHome(), "deployment-control", key);
  }
  file(name) {
    return path7.join(this.directory, name);
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
        if (owner.hostname === hostname2()) {
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
        hostname: hostname2(),
        phase: "preparing",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    });
  }
  async assertOwner(runId) {
    const owner = await this.owner();
    if (owner?.runId !== runId || owner.pid !== process.pid || owner.hostname !== hostname2())
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
  async migration(runId, version, checksum, status) {
    await withLock(this.file("control.lock"), async () => {
      await this.assertOwner(runId);
      const history = await this.history(), previous = history.find((row) => row.version === version);
      if (status === "started" ? Boolean(previous) : !previous || previous.run_id !== runId || previous.checksum !== checksum || previous.status !== "started")
        throw new Fault(
          "MIGRATION_HISTORY_CONFLICT",
          "Migration history requires reconciliation; it cannot be replayed or overwritten.",
          5
        );
      const next = history.filter((row) => row.version !== version);
      next.push({ version, checksum, status, run_id: runId });
      await writeJson(
        this.file("history.json"),
        next.sort((a, b2) => a.version.localeCompare(b2.version))
      );
    });
  }
  async release(runId) {
    await withLock(this.file("control.lock"), async () => {
      await this.assertOwner(runId);
      await rm3(this.file("active.json"));
    });
  }
  /** Release only the reconciled run after its worker has stopped. Keep history. */
  async claimReconciled(runId) {
    await withLock(this.file("control.lock"), async () => {
      const owner = await this.owner();
      if (!owner) {
        await writeJson(this.file("active.json"), {
          runId,
          pid: process.pid,
          hostname: hostname2(),
          phase: "preparing",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        return;
      }
      if (owner.runId !== runId || owner.hostname !== hostname2())
        throw new Fault(
          "TARGET_LOCKED",
          "Another runner owns this target; reconciliation cannot clear its ownership.",
          5
        );
      if (owner.pid !== process.pid) {
        let dead = false;
        try {
          process.kill(owner.pid, 0);
        } catch (error) {
          dead = error.code === "ESRCH";
        }
        if (!dead)
          throw new Fault(
            "TARGET_LOCKED",
            "The import worker is still alive; wait for its terminal result.",
            5
          );
      }
      await writeJson(this.file("active.json"), { ...owner, pid: process.pid, phase: "preparing" });
    });
  }
};

// plugins/metadata.json
var metadata_default = {
  name: "apexrest-apex",
  version: "2.0.0",
  description: "Develop, deploy and test Oracle APEX applications from Codex or Claude Code.",
  author: {
    name: "APEXREST",
    url: "https://apexrest-dev.github.io/apexrest/"
  },
  license: "Apache-2.0",
  interface: {
    displayName: "APEXREST for Codex and Claude Code",
    shortDescription: "Oracle APEX development workflows",
    longDescription: "Oracle APEX development, controlled deployment and testing directly in your current Codex or Claude Code session.",
    developerName: "APEXREST",
    websiteURL: "https://apexrest-dev.github.io/apexrest/",
    composerIcon: "./assets/apexrest-icon.svg",
    logo: "./assets/apexrest-logo.svg",
    logoDark: "./assets/apexrest-logo.svg",
    category: "Productivity",
    capabilities: ["Read", "Write"],
    defaultPrompt: [
      "Use $apexrest-work to build or change my Oracle APEX application in this session.",
      "Use $apexrest-setup to check my tools and connection references.",
      "Use $apexrest-safety to explain what blocked my APEX deployment or test."
    ]
  }
};

// packages/core/src/version.ts
var VERSION = metadata_default.version;

// packages/core/src/sync.ts
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
    snapshot: snapshotSchema,
    verifiedFiles: external_exports.array(relativePath).optional()
  }).nullable(),
  recoveryCheckpoint: external_exports.strictObject({ at: external_exports.iso.datetime(), runId: external_exports.uuid(), snapshot: snapshotSchema }).nullable().optional(),
  status: external_exports.enum(["ready", "importing", "verification_failed", "outcome_unknown", "invalidated"]),
  importingRunId: external_exports.uuid().nullable()
});
async function syncPath(ctx, relative) {
  const file = await contained(ctx.root, relative);
  let probe = ctx.root;
  for (const part of path8.relative(ctx.root, file).split(path8.sep).filter(Boolean)) {
    probe = path8.join(probe, part);
    if (await exists(probe)) {
      if ((await lstat2(probe)).isSymbolicLink())
        throw new Fault("SYNC_PATH_UNSAFE", "Working-copy storage rejects symlinks.", 5);
    }
  }
  return file;
}
async function privateCopy(source, destination) {
  await cp(source, destination, { recursive: true });
  async function secure(directory) {
    await chmod2(directory, 448);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Fault("SYNC_PATH_UNSAFE", "Private copies reject symlinks.", 5);
      const file = path8.join(directory, entry.name);
      if (entry.isDirectory()) await secure(file);
      else if (entry.isFile()) await chmod2(file, 384);
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
    throw new Fault("BACKUP_INVALID", "Initial source backup checksum or target verification failed.", 5);
}
function checkpoint(state) {
  return state.recoveryCheckpoint?.snapshot ?? state.lastSuccessfulImport?.snapshot ?? state.baseline;
}
var SyncStore = class {
  constructor(ctx, env, name) {
    this.ctx = ctx;
    this.env = env;
    this.name = name;
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
    for (const entry of await readdir(base, { withFileTypes: true })) {
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
    const active = matches.filter((s3) => s3.status !== "invalidated");
    if (active.length > 1)
      throw new Fault("SYNC_STATE_INVALID", "Multiple active records require reconciliation.", 5);
    const state = active[0] ?? matches[0] ?? null;
    if (state && state.status !== "invalidated" && !allowMappingChange) await this.checkMapping(state);
    return state;
  }
  async checkMapping(state) {
    const { readFile: readFile6 } = await import("node:fs/promises");
    if (state.projectRoot !== await realpath3(this.ctx.root) || state.projectId !== this.ctx.config.projectId || state.environment !== this.name || state.targetDigest !== targetDigest(this.env) || state.sourceDir !== this.ctx.config.application.sourceDir || state.runtimeVersion !== VERSION || state.toolchainDigest !== hash(await readFile6(await contained(this.ctx.root, this.ctx.config.toolchain.lockFile))) || await isProductionTarget(this.env))
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
    const validRunSnapshot = (reference) => {
      const base = ".apexrest/deployments/" + reference.runId + "/";
      if (["snapshot", "server"].some(
        (kind) => reference.snapshot.directory === base + kind + "/" + state.sourceDir
      ))
        return true;
      const relative = reference.snapshot.directory.startsWith(base) ? reference.snapshot.directory.slice(base.length) : "";
      return /^recovery\/\d{10,17}\/application$/.test(relative);
    };
    if (state.baseline.directory !== ".apexrest/sync/" + state.targetDigest + "/baselines/" + state.syncId + "/application" || state.lastSuccessfulImport && !validRunSnapshot(state.lastSuccessfulImport) || state.recoveryCheckpoint && !validRunSnapshot(state.recoveryCheckpoint))
      throw new Fault(
        "SYNC_ARTIFACT_INVALID",
        "Snapshot reference does not match its sync or deployment owner.",
        5
      );
    if (state.status === "ready" && (await new LocalDeploymentControl(this.env).owner())?.phase === "writing")
      throw new Fault("SYNC_BLOCKED", "A writing owner must complete or be reconciled before reuse.", 5);
    await checkSnapshot(this.ctx, state.baseline);
    if (state.lastSuccessfulImport) await checkSnapshot(this.ctx, state.lastSuccessfulImport.snapshot);
    if (state.recoveryCheckpoint) await checkSnapshot(this.ctx, state.recoveryCheckpoint.snapshot);
    await checkSyncBackup(this.ctx, state.backup, state.targetDigest, this.name);
  }
  async write(state) {
    const valid = syncStateSchema.parse(state);
    const file = await this.file(valid.targetDigest);
    await mkdir2(path8.dirname(file), { recursive: true, mode: 448 });
    const journalFile = await syncPath(this.ctx, ".apexrest/sync/" + valid.targetDigest + "/journal.jsonl");
    const journal = await open3(journalFile, "a", 384);
    try {
      await journal.writeFile(
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
      await journal.sync();
    } finally {
      await journal.close();
    }
    await writeJson(file, valid);
    const directory = process.platform !== "win32" ? await open3(path8.dirname(file), "r") : null;
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
        digest: state.lastSuccessfulImport.snapshot.digest,
        verifiedFiles: state.lastSuccessfulImport.verifiedFiles ?? null
      } : null,
      backupId: state.backup.backupId,
      importingRunId: state.importingRunId,
      dirty: canonical(files) !== canonical(checkpoint(state).files),
      blocked: !!blockedReason || !["ready", "invalidated"].includes(state.status),
      blockedReason,
      serverFreshness: "not-checked",
      assumption: "selected-content-conflicts; independent managed homes require external serialization"
    };
  }
};

// packages/core/src/apexlang-equivalence.ts
import path9 from "node:path";
import { readFile as readFile3 } from "node:fs/promises";
var APEXLANG_EQUIVALENCE_POLICY = "apex262-selected-source-v1";
var formattingRule = "structural-whitespace-and-comments";
var defaultRule = "pageItem.selectList.layout.startNewRow:true-default";
var pageDefaultRule = "page.security.pageAccessProtection:argumentsMustHaveChecksum-default";
var regionDefaultRule = "region.layout.startNewRow:true-default";
var chartDefaultRule = "region.chart.type:bar-default";
var orderRule = "explicit-unique-region-and-chart-component-order";
var columnOrderRule = "explicit-unique-report-column-order";
var limit = 8 * 1024 * 1024;
function readStructure(source) {
  if (Buffer.byteLength(source) > limit) throw new Error("Source exceeds the comparison limit.");
  const lines = source.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g)?.filter(Boolean) ?? [];
  const roots = [];
  const stack = [];
  const append = (node) => (stack.at(-1)?.children ?? roots).push(node);
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    const line = raw.replace(/[\r\n]+$/, "");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    if (trimmed.startsWith("/*")) {
      let comment = trimmed;
      while (!comment.includes("*/") && ++index < lines.length) comment += lines[index];
      const end = comment.indexOf("*/");
      if (end < 0 || comment.slice(end + 2).trim()) throw new Error("Unsupported comment boundary.");
      continue;
    }
    if (trimmed.startsWith("```")) {
      if (!/^```[A-Za-z0-9_-]*[ \t]*$/.test(trimmed)) throw new Error("Unsupported fenced literal.");
      let literal = line.replace(/^[ \t]*/, "") + raw.slice(line.length);
      let closed = false;
      while (++index < lines.length) {
        const next = lines[index];
        if (/^[ \t]*```[ \t]*(?:\r\n|\r|\n)?$/.test(next)) {
          literal += next.replace(/^[ \t]*/, "");
          closed = true;
          break;
        }
        literal += next;
      }
      if (!closed) throw new Error("Unclosed fenced literal.");
      append({ kind: "literal", value: literal });
      continue;
    }
    const property = /^[ \t]*([A-Za-z][\w]*):[ \t]*(.*)$/.exec(line);
    if (property) {
      const value = property[2];
      if (value.includes("```") || value.startsWith('"""') || value.startsWith("'''"))
        throw new Error("Unsupported inline or multiline literal.");
      if (value === "{") {
        const node = { kind: "map", name: property[1], key: "", children: [] };
        append(node);
        stack.push(node);
      } else append({ kind: "property", name: property[1], value });
      continue;
    }
    const component = /^([A-Za-z][\w]*)(?:[ \t]+(.*?))?[ \t]*\([ \t]*$/.exec(trimmed);
    if (component) {
      const node = { kind: "component", name: component[1], key: component[2] ?? "", children: [] };
      append(node);
      stack.push(node);
      continue;
    }
    const group = /^([A-Za-z][\w]*)[ \t]*\{[ \t]*$/.exec(trimmed);
    if (group) {
      const node = { kind: "group", name: group[1], key: "", children: [] };
      append(node);
      stack.push(node);
      continue;
    }
    if (trimmed === ")" || trimmed === "}") {
      const node = stack.pop();
      if (!node || trimmed === ")" !== (node.kind === "component"))
        throw new Error("Unbalanced structural boundary.");
      continue;
    }
    throw new Error("Unsupported source form.");
  }
  if (stack.length) throw new Error("Unclosed structural boundary.");
  return roots;
}
function removeQualifiedDefault(nodes, parent) {
  return nodes.map((node) => {
    if (!("children" in node)) return node;
    let children = node.children;
    if (node.kind === "component" && node.name === "pageItem" && parent?.kind === "component" && parent.name === "page") {
      const types = children.filter((child) => child.kind === "property" && child.name === "type");
      const layouts = children.filter((child) => child.kind === "group" && child.name === "layout");
      if (types.length === 1 && types[0].kind === "property" && types[0].value === "selectList" && layouts.length === 1) {
        children = children.map((child) => {
          if (child.kind !== "group" || child.name !== "layout") return child;
          const rows = child.children.filter(
            (entry) => entry.kind === "property" && entry.name === "startNewRow"
          );
          const layouts2 = child.children.filter(
            (entry) => entry.kind === "property" && entry.name === "startNewLayout"
          );
          if (rows.length !== 1 || rows[0].kind !== "property" || rows[0].value !== "true" || layouts2.length > 1 || layouts2.length === 1 && (layouts2[0].kind !== "property" || layouts2[0].value !== "false"))
            return child;
          return { ...child, children: child.children.filter((entry) => entry !== rows[0]) };
        });
      }
    }
    return { ...node, children: removeQualifiedDefault(children, node) };
  });
}
function normalizeExport(nodes, rules, parent) {
  const result = nodes.map((node) => {
    if (!("children" in node)) return node;
    let children = normalizeExport(node.children, rules, node);
    const property = (name) => children.filter((entry) => entry.kind === "property" && entry.name === name);
    const omit = (name, value, rule) => {
      const matches = property(name);
      if (matches.length === 1 && matches[0].kind === "property" && matches[0].value === value) {
        children = children.filter((entry) => entry !== matches[0]);
        rules.add(rule);
      }
    };
    if (node.kind === "group" && node.name === "security" && parent?.name === "page")
      omit("pageAccessProtection", "argumentsMustHaveChecksum", pageDefaultRule);
    if (node.kind === "group" && node.name === "layout" && parent?.kind === "component" && parent.name === "region") {
      const starts = property("startNewLayout");
      if (!starts.length || starts.length === 1 && starts[0].kind === "property" && starts[0].value === "false")
        omit("startNewRow", "true", regionDefaultRule);
    }
    if (node.kind === "group" && node.name === "chart" && parent?.kind === "component" && parent.name === "region" && parent.children.some(
      (entry) => entry.kind === "property" && entry.name === "type" && entry.value === "chart"
    ))
      omit("type", "bar", chartDefaultRule);
    const identities = node.children.filter((entry) => entry.kind !== "literal").map(
      (entry) => entry.kind + ":" + ("name" in entry ? entry.name : "") + ":" + ("key" in entry ? entry.key : "")
    );
    if (new Set(identities).size !== identities.length) throw new Error("Duplicate structural identity.");
    const sortable = children.filter(
      (entry) => entry.kind === "component" && (node.name === "page" && entry.name === "region" || node.name === "region" && node.children.some(
        (child) => child.kind === "property" && child.name === "type" && child.value === "chart"
      ) && ["axis", "series"].includes(entry.name) || node.name === "region" && node.children.some(
        (child) => child.kind === "property" && child.name === "type" && child.value === "classicReport"
      ) && entry.name === "column")
    );
    if (sortable.length > 1) {
      const sequence = (entry) => {
        if (!("children" in entry)) return void 0;
        if (entry.name === "axis") return entry.key === "x" || entry.key === "y" ? entry.key : void 0;
        const group = entry.children.find(
          (child) => child.kind === "group" && child.name === (entry.name === "series" ? "execution" : "layout")
        );
        const value = group && "children" in group ? group.children.find((child) => child.kind === "property" && child.name === "sequence") : void 0;
        return value?.kind === "property" && /^\d+$/.test(value.value) ? entry.name + ":" + value.value : void 0;
      };
      const sequences = sortable.map(sequence);
      if (sequences.every(Boolean) && new Set(sequences).size === sequences.length) {
        const sorted = [...sortable].sort(
          (left, right) => ("name" in left ? left.name : "").localeCompare("name" in right ? right.name : "") || ("key" in left ? left.key : "").localeCompare("key" in right ? right.key : "")
        );
        let index = 0;
        children = children.map((entry) => sortable.includes(entry) ? sorted[index++] : entry);
        rules.add(
          sortable.some((entry) => "name" in entry && entry.name === "column") ? columnOrderRule : orderRule
        );
      }
    }
    return { ...node, children };
  });
  return result.filter(
    (node) => !("children" in node && !node.children.length && node.kind === "group" && (parent?.name === "page" && node.name === "security" || parent?.name === "region" && ["chart", "layout"].includes(node.name)))
  );
}
function compareApexlangSource(expected, actual) {
  if (expected === actual) return { equivalent: true, rules: [] };
  try {
    const left = readStructure(expected), right = readStructure(actual);
    if (canonical(left) === canonical(right)) return { equivalent: true, rules: [formattingRule] };
    if (canonical(removeQualifiedDefault(left)) === canonical(removeQualifiedDefault(right)))
      return { equivalent: true, rules: [formattingRule, defaultRule] };
    const rules = /* @__PURE__ */ new Set();
    if (canonical(left) !== canonical(removeQualifiedDefault(left)) || canonical(right) !== canonical(removeQualifiedDefault(right)))
      rules.add(defaultRule);
    if (canonical(normalizeExport(removeQualifiedDefault(left), rules)) === canonical(normalizeExport(removeQualifiedDefault(right), rules)))
      return { equivalent: true, rules: [formattingRule, ...rules] };
    return {
      equivalent: false,
      rules: [],
      reason: "Source differs beyond the qualified formatting/default rules."
    };
  } catch (error) {
    return {
      equivalent: false,
      rules: [],
      reason: error instanceof Error ? error.message : "Source form is unsupported."
    };
  }
}
async function compareApplicationExports(expectedRoot, actualRoot, expectedFiles, actualFiles, allowedFiles) {
  const allowed = new Set(allowedFiles);
  const result = {
    equivalent: true,
    policy: APEXLANG_EQUIVALENCE_POLICY,
    normalizations: [],
    mismatchedFiles: [],
    mismatches: []
  };
  for (const file of [.../* @__PURE__ */ new Set([...Object.keys(expectedFiles), ...Object.keys(actualFiles)])].sort()) {
    if (expectedFiles[file] === actualFiles[file]) continue;
    let reason = "File bytes differ outside the selected APEXlang normalization scope.";
    if (expectedFiles[file] && actualFiles[file] && allowed.has(file) && path9.posix.extname(file) === ".apx") {
      const [expected, actual] = await Promise.all([
        readFile3(await contained(expectedRoot, file)),
        readFile3(await contained(actualRoot, file))
      ]);
      if (hash(expected) !== expectedFiles[file] || hash(actual) !== actualFiles[file])
        reason = "Source changed during readback comparison.";
      else {
        const decoder = new TextDecoder("utf-8", { fatal: true });
        let comparison;
        try {
          comparison = compareApexlangSource(decoder.decode(expected), decoder.decode(actual));
        } catch {
          comparison = { equivalent: false, rules: [], reason: "Source is not valid UTF-8." };
        }
        if (comparison.equivalent) {
          result.normalizations.push({
            file,
            expectedSha256: expectedFiles[file],
            actualSha256: actualFiles[file],
            rules: comparison.rules
          });
          continue;
        }
        reason = comparison.reason ?? reason;
      }
    }
    result.equivalent = false;
    result.mismatchedFiles.push(file);
    result.mismatches.push({ file, reason });
  }
  return result;
}

// packages/core/src/partial-import.ts
var importSelectionSchema = external_exports.strictObject({
  requestedMode: external_exports.enum(["auto", "full", "files"]),
  resolvedMode: external_exports.enum(["full", "files"]),
  files: external_exports.array(relativePath),
  reasons: external_exports.array(external_exports.string()),
  dependencies: external_exports.array(relativePath),
  before: snapshotSchema.nullable(),
  effective: snapshotSchema.nullable(),
  capabilities: external_exports.record(external_exports.string(), external_exports.unknown()),
  readbackPolicy: external_exports.literal(APEXLANG_EQUIVALENCE_POLICY).optional(),
  exportScope: external_exports.enum(["selected", "full"]).optional()
});
function importOptions(value = {}) {
  const mode = value.importMode ?? "auto";
  if ((value.files?.length ?? 0) > 1e3)
    throw new Fault("INVALID_INPUT", "Select at most 1000 files in one import.", 2);
  if (!["auto", "full", "files"].includes(mode)) throw new Fault("INVALID_INPUT", "Unknown import mode.", 2);
  if (mode === "files" !== !!value.files?.length)
    throw new Fault(
      "INVALID_INPUT",
      "files mode requires a nonempty file list; other modes do not accept files.",
      2
    );
  const files = (value.files ?? []).map((file) => {
    if (!relativePath.safeParse(file).success || /[\\*?\[\]]/.test(file) || /^[A-Za-z]:/.test(file) || file.startsWith("-") || path10.posix.normalize(file) !== file || file === ".")
      throw new Fault(
        "IMPORT_FILE_UNSAFE",
        "Use normalized application-relative file paths without globs.",
        2
      );
    return file;
  });
  if (new Set(files).size !== files.length)
    throw new Fault("IMPORT_FILE_UNSAFE", "Duplicate import files are not allowed.", 2);
  return { importMode: mode, files: files.sort() };
}
async function sourceRelease(root) {
  try {
    const value = await readJson(path10.join(root, ".apex/apexlang.json"));
    return typeof value.mmdVersion === "string" ? value.mmdVersion.match(/^\d+\.\d+/)?.[0] ?? null : null;
  } catch {
    return null;
  }
}
function supportedFile(file) {
  return /^pages\/p\d{5}[-\w]*\.apx$/.test(file) || /^shared-components\/.+\.apx$/.test(file) && !/(?:^|\/)(?:themes?|templates?|plugins?|plug-ins?|static-files|files|authentications?|authorizations?)(?:[/.]|$)/i.test(
    file
  );
}
function scopedExportFile(file) {
  return /^pages\/p\d{5}[-\w]*\.apx$/.test(file);
}
function pickFiles(files, selected) {
  return Object.fromEntries(selected.filter((file) => files[file]).map((file) => [file, files[file]]));
}
async function overlaySelection(source, exported, files, destination) {
  await privateCopy(source, destination);
  const observed = await inventory(exported);
  for (const file of files) {
    const target = await contained(destination, file);
    if (!observed[file]) await rm4(target, { force: true });
    else {
      await mkdir3(path10.dirname(target), { recursive: true, mode: 448 });
      await cp2(await contained(exported, file), target);
    }
  }
  return destination;
}
function changedFiles(before, after) {
  return [.../* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)])].filter((file) => before[file] !== after[file]).sort();
}
function selectImport(base, local, remote, options2) {
  const requested = importOptions(options2);
  const localChanges = changedFiles(base, local);
  const remoteChanges = changedFiles(base, remote);
  const selected = requested.importMode === "files" ? requested.files : localChanges;
  for (const file of selected)
    if (!Object.hasOwn(local, file) && requested.importMode === "files")
      throw new Fault("IMPORT_FILE_MISSING", `Selected file is missing: ${file}`, 2);
  const conflicts = localChanges.filter(
    (file) => remoteChanges.includes(file) && local[file] !== remote[file]
  );
  if (conflicts.length)
    throw new Fault(
      "IMPORT_CONFLICT",
      `Local and server changes overlap; reconcile before planning: ${conflicts.join(", ")}`,
      5,
      "blocked",
      { conflicts }
    );
  const reasons = [];
  if (selected.some((file) => !Object.hasOwn(local, file))) reasons.push("deleted-files-require-full-import");
  if (selected.some((file) => !supportedFile(file))) reasons.push("unsupported-component-files");
  const files = selected.filter((file) => local[file] !== remote[file]);
  if (!files.length) reasons.push("no-changed-files");
  const effective = { ...remote };
  for (const file of files) {
    if (local[file]) effective[file] = local[file];
    else delete effective[file];
  }
  return { files, reasons, remoteChanges, effective: Object.fromEntries(Object.entries(effective).sort()) };
}
async function persistSnapshot(ctx, source, directory) {
  const destination = await syncPath(ctx, directory);
  await mkdir3(path10.dirname(destination), { recursive: true, mode: 448 });
  await privateCopy(source, destination);
  const files = await inventory(destination);
  return { directory, files, digest: hash(canonical(files)) };
}
async function stageSelection(ctx, before, localRoot, files, expected, directory) {
  const root = await syncPath(ctx, directory);
  await mkdir3(path10.dirname(root), { recursive: true, mode: 448 });
  await privateCopy(await syncPath(ctx, before.directory), root);
  for (const file of files) {
    const destination = await contained(root, file);
    await mkdir3(path10.dirname(destination), { recursive: true, mode: 448 });
    await cp2(await contained(localRoot, file), destination);
  }
  const actual = await inventory(root);
  if (canonical(actual) !== canonical(expected))
    throw new Fault("SOURCE_DRIFT", "Source changed while preparing the selected import.", 5);
  return { directory, files: actual, digest: hash(canonical(actual)) };
}
async function rebaseAfterImport(ctx, runId, reviewedLocal, before, server, selected) {
  await checkSnapshot(ctx, server);
  const localRoot = await syncPath(ctx, ctx.config.application.sourceDir);
  if (canonical(await inventory(localRoot)) !== canonical(reviewedLocal))
    throw new Fault(
      "LOCAL_RECONCILIATION_REQUIRED",
      "Import confirmed; local files changed during execution. Reconcile them before another import.",
      5
    );
  const base = ".apexrest/deployments/" + runId;
  const replacement = await syncPath(ctx, base + "/rebased-source");
  const retained = await syncPath(ctx, base + "/local-before-rebase");
  await privateCopy(localRoot, replacement);
  const remoteOnly = changedFiles(before, server.files).filter(
    (file) => selected.includes(file) || reviewedLocal[file] === before[file]
  );
  for (const file of /* @__PURE__ */ new Set([...remoteOnly, ...selected])) {
    const destination = await contained(replacement, file);
    if (!server.files[file]) await rm4(destination, { force: true });
    else {
      await mkdir3(path10.dirname(destination), { recursive: true });
      await cp2(await contained(await syncPath(ctx, server.directory), file), destination);
    }
  }
  if (canonical(await inventory(localRoot)) !== canonical(reviewedLocal))
    throw new Fault(
      "LOCAL_RECONCILIATION_REQUIRED",
      "Import confirmed; concurrent local edits prevented rebase.",
      5
    );
  await rename(localRoot, retained);
  if (canonical(await inventory(retained)) !== canonical(reviewedLocal)) {
    await rename(retained, localRoot);
    throw new Fault(
      "LOCAL_RECONCILIATION_REQUIRED",
      "Import confirmed; concurrent local edits were preserved.",
      5
    );
  }
  try {
    await rename(replacement, localRoot);
  } catch (error) {
    await rename(retained, localRoot);
    throw error;
  }
}

// packages/core/src/oracle.ts
var targetIdentitySql = `select 'identity' target_record,
        sys_context('USERENV','DB_UNIQUE_NAME') db_unique_name,
        sys_context('USERENV','SERVICE_NAME') service_name,
        sys_context('USERENV','CURRENT_SCHEMA') parsing_schema,
        null workspace_id, null workspace, null application_id, null alias, null owner
       from dual
       union all
       select 'workspace', null, null, null, workspace_id, workspace, null, null, null
       from apex_workspaces where workspace = :p_workspace
       union all
       select 'application', null, null, null, null, workspace, application_id, alias, owner
       from apex_applications where application_id = :p_app_id`;
var targetVersionSql = "select (select version_no from apex_release) apex_version, version_full database_version from product_component_version where product like 'Oracle%Database%'";
var capabilityCache = /* @__PURE__ */ new Map();
var importHelpCache = /* @__PURE__ */ new Map();
function resetCapabilityCache() {
  capabilityCache.clear();
  importHelpCache.clear();
}
function raceCancellation(promise, signal, message) {
  const cancelled = () => new Fault("CANCELLED", message, 6, "cancelled");
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(cancelled());
  return new Promise((resolve, reject) => {
    const abort = () => reject(cancelled());
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
function sqlclToken(value) {
  if (!value || /[\r\n\x00"&]/.test(value))
    throw new Fault(
      "INVALID_SQLCL_TOKEN",
      "SQLcl argument contains a forbidden quote, newline or substitution character.",
      2
    );
  return '"' + value.replaceAll("\\", "/") + '"';
}
function sqlLiteral(value) {
  if (/[\x00-\x1f]/.test(value) || value.length > 1024)
    throw new Fault("INVALID_SQL_LITERAL", "Invalid SQL literal.", 2);
  return "'" + value.replaceAll("'", "''") + "'";
}
function oracleDiagnostics(r, mutation = false, format = "text") {
  const stdout = r.stdout.replace(/\x1b\[[0-9;]*m/g, ""), stderr = r.stderr.replace(/\x1b\[[0-9;]*m/g, ""), output = stdout + "\n" + stderr;
  if (r.cancelled || r.timedOut || r.truncated)
    throw new Fault(
      r.truncated ? "OUTPUT_LIMIT" : r.cancelled ? "CANCELLED" : "TIMEOUT",
      "SQLcl did not complete with a confirmed outcome.",
      6,
      mutation ? "outcome_unknown" : "cancelled"
    );
  let diagnostics = output;
  if (format === "json") {
    diagnostics = stripEnvelopeRows(stdout) + "\n" + stderr;
  }
  if (/ORA-01017|ORA-28000|ORA-28001/i.test(diagnostics))
    throw new Fault("AUTHENTICATION_FAILED", "Oracle authentication failed.", 4, "blocked");
  if (/ORA-01031/i.test(diagnostics))
    throw new Fault("DB_PRIVILEGE", "Oracle privileges are insufficient.", 4, "blocked");
  if (r.code !== 0 || /(?:ORA-|PLS-|SP2-|SQLCL-)[0-9]+|(?:^|\n)\s*(?:Error(?:\s|:)|Unknown command|Invalid command|Invalid option|Compilation failed|Validation failed)|not connected|Unable to|No APEXlang files/i.test(
    diagnostics
  ))
    throw new Fault(
      "ORACLE_COMMAND_FAILED",
      output.trim().slice(0, 6e3) || "SQLcl exited without success.",
      1
    );
  return output;
}
function jsonDocuments(text) {
  const spans = [];
  let depth = 0, start = -1, quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === "\\") i++;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{") {
      if (depth++ === 0) start = i;
    } else if (c === "}" && depth > 0 && --depth === 0) spans.push([start, i + 1]);
  }
  return spans;
}
function stripEnvelopeRows(stdout) {
  let result = "", cursor = 0;
  for (const [start, end] of jsonDocuments(stdout)) {
    let replacement = stdout.slice(start, end);
    try {
      const envelope = JSON.parse(replacement);
      if (Array.isArray(envelope.results) && envelope.results.length > 0 && envelope.results.every((entry) => Array.isArray(entry.items)))
        replacement = JSON.stringify({
          ...envelope,
          results: envelope.results.map(({ items: _items, ...metadata }) => metadata)
        });
    } catch {
    }
    result += stdout.slice(cursor, start) + replacement;
    cursor = end;
  }
  return result + stdout.slice(cursor);
}
var SCRIPT_RESTRICT_LEVEL = "2";
var OracleAdapter = class {
  constructor(runner = runProcess, executable = process.env.APEXREST_SQLCL ?? "sql", mcpRunner = runSqlclMcp) {
    this.runner = runner;
    this.executable = executable;
    this.mcpRunner = mcpRunner;
  }
  runner;
  executable;
  mcpRunner;
  selectedTransport;
  selectedConnections = /* @__PURE__ */ new Map();
  async settings() {
    const file = path11.join(managedHome(), "runtime.json");
    const state = await exists(file) ? await readJson(file) : {};
    const transport = await (this.selectedTransport ??= sqlclConfig());
    return {
      ...transport,
      executable: process.env.APEXREST_SQLCL ?? state.sqlcl ?? this.executable,
      javaHome: process.env.APEXREST_JAVA_HOME ?? (state.java ? path11.dirname(path11.dirname(state.java)) : process.env.JAVA_HOME)
    };
  }
  async selectedConnection(connection) {
    const settings = await this.settings();
    const key = connectionReference(connection) ?? JSON.stringify(connection);
    let selected = this.selectedConnections.get(key);
    if (!selected) {
      selected = (async () => {
        if (settings.databaseTransport === "ords") {
          if (settings.mode !== "cli")
            throw new Fault("ORDS_CLI_REQUIRED", "ORDS HTTP requires SQLcl CLI mode.", 3, "blocked");
          return { ords: await ordsCredentials(connection) };
        }
        if (!connection.name)
          throw new Fault(
            "DIRECT_CONNECTION_REQUIRED",
            "Configure a direct SQLcl saved connection for this reference or select ORDS HTTP in plugin settings.",
            3,
            "blocked"
          );
        return { name: parse(savedConnectionName, connection.name) };
      })();
      this.selectedConnections.set(key, selected);
    }
    return selected;
  }
  async session(input, connection, mutation = false, signal, cwd, format = "text", restrictLevel, isolated = false) {
    if (restrictLevel && (await this.settings()).mode === "mcp")
      throw new Fault(
        "SQLCL_MCP_SCRIPT_RESTRICT_UNAVAILABLE",
        "Restricted script operations require SQLcl CLI mode with -R 2; MCP does not provide an equivalent restriction.",
        3,
        "blocked"
      );
    const work = cwd ?? await this.stage();
    try {
      return await this.sessionIn(work, input, connection, mutation, signal, format, restrictLevel, isolated);
    } finally {
      if (!cwd) await this.discardStage(work);
    }
  }
  async sessionIn(work, input, connection, mutation, signal, format, restrictLevel, isolated) {
    const settings = await this.settings();
    if (mutation) await this.requireMutationSupport();
    const selected = connection ? await this.selectedConnection(connection) : void 0;
    const args = [
      "-S",
      "-L",
      ...restrictLevel ? ["-R", restrictLevel] : [],
      ...selected?.name ? ["-name", selected.name] : ["/nolog"]
    ];
    const env = {
      ...process.env,
      SQLPATH: "",
      ORACLE_PATH: "",
      TNS_ADMIN: process.env.TNS_ADMIN,
      JAVA_HOME: settings.javaHome
    };
    delete env.NODE_OPTIONS;
    delete env.JAVA_TOOL_OPTIONS;
    delete env._JAVA_OPTIONS;
    delete env.JDK_JAVA_OPTIONS;
    const preamble = "set define off\nset echo off\nset feedback off\n" + (settings.mode === "mcp" && settings.mcpRestrictLevel === "4" ? "" : "whenever oserror exit failure rollback\nwhenever sqlerror exit failure rollback\n");
    const connect = selected?.ords ? `set history filter default connect
connect -orest -user "${selected.ords.username}" -password "${selected.ords.password}" -url "${selected.ords.url}"
` : "";
    const marker = `APEXREST_COMPLETE_${randomUUID().replaceAll("-", "")}`;
    const request = {
      executable: settings.executable,
      args,
      cwd: work,
      env,
      input: preamble + connect + input + "\nexit\n",
      timeoutMs: 18e4,
      ...signal ? { signal } : {}
    };
    const pooled = !isolated && (settings.mode === "mcp" ? this.mcpRunner === runSqlclMcp : this.runner === runProcess && !selected && settings.databaseTransport !== "ords");
    const viaServer = settings.mode === "mcp" || pooled;
    const raw = viaServer ? await (pooled ? runPooledSqlcl : this.mcpRunner)({
      ...request,
      cwd: pooled ? await this.sessionHome() : work,
      // Let SQLcl apply its MCP default. In 26.1, explicit -R 4
      // also suppresses connmgr output, unlike the default MCP profile.
      args: settings.mode === "mcp" ? settings.mcpRestrictLevel === "4" ? ["-mcp"] : ["-R", "1", "-mcp"] : [...restrictLevel ? ["-R", restrictLevel] : [], "-mcp"],
      // CLI's final EXIT commits on success. Preserve that transaction
      // boundary before acknowledging a write over a persistent session.
      input: (settings.mode === "cli" ? preamble.replace(/exit failure rollback/g, "continue") : preamble) + // Persistent servers keep SET state between batches; start neutral.
      (selected?.name ? "rollback;\nbegin dbms_session.reset_package; execute immediate 'alter session set current_schema = ' || dbms_assert.enquote_name(sys_context('USERENV', 'SESSION_USER'), false); end;\n/\n" : "") + "set serveroutput off\nset sqlformat default\n" + input + (mutation ? "\ncommit;\n" : "\n") + `prompt ${marker}
`,
      mutation,
      completionMarker: marker,
      ...selected?.name ? { connectionName: selected.name } : {}
    }) : await this.runner(request);
    const secret = selected?.ords?.password;
    const result = secret && format !== "json" ? {
      ...raw,
      stdout: raw.stdout.replaceAll(secret, "[REDACTED]"),
      stderr: raw.stderr.replaceAll(secret, "[REDACTED]")
    } : raw;
    let output;
    try {
      output = oracleDiagnostics(result, mutation, format);
    } catch (error) {
      if (secret && error instanceof Error) error.message = error.message.replaceAll(secret, "[REDACTED]");
      throw error;
    }
    if (viaServer && !output.split(/\r?\n/).some((line) => line.trim() === marker))
      throw new Fault(
        "SQLCL_MCP_INCOMPLETE",
        "SQLcl MCP did not confirm the complete command batch.",
        6,
        mutation ? "outcome_unknown" : "failed"
      );
    return { ...result, output: viaServer ? output.replace(marker, "").trim() : output, work };
  }
  /** Working directory of pooled SQLcl servers: a durable private directory, never a per-call stage. */
  async sessionHome() {
    const root = path11.join(managedHome(), "staging");
    await mkdir4(root, { recursive: true, mode: 448 });
    return root;
  }
  async requireMutationSupport() {
    const settings = await this.settings();
    if (settings.databaseTransport === "ords" && settings.mode !== "cli")
      throw new Fault("ORDS_CLI_REQUIRED", "ORDS HTTP requires SQLcl CLI mode.", 3, "blocked");
    if (settings.mode === "mcp" && settings.mcpRestrictLevel !== "1")
      throw new Fault(
        "SQLCL_MCP_RESTRICTED",
        "SQLcl MCP restrict level 4 cannot provide fail-stop scripts for writes. Explicitly select MCP restrict level 1 in SQLcl settings for authorized deployment/scripts.",
        3,
        "blocked"
      );
  }
  async stage() {
    const root = path11.join(managedHome(), "staging");
    await mkdir4(root, { recursive: true, mode: 448 });
    return mkdtemp(path11.join(root, "oracle-"));
  }
  /** Remove a private staging directory created by stage(). Other paths are never removed. */
  async discardStage(stage) {
    if (!stage) return;
    const relative = path11.relative(path11.join(managedHome(), "staging"), path11.resolve(stage));
    if (!/^oracle-[^/\\]+$/.test(relative)) return;
    await rm5(stage, { recursive: true, force: true });
  }
  async ordsBridge(job, connection, signal, stage) {
    const settings = await this.settings();
    const selected = connection ? await this.selectedConnection(connection) : void 0;
    if (connection && !selected?.ords)
      throw new Fault(
        "ORDS_CONNECTION_REQUIRED",
        "Select the ORDS transport for this operation.",
        3,
        "blocked"
      );
    const work = stage ?? await this.stage();
    try {
      return await runOrdsBridge(settings, job, selected?.ords, work, signal, this.runner);
    } finally {
      if (!stage) await this.discardStage(work);
    }
  }
  async capabilityKey(settings) {
    if (!path11.isAbsolute(settings.executable)) return;
    try {
      const executable = await realpath4(settings.executable);
      const bin = path11.dirname(executable);
      if (path11.basename(bin) !== "bin") return;
      const lib = path11.join(path11.dirname(bin), "lib");
      const mark = async (file, required) => {
        try {
          const info = await stat3(file, { bigint: true });
          return [info.dev, info.ino, info.mode, info.size, info.mtimeNs, info.ctimeNs].map(String);
        } catch (error) {
          if (required) throw error;
          return "absent";
        }
      };
      const marks = {
        executable: await mark(executable, true),
        lib: await mark(lib, true),
        apex: await mark(path11.join(lib, "dbtools-apex.jar"), false),
        apexlang: await mark(path11.join(lib, "apexlang-compiler.jar"), false),
        ext: await mark(path11.join(lib, "ext"), false),
        extApex: await mark(path11.join(lib, "ext/dbtools-apex.jar"), false),
        extApexlang: await mark(path11.join(lib, "ext/apexlang-compiler.jar"), false)
      };
      const { executable: _executable, ...rest } = settings;
      return hash(canonical({ ...rest, executable, marks }));
    } catch {
      return;
    }
  }
  async probeCapabilities(settings, key) {
    const versionStage = await this.stage();
    let version;
    try {
      version = await this.runner({
        executable: settings.executable,
        args: ["-version"],
        cwd: versionStage,
        env: { ...process.env, JAVA_HOME: settings.javaHome },
        timeoutMs: 15e3
      });
    } finally {
      await this.discardStage(versionStage);
    }
    oracleDiagnostics(version);
    const help = (await this.session("help apex")).output;
    if (key && key !== await this.capabilityKey(settings)) capabilityCache.delete(key);
    const commands = Object.fromEntries(
      ["generate", "export", "validate", "import"].map((command) => [
        command,
        new RegExp("\\b" + command + "\\b", "i").test(help)
      ])
    );
    return { version: version.stdout.trim(), commands, helpHash: hash(help), help };
  }
  async capabilities(signal) {
    const settings = await this.settings();
    const key = await this.capabilityKey(settings);
    let pending = key ? capabilityCache.get(key) : void 0;
    if (!pending) {
      pending = this.probeCapabilities(settings, key);
      if (key) {
        capabilityCache.set(key, pending);
        pending.catch(() => {
          if (capabilityCache.get(key) === pending) capabilityCache.delete(key);
        });
      } else pending.catch(() => {
      });
    }
    return raceCancellation(pending, signal, "Capability check cancelled.");
  }
  async requireCapability(name, signal) {
    const capabilities = await this.capabilities(signal);
    if (!capabilities.commands[name])
      throw new Fault("UNSUPPORTED_CAPABILITY", `This SQLcl does not advertise apex ${name}.`, 3, "blocked");
    return { version: capabilities.version, helpHash: capabilities.helpHash };
  }
  /** Inspect selected-file support without connecting or trusting the generic APEX help. */
  async importHelp(signal) {
    const key = await this.capabilityKey(await this.settings());
    let pending = key ? importHelpCache.get(key) : void 0;
    if (!pending) {
      pending = this.session("help apex import").then(
        (result) => result.output.replace(/\x1b\[[0-9;]*m/g, "")
      );
      if (key) {
        importHelpCache.set(key, pending);
        pending.catch(() => importHelpCache.delete(key));
      }
    }
    return raceCancellation(pending, signal, "Import capability check cancelled.");
  }
  async partialImportCapabilities(source, target, signal) {
    const compiler = await this.requireCapability("import", signal);
    const settings = await this.settings();
    const help = await this.importHelp(signal);
    return evaluatePartialImportCompatibility({
      ...target,
      compilerVersion: compiler.version,
      mmdVersion: await sourceMmdVersion(source),
      importFiles: /(?:^|\s)-files(?:\s|\|)/m.test(help),
      mode: settings.mode,
      databaseTransport: settings.databaseTransport ?? "direct",
      helpHash: hash(help)
    });
  }
  async codeScan(source, signal) {
    const compiler = await this.capabilities(signal);
    if (!/Release 26\.3\./.test(compiler.version))
      return {
        status: "unavailable",
        findings: [],
        reason: "APEXlang CodeScan is qualified only for SQLcl 26.3."
      };
    const stage = await this.stage(), copy = path11.join(stage, "application");
    try {
      await cp3(source, copy, { recursive: true });
      const help = (await this.session("help codescan", void 0, false, signal)).output;
      if (!/\.apx\b/i.test(help) || !/-extensions\b/i.test(help))
        return {
          status: "unavailable",
          findings: [],
          reason: "Selected SQLcl does not advertise APEXlang CodeScan."
        };
      const result = await this.session(
        `codescan -path ${sqlclToken(copy)} -extensions apx -format json`,
        void 0,
        false,
        signal
      );
      return { status: "advisory", findings: parseCodeScan(result.output, copy) };
    } catch (error) {
      if (signal?.aborted || error instanceof Fault && error.code === "CANCELLED") throw error;
      return {
        status: "unavailable",
        findings: [],
        reason: error instanceof Error ? error.message : "CodeScan did not complete."
      };
    } finally {
      await this.discardStage(stage);
    }
  }
  async generate(name, alias) {
    const compiler = await this.requireCapability("generate");
    const stage = await this.stage();
    const result = await this.session(
      `apex generate -name ${sqlclToken(name)} -alias ${sqlclToken(parse(refName, alias))} -dir ${sqlclToken(stage)}`,
      void 0,
      false,
      void 0,
      stage,
      "text",
      void 0,
      // SQLcl 26.3 rejects freshly generated MMD when generation and validation
      // share a JVM. The cause is in the vendor process state. Keep
      // generation disposable; do not close pools used by other callers.
      /Release 26\.3\./.test(compiler.version)
    );
    const directory = await this.findApplication(stage);
    return { directory, compiler, output: result.output, files: await inventory(directory) };
  }
  async findApplication(root) {
    if (await exists(path11.join(root, "application.apx"))) return root;
    const found = [];
    for (const entry of await readdir2(root, { withFileTypes: true }))
      if (entry.isDirectory()) {
        const dir = path11.join(root, entry.name);
        if (await exists(path11.join(dir, "application.apx"))) found.push(dir);
        else
          for (const sub of await readdir2(dir, { withFileTypes: true }))
            if (sub.isDirectory() && await exists(path11.join(dir, sub.name, "application.apx")))
              found.push(path11.join(dir, sub.name));
      }
    if (found.length !== 1)
      throw new Fault(
        "ORACLE_OUTPUT_MISSING",
        "Expected exactly one generated/exported APEXlang application.",
        1
      );
    return found[0];
  }
  async validate(source, signal) {
    const compiler = await this.requireCapability("validate", signal);
    const before = await inventory(source);
    if (!before[".apex/apexlang.json"])
      throw new Fault(
        "MMD_METADATA_REQUIRED",
        "Preserve Oracle-generated .apex/apexlang.json before validation.",
        3
      );
    const stage = await this.stage(), copy = path11.join(stage, "application");
    let result;
    try {
      await cp3(source, copy, { recursive: true });
      result = await this.session(
        `apex validate -input ${sqlclToken(copy)}`,
        void 0,
        false,
        signal,
        stage
      );
    } catch (error) {
      if (error instanceof Fault && error.code === "ORACLE_COMMAND_FAILED" && !error.details) {
        const details = await compilerDetails(error.message, source);
        if (details) throw new Fault("VALIDATION_FAILED", error.message, 1, "failed", details);
      }
      throw error;
    } finally {
      await this.discardStage(stage);
    }
    if (!compilerSucceeded(result.output)) throw await compilerFault(result.output, source);
    if (canonical(before) !== canonical(await inventory(source)))
      throw new Fault("SOURCE_DRIFT", "Source changed during validation.", 5);
    return {
      status: "passed",
      compiler,
      mmd: JSON.parse(await readFile5(path11.join(source, ".apex/apexlang.json"), "utf8")),
      sourceDigest: hash(canonical(before)),
      output: result.output
    };
  }
  async exportApplication(env, connection, format = "APEXLANG") {
    const compiler = await this.requireCapability("export");
    const stage = await this.stage();
    const ords = (await this.settings()).databaseTransport === "ords";
    const exportRoot = ords ? path11.join(stage, "export") : stage;
    const result = ords ? {
      output: String(
        (await this.ordsBridge(
          {
            operation: "export",
            applicationId: env.applicationId,
            exportType: format,
            split: format === "APEXLANG",
            outputDirectory: exportRoot
          },
          connection,
          void 0,
          stage
        )).message ?? "Export successful"
      )
    } : await this.session(
      `apex export -applicationid ${env.applicationId} -exptype ${format} -skipExportDate -expOriginalIds -dir ${sqlclToken(stage)}`,
      connection,
      false,
      void 0,
      stage
    );
    const directory = format === "APEXLANG" ? await this.findApplication(exportRoot) : exportRoot;
    const files = await inventory(directory);
    if (!Object.keys(files).length || format === "SQL" && !Object.keys(files).some((f2) => f2.endsWith(".sql")))
      throw new Fault("EMPTY_BACKUP", "Oracle export produced no usable files.", 1);
    return {
      directory,
      files,
      digest: hash(canonical(files)),
      format,
      compiler,
      output: result.output,
      stage
    };
  }
  /** Native page export; shared files use an explicitly bound full APEXlang observation. */
  async exportSelection(env, connection, selected, source, knownFiles = {}, exportScope = "selected") {
    if (!selected.length || new Set(selected).size !== selected.length || selected.some((file) => !(exportScope === "selected" ? scopedExportFile(file) : supportedFile(file))))
      throw new Fault(
        "PARTIAL_EXPORT_UNSUPPORTED",
        "Selection has no qualified native component export mapping.",
        3
      );
    const settings = await this.settings();
    if (settings.mode !== "cli" || (settings.databaseTransport ?? "direct") !== "direct")
      throw new Fault(
        "PARTIAL_EXPORT_UNSUPPORTED",
        "Component export requires direct SQLcl CLI transport.",
        3
      );
    const compiler = await this.requireCapability("export");
    const stage = await this.stage(), directory = path11.join(stage, "selection");
    await mkdir4(directory, { mode: 448 });
    try {
      if (exportScope === "full") {
        const exported = await this.exportApplication(env, connection, "APEXLANG");
        try {
          for (const file of selected) {
            const pageId = /^pages\/p(\d{5})/.exec(file)?.[1];
            const matches = Object.keys(exported.files).filter(
              (candidate) => pageId ? /^pages\/p(\d{5})/.exec(candidate)?.[1] === pageId : candidate === file
            );
            if (matches.length > 1)
              throw new Fault("PARTIAL_EXPORT_AMBIGUOUS", "Export has duplicate selected identities.", 5);
            if (!matches.length) continue;
            const target = await contained(directory, file);
            await mkdir4(path11.dirname(target), { recursive: true, mode: 448 });
            await cp3(await contained(exported.directory, matches[0]), target);
          }
          const files2 = await inventory(directory);
          return {
            directory,
            files: files2,
            digest: hash(canonical(files2)),
            format: "APEXLANG",
            compiler,
            output: exported.output,
            stage
          };
        } finally {
          await this.discardStage(exported.stage);
        }
      }
      const mappings = [];
      const queries = [];
      if (selected.some((file) => file.startsWith("pages/") && !knownFiles[file]))
        queries.push(
          "select 'PAGE' component_type, to_char(page_id) component_id, to_char(page_id) component_name from apex_application_pages where application_id = :p_app"
        );
      const metadata = queries.length ? await this.jsonQuery(queries.join(" union all "), connection, { p_app: env.applicationId }) : [];
      for (const file of selected) {
        const page = /^pages\/p(\d{5})/.exec(file);
        if (page) {
          const id = String(Number(page[1]));
          if (knownFiles[file] || metadata.some((row) => row.component_type === "PAGE" && row.component_id === id))
            mappings.push({ file, type: "PAGE", id });
        }
      }
      if (new Set(mappings.map((entry) => entry.type + ":" + entry.id)).size !== mappings.length)
        throw new Fault(
          "PARTIAL_EXPORT_AMBIGUOUS",
          "Multiple selected files map to one server component.",
          5
        );
      let output = "Selected components are absent; no previous source export required.";
      if (mappings.length) {
        const result = await this.session(
          `apex export -applicationid ${env.applicationId} -exptype APEXLANG -skipExportDate -expOriginalIds -dir ${sqlclToken(stage)} -expComponents ${sqlclToken(mappings.map((entry) => entry.type + ":" + entry.id).join(" "))}`,
          connection,
          false,
          void 0,
          stage
        );
        output = result.output;
        const emitted = await inventory(stage);
        const observed = /* @__PURE__ */ new Set();
        for (const [file] of Object.entries(emitted)) {
          if (!file.endsWith(".apx"))
            throw new Fault(
              "PARTIAL_EXPORT_SCOPE_FAILED",
              "Native export emitted an unexpected artifact.",
              5
            );
          const exportedPage = /(?:^|\/)pages\/p(\d{5})[-\w]*\.apx$/.exec(file);
          const matches = mappings.filter(
            (entry) => entry.type === "PAGE" && exportedPage && entry.id === String(Number(exportedPage[1]))
          );
          if (matches.length !== 1 || observed.has(matches[0].file))
            throw new Fault(
              "PARTIAL_EXPORT_SCOPE_FAILED",
              "Native export emitted an unselected or ambiguous page identity.",
              5
            );
          observed.add(matches[0].file);
          const target = await contained(directory, matches[0].file);
          await mkdir4(path11.dirname(target), { recursive: true, mode: 448 });
          await cp3(await contained(stage, file), target);
        }
      }
      const files = await inventory(directory);
      return {
        directory,
        files,
        digest: hash(canonical(files)),
        format: "APEXLANG",
        compiler,
        output,
        stage
      };
    } catch (error) {
      await this.discardStage(stage);
      throw error;
    }
  }
  async connectionLocality(connection) {
    const selected = await this.selectedConnection(connection);
    if (selected.ords) {
      const host = new URL(selected.ords.url).hostname;
      if (!["localhost", "127.0.0.1", "[::1]"].includes(host))
        return { local: false, evidence: "remote-ords-endpoint" };
    }
    const endpoint = selected.ords ? { local: true, evidence: "effective-loopback-ords-endpoint" } : localConnectionEndpoint((await this.session("show connection", connection)).output);
    if (!endpoint.local) return endpoint;
    const rows = await this.jsonQuery(
      "select sys_context('USERENV','SERVER_HOST') server_host from dual",
      connection
    );
    const verified = typeof rows[0]?.server_host === "string" && await localServerHost(rows[0].server_host);
    return {
      local: verified,
      evidence: verified ? endpoint.evidence + "+local-server-identity" : "loopback-server-identity-unconfirmed"
    };
  }
  async databaseDependencies(schema, object, connection) {
    const identifier = /^(?:"(?:[^"]|"")+"|[A-Za-z][A-Za-z0-9_$#]*)$/;
    const parts = object.match(/"(?:[^"]|"")+"|[A-Za-z][A-Za-z0-9_$#]*/g) ?? [];
    if (!parts.length || parts.length > 2 || parts.join(".") !== object || !parts.every((part) => identifier.test(part)))
      throw new Fault(
        "DATABASE_DEPENDENCY_UNRESOLVED",
        "Cannot resolve the reviewed object name for dependency inspection.",
        4
      );
    const value = (part) => part.startsWith('"') ? part.slice(1, -1).replaceAll('""', '"') : part.toUpperCase();
    if (parts.length === 2) schema = value(parts[0]);
    object = value(parts.at(-1));
    return this.jsonQuery(
      "select owner, name, type from all_dependencies where referenced_owner=:p_owner and referenced_name=:p_name order by owner,name,type",
      connection,
      { p_owner: schema, p_name: object }
    );
  }
  async savedConnections(signal) {
    const marker = `APEXREST_CONNECTIONS_${randomUUID().replaceAll("-", "")}`;
    const result = await this.session(
      `prompt ${marker}_BEGIN
connmgr list -flat
prompt ${marker}_END`,
      void 0,
      false,
      signal
    );
    const lines = result.output.split(/\r?\n/).map((line) => line.trim());
    const start = lines.indexOf(`${marker}_BEGIN`), end = lines.indexOf(`${marker}_END`);
    if (start < 0 || end <= start)
      throw new Fault(
        "CONNECTION_LIST_UNCONFIRMED",
        "SQLcl did not return a complete saved connection list.",
        3
      );
    const names = [...new Set(lines.slice(start + 1, end).filter(Boolean))];
    return {
      source: "sqlcl-store",
      connections: names.map((name) => ({ name: parse(savedConnectionName, name) }))
    };
  }
  bindPreamble(bindings, ords) {
    return Object.entries(bindings).map(([key, value]) => {
      if (!/^p_[a-z_]+$/.test(key)) throw new Fault("INVALID_BIND", "Invalid internal bind name.", 2);
      const declaration = `variable ${key} ${typeof value === "number" ? "number" : "varchar2(1024)"}`;
      const literal = typeof value === "number" ? value : sqlLiteral(value);
      if (ords) {
        if (typeof value === "string" && /[\x00-\x1f\x7f-\x9f]/.test(value))
          throw new Fault(
            "INVALID_BIND",
            "ORDS metadata bind values cannot contain control characters.",
            2
          );
        return `${declaration} = ${typeof value === "number" ? value : `'${value}'`}`;
      }
      return `${declaration}
exec :${key} := ${literal};`;
    }).join("\n");
  }
  parseRows(output) {
    const start = output.indexOf("{"), end = output.lastIndexOf("}");
    if (start < 0) throw new Fault("EMPTY_QUERY_RESULT", "SQLcl did not return its JSON result envelope.", 1);
    let json;
    try {
      json = JSON.parse(output.slice(start, end + 1));
    } catch {
      throw new Fault("INVALID_ORACLE_JSON", "Cannot decode Oracle metadata result.", 1);
    }
    const resultSets = json.results;
    if (!Array.isArray(resultSets) || !Array.isArray(resultSets[0]?.items))
      throw new Fault("INVALID_ORACLE_JSON", "SQLcl result has no items collection.", 1);
    return resultSets[0].items;
  }
  async jsonQuery(sql, connection, bindings = {}, signal) {
    const ords = (await this.settings()).databaseTransport === "ords";
    const result = await this.session(
      `${this.bindPreamble(bindings, ords)}
set sqlformat json
${sql};`,
      connection,
      false,
      signal,
      void 0,
      "json"
    );
    return this.parseRows(result.output);
  }
  /**
   * Several read-only queries in one SQLcl session. Each query's rows are
   * delimited by a private marker; a missing marker fails the whole batch and
   * never yields a partial result.
   */
  async jsonQueryBatch(queries, connection, signal) {
    if (!queries.length) return [];
    const ords = (await this.settings()).databaseTransport === "ords";
    const token = `APEXREST_ROWS_${randomUUID().replaceAll("-", "")}`;
    const input = queries.map(
      (query, index) => `${this.bindPreamble(query.bindings ?? {}, ords)}
set sqlformat json
${query.sql};
prompt ${token}_${index}`
    ).join("\n");
    const result = await this.session(input, connection, false, signal, void 0, "json");
    const lines = result.output.replace(new RegExp(`}(?=${token}_\\d+[ \\t]*(?:\\r?\\n|$))`, "g"), "}\n").split(/\r?\n/);
    const rows = [];
    let from = 0;
    for (let index = 0; index < queries.length; index++) {
      const at2 = lines.findIndex((line, i) => i >= from && line.trim() === `${token}_${index}`);
      if (at2 < 0)
        throw new Fault("EMPTY_QUERY_RESULT", "SQLcl did not return every JSON result envelope.", 1);
      rows.push(this.parseRows(lines.slice(from, at2).join("\n")));
      from = at2 + 1;
    }
    return rows;
  }
  async identity(connection, signal) {
    const rows = await this.jsonQuery(
      "select sys_context('USERENV','DB_UNIQUE_NAME') db_unique_name, sys_context('USERENV','SERVICE_NAME') service_name, sys_context('USERENV','CURRENT_SCHEMA') parsing_schema from dual",
      connection,
      {},
      signal
    );
    if (rows.length !== 1) throw new Fault("IDENTITY_UNCONFIRMED", "Database identity was not confirmed.", 3);
    return rows[0];
  }
  /** Read-only release discovery, separate from identity checks for legacy callers. */
  async targetVersions(connection, signal) {
    const rows = await this.jsonQuery(targetVersionSql, connection, {}, signal);
    return this.parseTargetVersions(rows);
  }
  parseTargetVersions(rows) {
    const row = rows[0];
    if (rows.length !== 1 || typeof row?.apex_version !== "string" || typeof row.database_version !== "string" || !/^\d+\.\d+(?:\.\d+)*$/.test(row.apex_version) || !/^\d+\.\d+(?:\.\d+)*$/.test(row.database_version))
      throw new Fault(
        "TARGET_VERSION_UNCONFIRMED",
        "APEX and database releases could not be confirmed.",
        3,
        "blocked"
      );
    return { apexVersion: row.apex_version, databaseVersion: row.database_version };
  }
  async verifyTarget(env, connection, observed) {
    const rows = observed ?? await this.jsonQuery(targetIdentitySql, connection, {
      p_workspace: env.workspace,
      p_app_id: env.applicationId
    });
    const identities = rows.filter((row) => row.target_record === "identity");
    if (identities.length !== 1)
      throw new Fault("IDENTITY_UNCONFIRMED", "Database identity was not confirmed.", 3);
    const identity = {
      db_unique_name: identities[0].db_unique_name,
      service_name: identities[0].service_name,
      parsing_schema: identities[0].parsing_schema
    };
    if (identity.db_unique_name !== env.databaseIdentity.dbUniqueName || identity.service_name !== env.databaseIdentity.serviceName || identity.parsing_schema !== env.parsingSchema)
      throw new Fault(
        "TARGET_MISMATCH",
        "Connection does not match the configured database/service/schema.",
        5,
        "conflict"
      );
    const workspaces = rows.filter((row) => row.target_record === "workspace").map((row) => ({ workspace_id: row.workspace_id, workspace: row.workspace }));
    if (workspaces.length !== 1)
      throw new Fault(
        "WORKSPACE_UNCONFIRMED",
        "Configured workspace is absent or inaccessible.",
        4,
        "blocked"
      );
    const applications = rows.filter((row) => row.target_record === "application").map((row) => ({
      application_id: row.application_id,
      alias: row.alias,
      owner: row.owner,
      workspace: row.workspace
    }));
    if (applications.length > 1 || applications.some((a) => a.workspace !== env.workspace || a.owner !== env.parsingSchema))
      throw new Fault(
        "APPLICATION_TARGET_MISMATCH",
        "Application belongs to a different workspace or parsing schema.",
        5
      );
    return { identity, workspace: workspaces[0], application: applications[0] ?? null };
  }
  /** Fresh identity and versions share one read-only SQLcl session. */
  async versionedTarget(env, connection) {
    const [identity, versions] = await this.jsonQueryBatch(
      [
        { sql: targetIdentitySql, bindings: { p_workspace: env.workspace, p_app_id: env.applicationId } },
        { sql: targetVersionSql }
      ],
      connection
    );
    return {
      target: await this.verifyTarget(env, connection, identity),
      versions: this.parseTargetVersions(versions)
    };
  }
  async applicationMetadata(env, connection) {
    const rows = await this.jsonQuery(
      `select to_char(last_updated_on, 'YYYY-MM-DD"T"HH24:MI:SS', 'NLS_DATE_LANGUAGE=American') last_updated_on,
        last_updated_by,
        case when last_updated_on is null then 'Y' else 'N' end last_updated_on_is_null,
        case when last_updated_by is null then 'Y' else 'N' end last_updated_by_is_null
        from apex_applications
        where application_id = :p_app_id and workspace = :p_workspace and owner = :p_owner`,
      connection,
      { p_app_id: env.applicationId, p_workspace: env.workspace, p_owner: env.parsingSchema }
    );
    const row = rows[0];
    if (row && !Object.hasOwn(row, "last_updated_on") && row.last_updated_on_is_null === "Y")
      row.last_updated_on = null;
    if (row && !Object.hasOwn(row, "last_updated_by") && row.last_updated_by_is_null === "Y")
      row.last_updated_by = null;
    if (rows.length !== 1 || !row || !Object.hasOwn(row, "last_updated_on") || !Object.hasOwn(row, "last_updated_by"))
      throw new Fault(
        "SYNC_METADATA_UNCONFIRMED",
        "Application update metadata is absent or inaccessible.",
        5
      );
    if ([row.last_updated_on, row.last_updated_by].some((v2) => v2 !== null && typeof v2 !== "string"))
      throw new Fault("SYNC_METADATA_UNCONFIRMED", "Unexpected application update metadata.", 5);
    return {
      lastUpdatedOn: row.last_updated_on,
      lastUpdatedBy: row.last_updated_by
    };
  }
  async nativeDeployment(ctx, env, source) {
    const output = path11.join(await this.stage(), "deployment.json");
    const defaults = path11.join(source, "deployments/default.json");
    const native = await exists(defaults) ? JSON.parse(await readFile5(defaults, "utf8")) : {};
    const oldApp = native.app ?? {};
    await writeJson(output, {
      ...native,
      app: {
        ...oldApp,
        id: env.applicationId,
        alias: ctx.config.application.alias,
        databaseSession: { ...oldApp.databaseSession ?? {}, parsingSchema: env.parsingSchema }
      },
      workspace: { name: env.workspace }
    });
    return output;
  }
  async importApplication(ctx, env, connection, source, signal, selectedFiles) {
    await this.requireCapability("import", signal);
    if (selectedFiles !== void 0) {
      const settings = await this.settings();
      if (settings.mode !== "cli" || (settings.databaseTransport ?? "direct") !== "direct")
        throw new Fault(
          "PARTIAL_IMPORT_TRANSPORT_UNSUPPORTED",
          "Partial import requires direct SQLcl CLI transport.",
          3,
          "blocked"
        );
      if (!selectedFiles.length || new Set(selectedFiles).size !== selectedFiles.length)
        throw new Fault(
          "PARTIAL_IMPORT_FILES_INVALID",
          "Select a nonempty, unique list of APEXlang files.",
          2
        );
      for (const file of selectedFiles) {
        if (!/^[A-Za-z0-9_./-]+\.apx$/.test(file) || path11.isAbsolute(file) || file.split("/").some((part) => !part || part === "." || part === ".."))
          throw new Fault(
            "PARTIAL_IMPORT_FILES_INVALID",
            "Partial-import files must be literal contained APEXlang paths without globs.",
            2
          );
        let valid = false;
        try {
          const physical = await realpath4(await contained(source, file));
          valid = path11.relative(await realpath4(source), physical).replaceAll(path11.sep, "/") === file && (await stat3(physical)).isFile();
        } catch {
        }
        if (!valid)
          throw new Fault(
            "PARTIAL_IMPORT_FILES_INVALID",
            "Partial-import files must be regular contained files without aliases.",
            2
          );
      }
      const help = await this.importHelp(signal);
      if (!/(?:^|\s)-files(?:\s|\|)/m.test(help))
        throw new Fault(
          "PARTIAL_IMPORT_UNSUPPORTED",
          "The selected SQLcl does not advertise apex import -files.",
          3,
          "blocked"
        );
    }
    const config = await this.nativeDeployment(ctx, env, source);
    try {
      return await this.importWith(env, connection, source, config, signal, selectedFiles);
    } finally {
      await this.discardStage(path11.dirname(config));
    }
  }
  async importWith(env, connection, source, config, signal, selectedFiles) {
    if ((await this.settings()).databaseTransport === "ords") {
      await this.requireMutationSupport();
      const result2 = await this.ordsBridge(
        {
          operation: "import",
          input: source,
          deployment: config,
          applicationId: env.applicationId,
          workspace: env.workspace,
          parsingSchema: env.parsingSchema
        },
        connection,
        signal
      );
      return String(result2.message ?? "Import successful");
    }
    let result;
    try {
      result = await this.session(
        `apex import -input ${sqlclToken(source)} -deployment ${sqlclToken(config)} -workspace ${sqlclToken(env.workspace)} -schema ${sqlclToken(env.parsingSchema)} -id ${env.applicationId}${selectedFiles ? " -files " + selectedFiles.map((file) => sqlclToken(file)).join(" ") : ""}`,
        connection,
        true,
        signal,
        selectedFiles ? source : void 0,
        "text",
        SCRIPT_RESTRICT_LEVEL
      );
    } catch (error) {
      if (error instanceof Fault && error.code === "ORACLE_COMMAND_FAILED" && !error.details)
        error.details = await compilerDetails(error.message, source);
      throw error;
    }
    if (!/import.*(?:success|complete)|successfully.*import/is.test(result.output))
      throw new Fault(
        "IMPORT_UNCONFIRMED",
        "Import returned without a tested success marker; reconcile the target.",
        6,
        "outcome_unknown"
      );
    return result.output;
  }
  async restoreApplication(env, connection, file, signal) {
    const setup = `begin
 apex_application_install.set_workspace(${sqlLiteral(env.workspace)});
 apex_application_install.set_schema(${sqlLiteral(env.parsingSchema)});
 apex_application_install.set_application_id(${env.applicationId});
end;
/
`;
    if ((await this.settings()).databaseTransport === "ords") {
      await this.requireMutationSupport();
      const stage = await this.stage();
      try {
        const input = path11.join(stage, "restore.sql");
        await (await import("./chunk-A7ESH6F5.mjs")).atomicWrite(input, setup + await readFile5(file, "utf8"));
        return await this.ordsBridge({ operation: "script", input }, connection, signal, stage);
      } finally {
        await this.discardStage(stage);
      }
    }
    return this.session(
      setup + `@${sqlclToken(file)}`,
      connection,
      true,
      signal,
      void 0,
      "text",
      SCRIPT_RESTRICT_LEVEL
    );
  }
};
function parseCompilerDiagnostics(output) {
  const diagnostics = [];
  let current, values;
  const flush = () => {
    if (current?.file && current.type && current.message !== void 0)
      diagnostics.push({
        code: current.type,
        severity: "error",
        file: current.file,
        line: current.line ?? 0,
        column: current.column ?? 0,
        type: current.type,
        message: current.message,
        ...values?.length ? { validValues: values } : {}
      });
    current = void 0;
    values = void 0;
  };
  for (const raw of output.replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n/)) {
    const line = raw.trimEnd();
    const field = line.match(/^(File|Line|Column|Type|Error):\s?(.*)$/);
    if (field?.[1] === "File") {
      flush();
      current = { file: field[2].trim() };
    } else if (!current) continue;
    else if (field?.[1] === "Line") current.line = Number(field[2]);
    else if (field?.[1] === "Column") current.column = Number(field[2]);
    else if (field?.[1] === "Type") current.type = field[2].trim();
    else if (field?.[1] === "Error") current.message = field[2].trim();
    else if (!line.trim()) flush();
    else if (current.message === void 0) continue;
    else {
      const valid = line.match(/^Valid (?:parameters|values|options) are:\s*(.*)$/i);
      if (valid) values = valid[1].trim() ? [valid[1].trim()] : [];
      else if (values && /^-\S/.test(line.trim())) values.push(line.trim().slice(1));
      else current.message += " " + line.trim();
    }
  }
  flush();
  return diagnostics;
}
async function diagnosticHint(root, diagnostic) {
  if (!diagnostic.line || !/^INVALID_PROPERTY|MISSING_REQUIRED|_NOT_FOUND$|INVALID_/.test(diagnostic.type))
    return;
  try {
    const file = await contained(root, diagnostic.file);
    const lines = (await readFile5(file, "utf8")).split(/\r?\n/);
    const indent = (text) => text.match(/^\s*/)[0].length;
    const open4 = /^\s*([A-Za-z][\w-]*)(?:\s+([^\s({]+))?\s*[({]\s*$/;
    const chain = [];
    let level = indent(lines[diagnostic.line - 1] ?? "");
    for (let i = diagnostic.line - 2; i >= 0 && chain.length < 3; i--) {
      const text = lines[i];
      if (!text.trim() || indent(text) >= level) continue;
      const match = text.match(open4);
      if (!match) continue;
      level = indent(text);
      const kind = match[1], name = match[2];
      let label = name ? `${kind} ${name}` : kind;
      if (name) {
        for (let j2 = i + 1; j2 < lines.length && j2 < i + 40; j2++) {
          const property = lines[j2].match(/^\s*type:\s*(\S+)/);
          if (indent(lines[j2]) <= level && lines[j2].trim()) break;
          if (property && indent(lines[j2]) === level + (indent(lines[i + 1] ?? "") - level || 4)) {
            label += ` (type: ${property[1]})`;
            break;
          }
        }
      }
      chain.push(label);
    }
    return chain.length ? `inside ${chain.join(" of ")}` : void 0;
  } catch {
    return;
  }
}
async function compilerDetails(output, root) {
  const diagnostics = parseCompilerDiagnostics(output);
  if (root)
    for (const diagnostic of diagnostics) {
      const hint = await diagnosticHint(root, diagnostic);
      if (hint) diagnostic.hint = hint;
    }
  return diagnostics.length ? { diagnostics } : void 0;
}
async function compilerFault(output, root) {
  const details = await compilerDetails(output, root);
  return new Fault(
    details ? "VALIDATION_FAILED" : "VALIDATION_UNCONFIRMED",
    output.slice(0, 4e3) || "Compiler returned no success marker.",
    1,
    "failed",
    details
  );
}
function compilerSucceeded(output) {
  const success = /validat(?:ion|ed).*?(?:success|complete)|successfully.*validat|compil(?:ation|ed).*?(?:success|complete)|successfully.*compil/is.test(
    output
  );
  const counted = [...output.matchAll(/\b(\d+)\s+(?:errors?|failures?)\b/gi)].some(
    (match) => Number(match[1]) > 0
  );
  const failed = /(?:^|\n)\s*(?:error\b|errors?:)|\bwith\s+errors?\b|compile\s+errors?|\bfail(?:ed|ure)\b|\bunsuccessful\b|\bnot\s+successful\b/i.test(
    output
  );
  return success && !counted && !failed;
}
async function installSources(source, root, destination) {
  const target = await contained(root, destination);
  if (await exists(target))
    throw new Fault(
      "LOCAL_EDITS_CONFLICT",
      "Destination already exists; export remains in staging. Review and merge explicitly.",
      5,
      "conflict"
    );
  await mkdir4(path11.dirname(target), { recursive: true });
  const staging = await mkdtemp(path11.join(path11.dirname(target), ".apexrest-copy-"));
  await inventory(source);
  await cp3(source, staging, { recursive: true });
  await rename2(staging, target);
  return { directory: target, files: await inventory(target) };
}

// packages/core/src/project.ts
function resourceRoot() {
  return process.env.APEXREST_RESOURCES ?? path12.resolve(path12.dirname(fileURLToPath(import.meta.url)), "../resources");
}
async function projectInit(directory, template, alias) {
  parse(refName, alias);
  const destination = path12.resolve(directory);
  await mkdir5(path12.dirname(destination), { recursive: true });
  return withLock(destination + ".init.lock", async () => {
    if (await exists(destination)) {
      if (!(await lstat3(destination)).isDirectory() || (await readdir3(destination)).length)
        throw new Fault("LOCAL_EDITS_CONFLICT", "Project init requires an empty directory.", 5, "conflict");
    }
    const root = await mkdtemp2(destination + ".init-");
    try {
      const conflict = () => new Fault(
        "LOCAL_EDITS_CONFLICT",
        "Project init requires an empty folder or a new directory. Existing files were left unchanged.",
        5,
        "conflict"
      );
      if (!await exists(root)) await mkdir5(root, { recursive: true, mode: 448 });
      if (!(await lstat3(root)).isDirectory() || (await readdir3(root)).length !== 0) throw conflict();
      const createFile = async (file, content) => {
        try {
          await writeFile(file, content, { flag: "wx", mode: 384 });
        } catch (error) {
          if (error.code === "EEXIST") throw conflict();
          throw error;
        }
      };
      const config = {
        schemaVersion: 1,
        projectId: alias,
        application: { sourceDir: "src/apex/" + alias, alias },
        database: {
          migrationsDir: "src/database/migrations",
          packagesDir: "src/database/packages"
        },
        toolchain: { lockFile: "apexrest.toolchain.lock.json" },
        environments: {},
        artifacts: { directory: ".apexrest/artifacts", retentionDays: 7 }
      };
      await createFile(path12.join(root, "apexrest.json"), JSON.stringify(config, null, 2) + "\n");
      await createFile(path12.join(root, ".gitignore"), ".apexrest/\nnode_modules/\n.env\n");
      for (const dir of Object.values(config.database))
        await mkdir5(path12.join(root, dir), { recursive: true });
      await cp4(
        path12.join(resourceRoot(), "toolchains/toolchain.lock.json"),
        path12.join(root, config.toolchain.lockFile),
        { force: false, errorOnExist: true }
      );
      if (template !== "existing-app") {
        const generated = await new OracleAdapter().generate(alias, alias);
        await installSources(generated.directory, root, config.application.sourceDir);
        const release = await sourceRelease(path12.join(root, config.application.sourceDir));
        if (release === "26.2") {
          config.toolchain.profile = "26.2";
          await cp4(
            path12.join(resourceRoot(), "toolchains/toolchain-26.2.lock.json"),
            path12.join(root, config.toolchain.lockFile)
          );
          await atomicWrite(path12.join(root, "apexrest.json"), JSON.stringify(config, null, 2) + "\n");
        }
        if (template === "customer-crm") {
          await cp4(path12.join(resourceRoot(), "templates/customer-crm/project"), root, { recursive: true });
          await cp4(
            path12.join(
              resourceRoot(),
              "templates/customer-crm",
              release === "26.2" ? "apex-overlay-26.2" : "apex-overlay"
            ),
            path12.join(root, config.application.sourceDir),
            { recursive: true }
          );
          const { readFile: readFile6 } = await import("node:fs/promises");
          const file = path12.join(
            root,
            config.application.sourceDir,
            release === "26.2" ? "shared-components/lists/navigation-menu.apx" : "shared-components/lists.apx"
          );
          const lists = await readFile6(file, "utf8"), index = lists.lastIndexOf(")");
          if (index < 0 || !lists.includes("list navigation-menu ("))
            throw new Fault(
              "UNSUPPORTED_TEMPLATE",
              "Starter navigation does not match the reviewed fixture.",
              3
            );
          const entries = ["customers", "dashboard"].map(
            (label, i) => `    entry ${label} (
        label: ${label[0].toUpperCase() + label.slice(1)}
        layout {
            sequence: ${(i + 2) * 10}
        }
        link {
            target: {
                page: ${(i + 1) * 10}
            }
        }
    )
`
          ).join("");
          await atomicWrite(file, lists.slice(0, index) + entries + lists.slice(index));
        }
      }
      if (await exists(destination)) {
        if ((await readdir3(destination)).length) throw conflict();
        const moved = [];
        try {
          for (const entry of await readdir3(root)) {
            await rename3(path12.join(root, entry), path12.join(destination, entry));
            moved.push(entry);
          }
        } catch (error) {
          for (const entry of moved.reverse())
            await rename3(path12.join(destination, entry), path12.join(root, entry));
          throw error;
        }
      } else await rename3(root, destination);
      return {
        root: destination,
        template,
        configuration: config,
        nextActions: [
          "Configure explicit target identity and connection references.",
          "Review the target and sources; the application task authorizes its dev/QA/test import."
        ]
      };
    } finally {
      await rm6(root, { recursive: true, force: true });
    }
  }).catch((error) => {
    if (error instanceof Fault && error.code === "LOCKED")
      throw new Fault(
        "LOCAL_EDITS_CONFLICT",
        "Another project initialization owns this directory.",
        5,
        "conflict"
      );
    throw error;
  });
}
function projectSummary(ctx) {
  const environments = Object.entries(ctx.config.environments);
  return {
    projectId: ctx.config.projectId,
    root: ctx.root,
    sourceDirectories: {
      apex: ctx.config.application.sourceDir,
      ...ctx.config.database
    },
    toolchainLock: ctx.config.toolchain.lockFile,
    verification: "host-browser",
    environments: environments.slice(0, 8).map(([name, env]) => ({
      name,
      kind: env.kind,
      applicationId: env.applicationId,
      workspace: env.workspace,
      parsingSchema: env.parsingSchema
    })),
    environmentsOmitted: Math.max(0, environments.length - 8),
    targetVerified: false
  };
}
async function projectInspect(ctx, detail = "full") {
  return detail === "summary" ? projectSummary(ctx) : projectInventory(ctx);
}
async function projectInventory(ctx) {
  const sources = {};
  for (const [kind, relative] of Object.entries({
    apex: ctx.config.application.sourceDir,
    ...ctx.config.database
  })) {
    const dir = await contained(ctx.root, relative);
    sources[kind] = await exists(dir) ? await inventory(dir) : null;
  }
  return {
    projectId: ctx.config.projectId,
    root: ctx.root,
    environments: Object.entries(ctx.config.environments).map(([name, env]) => ({
      name,
      kind: env.kind,
      applicationId: env.applicationId,
      workspace: env.workspace
    })),
    sources
  };
}

// packages/installer/src/download.ts
import path13 from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { lstat as lstat4, mkdir as mkdir6, realpath as realpath5, stat as stat4 } from "node:fs/promises";
var proxyVariables = ["https_proxy", "HTTPS_PROXY", "http_proxy", "HTTP_PROXY"];
var proxyApplied = false;
function proxyStatus(env = process.env, execArgv = process.execArgv) {
  const variables = proxyVariables.filter((name) => env[name]);
  const noProxy = Boolean(env.no_proxy || env.NO_PROXY);
  const setGlobal = http.setGlobalProxyFromEnv;
  const support = !variables.length ? "not-configured" : env.NODE_USE_ENV_PROXY === "1" || execArgv.includes("--use-env-proxy") ? "node-env-proxy" : proxyApplied ? "enabled-by-installer" : typeof setGlobal === "function" ? "available" : "unsupported";
  return { configured: variables.length > 0, variables, noProxy, support };
}
function applyEnvironmentProxy() {
  const status = proxyStatus();
  if (status.support === "available") {
    http.setGlobalProxyFromEnv();
    proxyApplied = true;
    return proxyStatus();
  }
  if (status.support === "unsupported")
    throw new Fault(
      "PROXY_UNSUPPORTED",
      "A proxy is configured, but this Node.js cannot apply it to downloads. Run with NODE_USE_ENV_PROXY=1 (Node.js 24 or later), or preload the offline cache.",
      3,
      "blocked"
    );
  return status;
}
async function assertPrivateCache(cache, platform = process.platform) {
  await mkdir6(cache, { recursive: true, mode: 448 });
  if (platform === "win32") return;
  const physical = (await lstat4(cache)).isSymbolicLink() ? await realpath5(cache) : cache;
  const info = await stat4(physical);
  if (!info.isDirectory() || info.mode & 18 || info.uid !== process.getuid?.())
    throw new Fault(
      "UNSAFE_CACHE_DIRECTORY",
      `Download cache ${cache} must be a directory owned by the current user and not writable by group or others.`,
      3,
      "blocked"
    );
}
var RetriableDownload = class extends Error {
};
var delay = (ms2) => new Promise((resolve) => setTimeout(resolve, ms2));
async function withDeadline(work, ms2, controller, message) {
  let timer;
  try {
    return await Promise.race([
      work,
      new Promise((_2, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new RetriableDownload(message));
        }, ms2);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function download(artifact, cache, offline = false, fetcher = fetch, options2 = {}) {
  if (!/^[a-f0-9]{64}$/.test(artifact.sha256) || /(?:latest|main)(?:[./?]|$)/.test(artifact.url))
    throw new Fault("UNPINNED_ARTIFACT", "Downloads require an immutable version URL and SHA-256.", 2);
  await assertPrivateCache(cache);
  const file = path13.join(cache, artifact.sha256);
  if (await exists(file)) {
    if (await hashFile(file) !== artifact.sha256)
      throw new Fault(
        "INTEGRITY_FAILURE",
        "Cached artifact SHA-256 does not match the trusted lock.",
        3,
        "blocked"
      );
    return file;
  }
  if (offline)
    throw new Fault(
      "OFFLINE_CACHE_MISS",
      `Artifact ${artifact.id} ${artifact.version} is absent from the offline cache.`,
      3,
      "blocked"
    );
  if (fetcher === globalThis.fetch) applyEnvironmentProxy();
  const headersTimeoutMs = options2.headersTimeoutMs ?? 6e4, idleTimeoutMs = options2.idleTimeoutMs ?? 6e4, attempts = options2.attempts ?? 3, retryDelayMs = options2.retryDelayMs ?? 1e3;
  const attempt = async () => {
    let url = new URL(artifact.url);
    for (let redirect = 0; redirect < 6; redirect++) {
      if (url.protocol !== "https:" || url.username || url.password || !artifact.allowedHosts.includes(url.hostname))
        throw new Fault(
          "DOWNLOAD_ORIGIN_DENIED",
          "Download redirect left the vendor origin allowlist.",
          4,
          "blocked"
        );
      const controller = new AbortController();
      let response;
      try {
        response = await withDeadline(
          fetcher(url, { redirect: "manual", signal: controller.signal }),
          headersTimeoutMs,
          controller,
          `Vendor did not respond within ${Math.round(headersTimeoutMs / 1e3)} s.`
        );
      } catch (error) {
        if (error instanceof Fault) throw error;
        throw new RetriableDownload(error instanceof Error ? error.message : "Vendor download failed.");
      }
      if (response.status >= 500) {
        await response.body?.cancel().catch(() => {
        });
        throw new RetriableDownload(`Vendor returned HTTP ${response.status}.`);
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = response.headers.get("location");
        await response.body?.cancel().catch(() => {
        });
        if (!next) throw new Fault("DOWNLOAD_FAILED", "Missing redirect destination.", 3);
        url = new URL(next, url);
        continue;
      }
      if (!response.ok || !response.body) {
        await response.body?.cancel().catch(() => {
        });
        throw new Fault("DOWNLOAD_FAILED", `Vendor returned HTTP ${response.status}.`, 3, "blocked");
      }
      const reader = response.body.getReader();
      async function* verifiedChunks() {
        let size = 0;
        const digest2 = createHash("sha256");
        for (; ; ) {
          let chunk;
          try {
            chunk = await withDeadline(
              reader.read(),
              idleTimeoutMs,
              controller,
              `Download stalled for ${Math.round(idleTimeoutMs / 1e3)} s.`
            );
          } catch (error) {
            if (error instanceof Fault || error instanceof RetriableDownload) throw error;
            throw new RetriableDownload(error instanceof Error ? error.message : "Download interrupted.");
          }
          if (chunk.done) break;
          size += chunk.value.length;
          if (size > 512 * 1024 * 1024) throw new Fault("DOWNLOAD_LIMIT", "Download exceeds 512 MiB.", 3);
          digest2.update(chunk.value);
          yield chunk.value;
        }
        if (digest2.digest("hex") !== artifact.sha256)
          throw new Fault(
            "INTEGRITY_FAILURE",
            "Download SHA-256 does not match the trusted lock. Nothing was executed.",
            3,
            "blocked"
          );
      }
      try {
        await atomicWrite(file, verifiedChunks());
      } finally {
        await reader.cancel().catch(() => {
        });
      }
      return file;
    }
    throw new Fault("DOWNLOAD_REDIRECT_LIMIT", "Too many vendor redirects.", 3);
  };
  for (let index = 1; ; index++) {
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof RetriableDownload)) throw error;
      if (index >= attempts) throw new Fault("DOWNLOAD_FAILED", error.message, 3, "blocked");
      await delay(retryDelayMs * index);
    }
  }
}

// packages/installer/src/archive.ts
import path14 from "node:path";
import { mkdir as mkdir7, mkdtemp as mkdtemp3, lstat as lstat5, rm as rm7, symlink, link } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createHash as createHash2 } from "node:crypto";
import { pipeline } from "node:stream/promises";

// node_modules/tar/dist/esm/index.min.js
import Qr from "events";
import I from "fs";
import { EventEmitter as Di } from "node:events";
import Cs from "node:stream";
import { StringDecoder as Hr } from "node:string_decoder";
import cr from "node:path";
import Kt from "node:fs";
import { dirname as Fn, parse as kn } from "path";
import { EventEmitter as Dn } from "events";
import zi from "assert";
import { Buffer as Ot } from "buffer";
import * as Ps from "zlib";
import en from "zlib";
import { posix as Zt } from "node:path";
import { basename as _n } from "node:path";
import mi from "fs";
import X from "fs";
import js from "path";
import { win32 as Pn } from "node:path";
import ar from "path";
import Br from "node:fs";
import co from "node:assert";
import { randomBytes as Mr } from "node:crypto";
import u from "node:fs";
import R from "node:path";
import pr from "fs";
import wi from "node:fs";
import we from "node:path";
import k from "node:fs";
import ro from "node:fs/promises";
import Si from "node:path";
import { join as xr } from "node:path";
import v from "node:fs";
import Pr from "node:path";
var zr = Object.defineProperty;
var Ur = (s3, t) => {
  for (var e in t) zr(s3, e, { get: t[e], enumerable: true });
};
var Ds = typeof process == "object" && process ? process : { stdout: null, stderr: null };
var Wr = (s3) => !!s3 && typeof s3 == "object" && (s3 instanceof A || s3 instanceof Cs || Gr(s3) || Zr(s3));
var Gr = (s3) => !!s3 && typeof s3 == "object" && s3 instanceof Di && typeof s3.pipe == "function" && s3.pipe !== Cs.Writable.prototype.pipe;
var Zr = (s3) => !!s3 && typeof s3 == "object" && s3 instanceof Di && typeof s3.write == "function" && typeof s3.end == "function";
var Q = /* @__PURE__ */ Symbol("EOF");
var J = /* @__PURE__ */ Symbol("maybeEmitEnd");
var nt = /* @__PURE__ */ Symbol("emittedEnd");
var De = /* @__PURE__ */ Symbol("emittingEnd");
var qt = /* @__PURE__ */ Symbol("emittedError");
var Ne = /* @__PURE__ */ Symbol("closed");
var Ns = /* @__PURE__ */ Symbol("read");
var Ae = /* @__PURE__ */ Symbol("flush");
var As = /* @__PURE__ */ Symbol("flushChunk");
var z = /* @__PURE__ */ Symbol("encoding");
var Mt = /* @__PURE__ */ Symbol("decoder");
var g = /* @__PURE__ */ Symbol("flowing");
var Qt = /* @__PURE__ */ Symbol("paused");
var Bt = /* @__PURE__ */ Symbol("resume");
var b = /* @__PURE__ */ Symbol("buffer");
var N = /* @__PURE__ */ Symbol("pipes");
var _ = /* @__PURE__ */ Symbol("bufferLength");
var bi = /* @__PURE__ */ Symbol("bufferPush");
var Ie = /* @__PURE__ */ Symbol("bufferShift");
var L = /* @__PURE__ */ Symbol("objectMode");
var S = /* @__PURE__ */ Symbol("destroyed");
var _i = /* @__PURE__ */ Symbol("error");
var Oi = /* @__PURE__ */ Symbol("emitData");
var Is = /* @__PURE__ */ Symbol("emitEnd");
var Ti = /* @__PURE__ */ Symbol("emitEnd2");
var Z = /* @__PURE__ */ Symbol("async");
var xi = /* @__PURE__ */ Symbol("abort");
var Ce = /* @__PURE__ */ Symbol("aborted");
var Jt = /* @__PURE__ */ Symbol("signal");
var Rt = /* @__PURE__ */ Symbol("dataListeners");
var C = /* @__PURE__ */ Symbol("discarded");
var jt = (s3) => Promise.resolve().then(s3);
var Yr = (s3) => s3();
var Kr = (s3) => s3 === "end" || s3 === "finish" || s3 === "prefinish";
var Vr = (s3) => s3 instanceof ArrayBuffer || !!s3 && typeof s3 == "object" && s3.constructor && s3.constructor.name === "ArrayBuffer" && s3.byteLength >= 0;
var $r = (s3) => !Buffer.isBuffer(s3) && ArrayBuffer.isView(s3);
var Fe = class {
  src;
  dest;
  opts;
  ondrain;
  constructor(t, e, i) {
    this.src = t, this.dest = e, this.opts = i, this.ondrain = () => t[Bt](), this.dest.on("drain", this.ondrain);
  }
  unpipe() {
    this.dest.removeListener("drain", this.ondrain);
  }
  proxyErrors(t) {
  }
  end() {
    this.unpipe(), this.opts.end && this.dest.end();
  }
};
var Li = class extends Fe {
  unpipe() {
    this.src.removeListener("error", this.proxyErrors), super.unpipe();
  }
  constructor(t, e, i) {
    super(t, e, i), this.proxyErrors = (r) => this.dest.emit("error", r), t.on("error", this.proxyErrors);
  }
};
var Xr = (s3) => !!s3.objectMode;
var qr = (s3) => !s3.objectMode && !!s3.encoding && s3.encoding !== "buffer";
var A = class extends Di {
  [g] = false;
  [Qt] = false;
  [N] = [];
  [b] = [];
  [L];
  [z];
  [Z];
  [Mt];
  [Q] = false;
  [nt] = false;
  [De] = false;
  [Ne] = false;
  [qt] = null;
  [_] = 0;
  [S] = false;
  [Jt];
  [Ce] = false;
  [Rt] = 0;
  [C] = false;
  writable = true;
  readable = true;
  constructor(...t) {
    let e = t[0] || {};
    if (super(), e.objectMode && typeof e.encoding == "string") throw new TypeError("Encoding and objectMode may not be used together");
    Xr(e) ? (this[L] = true, this[z] = null) : qr(e) ? (this[z] = e.encoding, this[L] = false) : (this[L] = false, this[z] = null), this[Z] = !!e.async, this[Mt] = this[z] ? new Hr(this[z]) : null, e && e.debugExposeBuffer === true && Object.defineProperty(this, "buffer", { get: () => this[b] }), e && e.debugExposePipes === true && Object.defineProperty(this, "pipes", { get: () => this[N] });
    let { signal: i } = e;
    i && (this[Jt] = i, i.aborted ? this[xi]() : i.addEventListener("abort", () => this[xi]()));
  }
  get bufferLength() {
    return this[_];
  }
  get encoding() {
    return this[z];
  }
  set encoding(t) {
    throw new Error("Encoding must be set at instantiation time");
  }
  setEncoding(t) {
    throw new Error("Encoding must be set at instantiation time");
  }
  get objectMode() {
    return this[L];
  }
  set objectMode(t) {
    throw new Error("objectMode must be set at instantiation time");
  }
  get async() {
    return this[Z];
  }
  set async(t) {
    this[Z] = this[Z] || !!t;
  }
  [xi]() {
    this[Ce] = true, this.emit("abort", this[Jt]?.reason), this.destroy(this[Jt]?.reason);
  }
  get aborted() {
    return this[Ce];
  }
  set aborted(t) {
  }
  write(t, e, i) {
    if (this[Ce]) return false;
    if (this[Q]) throw new Error("write after end");
    if (this[S]) return this.emit("error", Object.assign(new Error("Cannot call write after a stream was destroyed"), { code: "ERR_STREAM_DESTROYED" })), true;
    typeof e == "function" && (i = e, e = "utf8"), e || (e = "utf8");
    let r = this[Z] ? jt : Yr;
    if (!this[L] && !Buffer.isBuffer(t)) {
      if ($r(t)) t = Buffer.from(t.buffer, t.byteOffset, t.byteLength);
      else if (Vr(t)) t = Buffer.from(t);
      else if (typeof t != "string") throw new Error("Non-contiguous data written to non-objectMode stream");
    }
    return this[L] ? (this[g] && this[_] !== 0 && this[Ae](true), this[g] ? this.emit("data", t) : this[bi](t), this[_] !== 0 && this.emit("readable"), i && r(i), this[g]) : t.length ? (typeof t == "string" && !(e === this[z] && !this[Mt]?.lastNeed) && (t = Buffer.from(t, e)), Buffer.isBuffer(t) && this[z] && (t = this[Mt].write(t)), this[g] && this[_] !== 0 && this[Ae](true), this[g] ? this.emit("data", t) : this[bi](t), this[_] !== 0 && this.emit("readable"), i && r(i), this[g]) : (this[_] !== 0 && this.emit("readable"), i && r(i), this[g]);
  }
  read(t) {
    if (this[S]) return null;
    if (this[C] = false, this[_] === 0 || t === 0 || t && t > this[_]) return this[J](), null;
    this[L] && (t = null), this[b].length > 1 && !this[L] && (this[b] = [this[z] ? this[b].join("") : Buffer.concat(this[b], this[_])]);
    let e = this[Ns](t || null, this[b][0]);
    return this[J](), e;
  }
  [Ns](t, e) {
    if (this[L]) this[Ie]();
    else {
      let i = e;
      t === i.length || t === null ? this[Ie]() : typeof i == "string" ? (this[b][0] = i.slice(t), e = i.slice(0, t), this[_] -= t) : (this[b][0] = i.subarray(t), e = i.subarray(0, t), this[_] -= t);
    }
    return this.emit("data", e), !this[b].length && !this[Q] && this.emit("drain"), e;
  }
  end(t, e, i) {
    return typeof t == "function" && (i = t, t = void 0), typeof e == "function" && (i = e, e = "utf8"), t !== void 0 && this.write(t, e), i && this.once("end", i), this[Q] = true, this.writable = false, (this[g] || !this[Qt]) && this[J](), this;
  }
  [Bt]() {
    this[S] || (!this[Rt] && !this[N].length && (this[C] = true), this[Qt] = false, this[g] = true, this.emit("resume"), this[b].length ? this[Ae]() : this[Q] ? this[J]() : this.emit("drain"));
  }
  resume() {
    return this[Bt]();
  }
  pause() {
    this[g] = false, this[Qt] = true, this[C] = false;
  }
  get destroyed() {
    return this[S];
  }
  get flowing() {
    return this[g];
  }
  get paused() {
    return this[Qt];
  }
  [bi](t) {
    this[L] ? this[_] += 1 : this[_] += t.length, this[b].push(t);
  }
  [Ie]() {
    return this[L] ? this[_] -= 1 : this[_] -= this[b][0].length, this[b].shift();
  }
  [Ae](t = false) {
    do
      ;
    while (this[As](this[Ie]()) && this[b].length);
    !t && !this[b].length && !this[Q] && this.emit("drain");
  }
  [As](t) {
    return this.emit("data", t), this[g];
  }
  pipe(t, e) {
    if (this[S]) return t;
    this[C] = false;
    let i = this[nt];
    return e = e || {}, t === Ds.stdout || t === Ds.stderr ? e.end = false : e.end = e.end !== false, e.proxyErrors = !!e.proxyErrors, i ? e.end && t.end() : (this[N].push(e.proxyErrors ? new Li(this, t, e) : new Fe(this, t, e)), this[Z] ? jt(() => this[Bt]()) : this[Bt]()), t;
  }
  unpipe(t) {
    let e = this[N].find((i) => i.dest === t);
    e && (this[N].length === 1 ? (this[g] && this[Rt] === 0 && (this[g] = false), this[N] = []) : this[N].splice(this[N].indexOf(e), 1), e.unpipe());
  }
  addListener(t, e) {
    return this.on(t, e);
  }
  on(t, e) {
    let i = super.on(t, e);
    if (t === "data") this[C] = false, this[Rt]++, !this[N].length && !this[g] && this[Bt]();
    else if (t === "readable" && this[_] !== 0) super.emit("readable");
    else if (Kr(t) && this[nt]) super.emit(t), this.removeAllListeners(t);
    else if (t === "error" && this[qt]) {
      let r = e;
      this[Z] ? jt(() => r.call(this, this[qt])) : r.call(this, this[qt]);
    }
    return i;
  }
  removeListener(t, e) {
    return this.off(t, e);
  }
  off(t, e) {
    let i = super.off(t, e);
    return t === "data" && (this[Rt] = this.listeners("data").length, this[Rt] === 0 && !this[C] && !this[N].length && (this[g] = false)), i;
  }
  removeAllListeners(t) {
    let e = super.removeAllListeners(t);
    return (t === "data" || t === void 0) && (this[Rt] = 0, !this[C] && !this[N].length && (this[g] = false)), e;
  }
  get emittedEnd() {
    return this[nt];
  }
  [J]() {
    !this[De] && !this[nt] && !this[S] && this[b].length === 0 && this[Q] && (this[De] = true, this.emit("end"), this.emit("prefinish"), this.emit("finish"), this[Ne] && this.emit("close"), this[De] = false);
  }
  emit(t, ...e) {
    let i = e[0];
    if (t !== "error" && t !== "close" && t !== S && this[S]) return false;
    if (t === "data") return !this[L] && !i ? false : this[Z] ? (jt(() => this[Oi](i)), true) : this[Oi](i);
    if (t === "end") return this[Is]();
    if (t === "close") {
      if (this[Ne] = true, !this[nt] && !this[S]) return false;
      let n = super.emit("close");
      return this.removeAllListeners("close"), n;
    } else if (t === "error") {
      this[qt] = i, super.emit(_i, i);
      let n = !this[Jt] || this.listeners("error").length ? super.emit("error", i) : false;
      return this[J](), n;
    } else if (t === "resume") {
      let n = super.emit("resume");
      return this[J](), n;
    } else if (t === "finish" || t === "prefinish") {
      let n = super.emit(t);
      return this.removeAllListeners(t), n;
    }
    let r = super.emit(t, ...e);
    return this[J](), r;
  }
  [Oi](t) {
    for (let i of this[N]) i.dest.write(t) === false && this.pause();
    let e = this[C] ? false : super.emit("data", t);
    return this[J](), e;
  }
  [Is]() {
    return this[nt] ? false : (this[nt] = true, this.readable = false, this[Z] ? (jt(() => this[Ti]()), true) : this[Ti]());
  }
  [Ti]() {
    if (this[Mt]) {
      let e = this[Mt].end();
      if (e) {
        for (let i of this[N]) i.dest.write(e);
        this[C] || super.emit("data", e);
      }
    }
    for (let e of this[N]) e.end();
    let t = super.emit("end");
    return this.removeAllListeners("end"), t;
  }
  async collect() {
    let t = Object.assign([], { dataLength: 0 });
    this[L] || (t.dataLength = 0);
    let e = this.promise();
    return this.on("data", (i) => {
      t.push(i), this[L] || (t.dataLength += i.length);
    }), await e, t;
  }
  async concat() {
    if (this[L]) throw new Error("cannot concat in objectMode");
    let t = await this.collect();
    return this[z] ? t.join("") : Buffer.concat(t, t.dataLength);
  }
  async promise() {
    return new Promise((t, e) => {
      this.on(S, () => e(new Error("stream destroyed"))), this.on("error", (i) => e(i)), this.on("end", () => t());
    });
  }
  [Symbol.asyncIterator]() {
    this[C] = false;
    let t = false, e = async () => (this.pause(), t = true, { value: void 0, done: true });
    return { next: () => {
      if (t) return e();
      let r = this.read();
      if (r !== null) return Promise.resolve({ done: false, value: r });
      if (this[Q]) return e();
      let n, o, h = (d) => {
        this.off("data", a), this.off("end", l), this.off(S, c), e(), o(d);
      }, a = (d) => {
        this.off("error", h), this.off("end", l), this.off(S, c), this.pause(), n({ value: d, done: !!this[Q] });
      }, l = () => {
        this.off("error", h), this.off("data", a), this.off(S, c), e(), n({ done: true, value: void 0 });
      }, c = () => h(new Error("stream destroyed"));
      return new Promise((d, y) => {
        o = y, n = d, this.once(S, c), this.once("error", h), this.once("end", l), this.once("data", a);
      });
    }, throw: e, return: e, [Symbol.asyncIterator]() {
      return this;
    }, [Symbol.asyncDispose]: async () => {
    } };
  }
  [Symbol.iterator]() {
    this[C] = false;
    let t = false, e = () => (this.pause(), this.off(_i, e), this.off(S, e), this.off("end", e), t = true, { done: true, value: void 0 }), i = () => {
      if (t) return e();
      let r = this.read();
      return r === null ? e() : { done: false, value: r };
    };
    return this.once("end", e), this.once(_i, e), this.once(S, e), { next: i, throw: e, return: e, [Symbol.iterator]() {
      return this;
    }, [Symbol.dispose]: () => {
    } };
  }
  destroy(t) {
    if (this[S]) return t ? this.emit("error", t) : this.emit(S), this;
    this[S] = true, this[C] = true, this[b].length = 0, this[_] = 0;
    let e = this;
    return typeof e.close == "function" && !this[Ne] && e.close(), t ? this.emit("error", t) : this.emit(S), this;
  }
  static get isStream() {
    return Wr;
  }
};
var Jr = I.writev;
var ht = /* @__PURE__ */ Symbol("_autoClose");
var H = /* @__PURE__ */ Symbol("_close");
var te = /* @__PURE__ */ Symbol("_ended");
var m = /* @__PURE__ */ Symbol("_fd");
var Ni = /* @__PURE__ */ Symbol("_finished");
var tt = /* @__PURE__ */ Symbol("_flags");
var Ai = /* @__PURE__ */ Symbol("_flush");
var ki = /* @__PURE__ */ Symbol("_handleChunk");
var vi = /* @__PURE__ */ Symbol("_makeBuf");
var ie = /* @__PURE__ */ Symbol("_mode");
var ke = /* @__PURE__ */ Symbol("_needDrain");
var Ut = /* @__PURE__ */ Symbol("_onerror");
var Ht = /* @__PURE__ */ Symbol("_onopen");
var Ii = /* @__PURE__ */ Symbol("_onread");
var Pt = /* @__PURE__ */ Symbol("_onwrite");
var at = /* @__PURE__ */ Symbol("_open");
var U = /* @__PURE__ */ Symbol("_path");
var ot = /* @__PURE__ */ Symbol("_pos");
var Y = /* @__PURE__ */ Symbol("_queue");
var zt = /* @__PURE__ */ Symbol("_read");
var Ci = /* @__PURE__ */ Symbol("_readSize");
var j = /* @__PURE__ */ Symbol("_reading");
var ee = /* @__PURE__ */ Symbol("_remain");
var Fi = /* @__PURE__ */ Symbol("_size");
var ve = /* @__PURE__ */ Symbol("_write");
var gt = /* @__PURE__ */ Symbol("_writing");
var Me = /* @__PURE__ */ Symbol("_defaultFlag");
var bt = /* @__PURE__ */ Symbol("_errored");
var _t = class extends A {
  [bt] = false;
  [m];
  [U];
  [Ci];
  [j] = false;
  [Fi];
  [ee];
  [ht];
  constructor(t, e) {
    if (e = e || {}, super(e), this.readable = true, this.writable = false, typeof t != "string") throw new TypeError("path must be a string");
    this[bt] = false, this[m] = typeof e.fd == "number" ? e.fd : void 0, this[U] = t, this[Ci] = e.readSize || 16 * 1024 * 1024, this[j] = false, this[Fi] = typeof e.size == "number" ? e.size : 1 / 0, this[ee] = this[Fi], this[ht] = typeof e.autoClose == "boolean" ? e.autoClose : true, typeof this[m] == "number" ? this[zt]() : this[at]();
  }
  get fd() {
    return this[m];
  }
  get path() {
    return this[U];
  }
  write() {
    throw new TypeError("this is a readable stream");
  }
  end() {
    throw new TypeError("this is a readable stream");
  }
  [at]() {
    I.open(this[U], "r", (t, e) => this[Ht](t, e));
  }
  [Ht](t, e) {
    t ? this[Ut](t) : (this[m] = e, this.emit("open", e), this[zt]());
  }
  [vi]() {
    return Buffer.allocUnsafe(Math.min(this[Ci], this[ee]));
  }
  [zt]() {
    if (!this[j]) {
      this[j] = true;
      let t = this[vi]();
      if (t.length === 0) return process.nextTick(() => this[Ii](null, 0, t));
      I.read(this[m], t, 0, t.length, null, (e, i, r) => this[Ii](e, i, r));
    }
  }
  [Ii](t, e, i) {
    this[j] = false, t ? this[Ut](t) : this[ki](e, i) && this[zt]();
  }
  [H]() {
    if (this[ht] && typeof this[m] == "number") {
      let t = this[m];
      this[m] = void 0, I.close(t, (e) => e ? this.emit("error", e) : this.emit("close"));
    }
  }
  [Ut](t) {
    this[j] = true, this[H](), this.emit("error", t);
  }
  [ki](t, e) {
    let i = false;
    return this[ee] -= t, t > 0 && (i = super.write(t < e.length ? e.subarray(0, t) : e)), (t === 0 || this[ee] <= 0) && (i = false, this[H](), super.end()), i;
  }
  emit(t, ...e) {
    switch (t) {
      case "prefinish":
      case "finish":
        return false;
      case "drain":
        return typeof this[m] == "number" && this[zt](), false;
      case "error":
        return this[bt] ? false : (this[bt] = true, super.emit(t, ...e));
      default:
        return super.emit(t, ...e);
    }
  }
};
var Be = class extends _t {
  [at]() {
    let t = true;
    try {
      this[Ht](null, I.openSync(this[U], "r")), t = false;
    } finally {
      t && this[H]();
    }
  }
  [zt]() {
    let t = true;
    try {
      if (!this[j]) {
        this[j] = true;
        do {
          let e = this[vi](), i = e.length === 0 ? 0 : I.readSync(this[m], e, 0, e.length, null);
          if (!this[ki](i, e)) break;
        } while (true);
        this[j] = false;
      }
      t = false;
    } finally {
      t && this[H]();
    }
  }
  [H]() {
    if (this[ht] && typeof this[m] == "number") {
      let t = this[m];
      this[m] = void 0, I.closeSync(t), this.emit("close");
    }
  }
};
var et = class extends Qr {
  readable = false;
  writable = true;
  [bt] = false;
  [gt] = false;
  [te] = false;
  [Y] = [];
  [ke] = false;
  [U];
  [ie];
  [ht];
  [m];
  [Me];
  [tt];
  [Ni] = false;
  [ot];
  constructor(t, e) {
    e = e || {}, super(e), this[U] = t, this[m] = typeof e.fd == "number" ? e.fd : void 0, this[ie] = e.mode === void 0 ? 438 : e.mode, this[ot] = typeof e.start == "number" ? e.start : void 0, this[ht] = typeof e.autoClose == "boolean" ? e.autoClose : true;
    let i = this[ot] !== void 0 ? "r+" : "w";
    this[Me] = e.flags === void 0, this[tt] = e.flags === void 0 ? i : e.flags, this[m] === void 0 && this[at]();
  }
  emit(t, ...e) {
    if (t === "error") {
      if (this[bt]) return false;
      this[bt] = true;
    }
    return super.emit(t, ...e);
  }
  get fd() {
    return this[m];
  }
  get path() {
    return this[U];
  }
  [Ut](t) {
    this[H](), this[gt] = true, this.emit("error", t);
  }
  [at]() {
    I.open(this[U], this[tt], this[ie], (t, e) => this[Ht](t, e));
  }
  [Ht](t, e) {
    this[Me] && this[tt] === "r+" && t && t.code === "ENOENT" ? (this[tt] = "w", this[at]()) : t ? this[Ut](t) : (this[m] = e, this.emit("open", e), this[gt] || this[Ai]());
  }
  end(t, e) {
    return t && this.write(t, e), this[te] = true, !this[gt] && !this[Y].length && typeof this[m] == "number" && this[Pt](null, 0), this;
  }
  write(t, e) {
    return typeof t == "string" && (t = Buffer.from(t, e)), this[te] ? (this.emit("error", new Error("write() after end()")), false) : this[m] === void 0 || this[gt] || this[Y].length ? (this[Y].push(t), this[ke] = true, false) : (this[gt] = true, this[ve](t), true);
  }
  [ve](t) {
    I.write(this[m], t, 0, t.length, this[ot], (e, i) => this[Pt](e, i));
  }
  [Pt](t, e) {
    t ? this[Ut](t) : (this[ot] !== void 0 && typeof e == "number" && (this[ot] += e), this[Y].length ? this[Ai]() : (this[gt] = false, this[te] && !this[Ni] ? (this[Ni] = true, this[H](), this.emit("finish")) : this[ke] && (this[ke] = false, this.emit("drain"))));
  }
  [Ai]() {
    if (this[Y].length === 0) this[te] && this[Pt](null, 0);
    else if (this[Y].length === 1) this[ve](this[Y].pop());
    else {
      let t = this[Y];
      this[Y] = [], Jr(this[m], t, this[ot], (e, i) => this[Pt](e, i));
    }
  }
  [H]() {
    if (this[ht] && typeof this[m] == "number") {
      let t = this[m];
      this[m] = void 0, I.close(t, (e) => e ? this.emit("error", e) : this.emit("close"));
    }
  }
};
var Wt = class extends et {
  [at]() {
    let t;
    if (this[Me] && this[tt] === "r+") try {
      t = I.openSync(this[U], this[tt], this[ie]);
    } catch (e) {
      if (e?.code === "ENOENT") return this[tt] = "w", this[at]();
      throw e;
    }
    else t = I.openSync(this[U], this[tt], this[ie]);
    this[Ht](null, t);
  }
  [H]() {
    if (this[ht] && typeof this[m] == "number") {
      let t = this[m];
      this[m] = void 0, I.closeSync(t), this.emit("close");
    }
  }
  [ve](t) {
    let e = true;
    try {
      this[Pt](null, I.writeSync(this[m], t, 0, t.length, this[ot])), e = false;
    } finally {
      if (e) try {
        this[H]();
      } catch {
      }
    }
  }
};
var jr = /* @__PURE__ */ new Map([["C", "cwd"], ["f", "file"], ["z", "gzip"], ["P", "preservePaths"], ["U", "unlink"], ["strip-components", "strip"], ["stripComponents", "strip"], ["keep-newer", "newer"], ["keepNewer", "newer"], ["keep-newer-files", "newer"], ["keepNewerFiles", "newer"], ["k", "keep"], ["keep-existing", "keep"], ["keepExisting", "keep"], ["m", "noMtime"], ["no-mtime", "noMtime"], ["p", "preserveOwner"], ["L", "follow"], ["h", "follow"], ["onentry", "onReadEntry"]]);
var Fs = (s3) => !!s3.sync && !!s3.file;
var ks = (s3) => !s3.sync && !!s3.file;
var vs = (s3) => !!s3.sync && !s3.file;
var Ms = (s3) => !s3.sync && !s3.file;
var Bs = (s3) => !!s3.file;
var tn = (s3) => {
  let t = jr.get(s3);
  return t || s3;
};
var se = (s3 = {}) => {
  if (!s3) return {};
  let t = {};
  for (let [e, i] of Object.entries(s3)) {
    let r = tn(e);
    t[r] = i;
  }
  return t.chmod === void 0 && t.noChmod === false && (t.chmod = true), delete t.noChmod, t;
};
var K = (s3, t, e, i, r) => Object.assign((n = [], o, h) => {
  Array.isArray(n) && (o = n, n = {}), typeof o == "function" && (h = o, o = void 0), o = o ? Array.from(o) : [];
  let a = se(n);
  if (r?.(a, o), Fs(a)) {
    if (typeof h == "function") throw new TypeError("callback not supported for sync tar functions");
    return s3(a, o);
  } else if (ks(a)) {
    let l = t(a, o);
    return h ? l.then(() => h(), h) : l;
  } else if (vs(a)) {
    if (typeof h == "function") throw new TypeError("callback not supported for sync tar functions");
    return e(a, o);
  } else if (Ms(a)) {
    if (typeof h == "function") throw new TypeError("callback only supported with file option");
    return i(a, o);
  }
  throw new Error("impossible options??");
}, { syncFile: s3, asyncFile: t, syncNoFile: e, asyncNoFile: i, validate: r });
var sn = en.constants || { ZLIB_VERNUM: 4736 };
var M = Object.freeze(Object.assign(/* @__PURE__ */ Object.create(null), { Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4, Z_BLOCK: 5, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_MEM_ERROR: -4, Z_BUF_ERROR: -5, Z_VERSION_ERROR: -6, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4, Z_DEFAULT_STRATEGY: 0, DEFLATE: 1, INFLATE: 2, GZIP: 3, GUNZIP: 4, DEFLATERAW: 5, INFLATERAW: 6, UNZIP: 7, BROTLI_DECODE: 8, BROTLI_ENCODE: 9, Z_MIN_WINDOWBITS: 8, Z_MAX_WINDOWBITS: 15, Z_DEFAULT_WINDOWBITS: 15, Z_MIN_CHUNK: 64, Z_MAX_CHUNK: 1 / 0, Z_DEFAULT_CHUNK: 16384, Z_MIN_MEMLEVEL: 1, Z_MAX_MEMLEVEL: 9, Z_DEFAULT_MEMLEVEL: 8, Z_MIN_LEVEL: -1, Z_MAX_LEVEL: 9, Z_DEFAULT_LEVEL: -1, BROTLI_OPERATION_PROCESS: 0, BROTLI_OPERATION_FLUSH: 1, BROTLI_OPERATION_FINISH: 2, BROTLI_OPERATION_EMIT_METADATA: 3, BROTLI_MODE_GENERIC: 0, BROTLI_MODE_TEXT: 1, BROTLI_MODE_FONT: 2, BROTLI_DEFAULT_MODE: 0, BROTLI_MIN_QUALITY: 0, BROTLI_MAX_QUALITY: 11, BROTLI_DEFAULT_QUALITY: 11, BROTLI_MIN_WINDOW_BITS: 10, BROTLI_MAX_WINDOW_BITS: 24, BROTLI_LARGE_MAX_WINDOW_BITS: 30, BROTLI_DEFAULT_WINDOW: 22, BROTLI_MIN_INPUT_BLOCK_BITS: 16, BROTLI_MAX_INPUT_BLOCK_BITS: 24, BROTLI_PARAM_MODE: 0, BROTLI_PARAM_QUALITY: 1, BROTLI_PARAM_LGWIN: 2, BROTLI_PARAM_LGBLOCK: 3, BROTLI_PARAM_DISABLE_LITERAL_CONTEXT_MODELING: 4, BROTLI_PARAM_SIZE_HINT: 5, BROTLI_PARAM_LARGE_WINDOW: 6, BROTLI_PARAM_NPOSTFIX: 7, BROTLI_PARAM_NDIRECT: 8, BROTLI_DECODER_RESULT_ERROR: 0, BROTLI_DECODER_RESULT_SUCCESS: 1, BROTLI_DECODER_RESULT_NEEDS_MORE_INPUT: 2, BROTLI_DECODER_RESULT_NEEDS_MORE_OUTPUT: 3, BROTLI_DECODER_PARAM_DISABLE_RING_BUFFER_REALLOCATION: 0, BROTLI_DECODER_PARAM_LARGE_WINDOW: 1, BROTLI_DECODER_NO_ERROR: 0, BROTLI_DECODER_SUCCESS: 1, BROTLI_DECODER_NEEDS_MORE_INPUT: 2, BROTLI_DECODER_NEEDS_MORE_OUTPUT: 3, BROTLI_DECODER_ERROR_FORMAT_EXUBERANT_NIBBLE: -1, BROTLI_DECODER_ERROR_FORMAT_RESERVED: -2, BROTLI_DECODER_ERROR_FORMAT_EXUBERANT_META_NIBBLE: -3, BROTLI_DECODER_ERROR_FORMAT_SIMPLE_HUFFMAN_ALPHABET: -4, BROTLI_DECODER_ERROR_FORMAT_SIMPLE_HUFFMAN_SAME: -5, BROTLI_DECODER_ERROR_FORMAT_CL_SPACE: -6, BROTLI_DECODER_ERROR_FORMAT_HUFFMAN_SPACE: -7, BROTLI_DECODER_ERROR_FORMAT_CONTEXT_MAP_REPEAT: -8, BROTLI_DECODER_ERROR_FORMAT_BLOCK_LENGTH_1: -9, BROTLI_DECODER_ERROR_FORMAT_BLOCK_LENGTH_2: -10, BROTLI_DECODER_ERROR_FORMAT_TRANSFORM: -11, BROTLI_DECODER_ERROR_FORMAT_DICTIONARY: -12, BROTLI_DECODER_ERROR_FORMAT_WINDOW_BITS: -13, BROTLI_DECODER_ERROR_FORMAT_PADDING_1: -14, BROTLI_DECODER_ERROR_FORMAT_PADDING_2: -15, BROTLI_DECODER_ERROR_FORMAT_DISTANCE: -16, BROTLI_DECODER_ERROR_DICTIONARY_NOT_SET: -19, BROTLI_DECODER_ERROR_INVALID_ARGUMENTS: -20, BROTLI_DECODER_ERROR_ALLOC_CONTEXT_MODES: -21, BROTLI_DECODER_ERROR_ALLOC_TREE_GROUPS: -22, BROTLI_DECODER_ERROR_ALLOC_CONTEXT_MAP: -25, BROTLI_DECODER_ERROR_ALLOC_RING_BUFFER_1: -26, BROTLI_DECODER_ERROR_ALLOC_RING_BUFFER_2: -27, BROTLI_DECODER_ERROR_ALLOC_BLOCK_TYPE_TREES: -30, BROTLI_DECODER_ERROR_UNREACHABLE: -31 }, sn));
var rn = Ot.concat;
var zs = Object.getOwnPropertyDescriptor(Ot, "concat");
var nn = (s3) => s3;
var Bi = zs?.writable === true || zs?.set !== void 0 ? (s3) => {
  Ot.concat = s3 ? nn : rn;
} : (s3) => {
};
var Tt = /* @__PURE__ */ Symbol("_superWrite");
var Gt = class extends Error {
  code;
  errno;
  constructor(t, e) {
    super("zlib: " + t.message, { cause: t }), this.code = t.code, this.errno = t.errno, this.code || (this.code = "ZLIB_ERROR"), this.message = "zlib: " + t.message, Error.captureStackTrace(this, e ?? this.constructor);
  }
  get name() {
    return "ZlibError";
  }
};
var Pi = /* @__PURE__ */ Symbol("flushFlag");
var re = class extends A {
  #t = false;
  #i = false;
  #s;
  #n;
  #r;
  #e;
  #o;
  get sawError() {
    return this.#t;
  }
  get handle() {
    return this.#e;
  }
  get flushFlag() {
    return this.#s;
  }
  constructor(t, e) {
    if (!t || typeof t != "object") throw new TypeError("invalid options for ZlibBase constructor");
    if (super(t), this.#s = t.flush ?? 0, this.#n = t.finishFlush ?? 0, this.#r = t.fullFlushFlag ?? 0, typeof Ps[e] != "function") throw new TypeError("Compression method not supported: " + e);
    try {
      this.#e = new Ps[e](t);
    } catch (i) {
      throw new Gt(i, this.constructor);
    }
    this.#o = (i) => {
      this.#t || (this.#t = true, this.close(), this.emit("error", i));
    }, this.#e?.on("error", (i) => this.#o(new Gt(i))), this.once("end", () => this.close);
  }
  close() {
    this.#e && (this.#e.close(), this.#e = void 0, this.emit("close"));
  }
  reset() {
    if (!this.#t) return zi(this.#e, "zlib binding closed"), this.#e.reset?.();
  }
  flush(t) {
    this.ended || (typeof t != "number" && (t = this.#r), this.write(Object.assign(Ot.alloc(0), { [Pi]: t })));
  }
  end(t, e, i) {
    return typeof t == "function" && (i = t, e = void 0, t = void 0), typeof e == "function" && (i = e, e = void 0), t && (e ? this.write(t, e) : this.write(t)), this.flush(this.#n), this.#i = true, super.end(i);
  }
  get ended() {
    return this.#i;
  }
  [Tt](t) {
    return super.write(t);
  }
  write(t, e, i) {
    if (typeof e == "function" && (i = e, e = "utf8"), typeof t == "string" && (t = Ot.from(t, e)), this.#t) return;
    zi(this.#e, "zlib binding closed");
    let r = this.#e._handle, n = r.close;
    r.close = () => {
    };
    let o = this.#e.close;
    this.#e.close = () => {
    }, Bi(true);
    let h;
    try {
      let l = typeof t[Pi] == "number" ? t[Pi] : this.#s;
      h = this.#e._processChunk(t, l), Bi(false);
    } catch (l) {
      Bi(false), this.#o(new Gt(l, this.write));
    } finally {
      this.#e && (this.#e._handle = r, r.close = n, this.#e.close = o, this.#e.removeAllListeners("error"));
    }
    this.#e && this.#e.on("error", (l) => this.#o(new Gt(l, this.write)));
    let a;
    if (h) if (Array.isArray(h) && h.length > 0) {
      let l = h[0];
      a = this[Tt](Ot.from(l));
      for (let c = 1; c < h.length; c++) a = this[Tt](h[c]);
    } else a = this[Tt](Ot.from(h));
    return i && i(), a;
  }
};
var Pe = class extends re {
  #t;
  #i;
  constructor(t, e) {
    t = t || {}, t.flush = t.flush || M.Z_NO_FLUSH, t.finishFlush = t.finishFlush || M.Z_FINISH, t.fullFlushFlag = M.Z_FULL_FLUSH, super(t, e), this.#t = t.level, this.#i = t.strategy;
  }
  params(t, e) {
    if (!this.sawError) {
      if (!this.handle) throw new Error("cannot switch params when binding is closed");
      if (!this.handle.params) throw new Error("not supported in this implementation");
      if (this.#t !== t || this.#i !== e) {
        this.flush(M.Z_SYNC_FLUSH), zi(this.handle, "zlib binding closed");
        let i = this.handle.flush;
        this.handle.flush = (r, n) => {
          typeof r == "function" && (n = r, r = this.flushFlag), this.flush(r), n?.();
        };
        try {
          this.handle.params(t, e);
        } finally {
          this.handle.flush = i;
        }
        this.handle && (this.#t = t, this.#i = e);
      }
    }
  }
};
var ze = class extends Pe {
  #t;
  constructor(t) {
    super(t, "Gzip"), this.#t = t && !!t.portable;
  }
  [Tt](t) {
    return this.#t ? (this.#t = false, t[9] = 255, super[Tt](t)) : super[Tt](t);
  }
};
var Ue = class extends Pe {
  constructor(t) {
    super(t, "Unzip");
  }
};
var He = class extends re {
  constructor(t, e) {
    t = t || {}, t.flush = t.flush || M.BROTLI_OPERATION_PROCESS, t.finishFlush = t.finishFlush || M.BROTLI_OPERATION_FINISH, t.fullFlushFlag = M.BROTLI_OPERATION_FLUSH, super(t, e);
  }
};
var We = class extends He {
  constructor(t) {
    super(t, "BrotliCompress");
  }
};
var Ge = class extends He {
  constructor(t) {
    super(t, "BrotliDecompress");
  }
};
var Ze = class extends re {
  constructor(t, e) {
    t = t || {}, t.flush = t.flush || M.ZSTD_e_continue, t.finishFlush = t.finishFlush || M.ZSTD_e_end, t.fullFlushFlag = M.ZSTD_e_flush, super(t, e);
  }
};
var Ye = class extends Ze {
  constructor(t) {
    super(t, "ZstdCompress");
  }
};
var Ke = class extends Ze {
  constructor(t) {
    super(t, "ZstdDecompress");
  }
};
var Us = (s3, t) => {
  if (Number.isSafeInteger(s3)) s3 < 0 ? an(s3, t) : hn(s3, t);
  else throw Error("cannot encode number outside of javascript safe integer range");
  return t;
};
var hn = (s3, t) => {
  t[0] = 128;
  for (var e = t.length; e > 1; e--) t[e - 1] = s3 & 255, s3 = Math.floor(s3 / 256);
};
var an = (s3, t) => {
  t[0] = 255;
  var e = false;
  s3 = s3 * -1;
  for (var i = t.length; i > 1; i--) {
    var r = s3 & 255;
    s3 = Math.floor(s3 / 256), e ? t[i - 1] = Ws(r) : r === 0 ? t[i - 1] = 0 : (e = true, t[i - 1] = Gs(r));
  }
};
var Hs = (s3) => {
  let t = s3[0], e = t === 128 ? cn(s3.subarray(1, s3.length)) : t === 255 ? ln(s3) : null;
  if (e === null) throw Error("invalid base256 encoding");
  if (!Number.isSafeInteger(e)) throw Error("parsed number outside of javascript safe integer range");
  return e;
};
var ln = (s3) => {
  for (var t = s3.length, e = 0, i = false, r = t - 1; r > -1; r--) {
    var n = Number(s3[r]), o;
    i ? o = Ws(n) : n === 0 ? o = n : (i = true, o = Gs(n)), o !== 0 && (e -= o * Math.pow(256, t - r - 1));
  }
  return e;
};
var cn = (s3) => {
  for (var t = s3.length, e = 0, i = t - 1; i > -1; i--) {
    var r = Number(s3[i]);
    r !== 0 && (e += r * Math.pow(256, t - i - 1));
  }
  return e;
};
var Ws = (s3) => (255 ^ s3) & 255;
var Gs = (s3) => (255 ^ s3) + 1 & 255;
var Hi = {};
Ur(Hi, { code: () => Ve, isCode: () => ne, isName: () => dn, name: () => oe, normalFsTypes: () => Ui });
var ne = (s3) => oe.has(s3);
var dn = (s3) => Ve.has(s3);
var Ui = /* @__PURE__ */ new Set(["0", "", "1", "2", "3", "4", "5", "6", "7", "D"]);
var oe = /* @__PURE__ */ new Map([["0", "File"], ["", "OldFile"], ["1", "Link"], ["2", "SymbolicLink"], ["3", "CharacterDevice"], ["4", "BlockDevice"], ["5", "Directory"], ["6", "FIFO"], ["7", "ContiguousFile"], ["g", "GlobalExtendedHeader"], ["x", "ExtendedHeader"], ["A", "SolarisACL"], ["D", "GNUDumpDir"], ["I", "Inode"], ["K", "NextFileHasLongLinkpath"], ["L", "NextFileHasLongPath"], ["M", "ContinuationFile"], ["N", "OldGnuLongPath"], ["S", "SparseFile"], ["V", "TapeVolumeHeader"], ["X", "OldExtendedHeader"]]);
var Ve = new Map(Array.from(oe).map((s3) => [s3[1], s3[0]]));
var un = (s3) => s3 === void 0 || s3 < 0 ? void 0 : s3;
var F = class {
  cksumValid = false;
  needPax = false;
  nullBlock = false;
  block;
  path;
  mode;
  uid;
  gid;
  size;
  cksum;
  #t = "Unsupported";
  linkpath;
  uname;
  gname;
  devmaj = 0;
  devmin = 0;
  atime;
  ctime;
  mtime;
  charset;
  comment;
  constructor(t, e = 0, i, r) {
    Buffer.isBuffer(t) ? this.decode(t, e || 0, i, r) : t && this.#i(t);
  }
  decode(t, e, i, r) {
    if (e || (e = 0), !t || !(t.length >= e + 512)) throw new Error("need 512 bytes for header");
    let n = xt(t, e + 156, 1), o = Ui.has(n), h = o ? i : void 0, a = o ? r : void 0;
    if (this.path = h?.path ?? xt(t, e, 100), this.mode = h?.mode ?? a?.mode ?? lt(t, e + 100, 8), this.uid = h?.uid ?? a?.uid ?? lt(t, e + 108, 8), this.gid = h?.gid ?? a?.gid ?? lt(t, e + 116, 8), this.size = un(h?.size ?? a?.size ?? lt(t, e + 124, 12)), this.mtime = h?.mtime ?? a?.mtime ?? Wi(t, e + 136, 12), this.cksum = lt(t, e + 148, 12), a && this.#i(a, true), h && this.#i(h), ne(n) && (this.#t = n || "0"), this.#t === "0" && this.path.slice(-1) === "/" && (this.#t = "5"), this.#t === "5" && (this.size = 0), this.linkpath = xt(t, e + 157, 100), t.subarray(e + 257, e + 265).toString() === "ustar\x0000") if (this.uname = h?.uname ?? a?.uname ?? xt(t, e + 265, 32), this.gname = h?.gname ?? a?.gname ?? xt(t, e + 297, 32), this.devmaj = h?.devmaj ?? a?.devmaj ?? lt(t, e + 329, 8) ?? 0, this.devmin = h?.devmin ?? a?.devmin ?? lt(t, e + 337, 8) ?? 0, t[e + 475] !== 0) {
      let c = xt(t, e + 345, 155);
      this.path = c + "/" + this.path;
    } else {
      let c = xt(t, e + 345, 130);
      c && (this.path = c + "/" + this.path), this.atime = i?.atime ?? r?.atime ?? Wi(t, e + 476, 12), this.ctime = i?.ctime ?? r?.ctime ?? Wi(t, e + 488, 12);
    }
    let l = 256;
    for (let c = e; c < e + 148; c++) l += t[c];
    for (let c = e + 156; c < e + 512; c++) l += t[c];
    this.cksumValid = l === this.cksum, this.cksum === void 0 && l === 256 && (this.nullBlock = true);
  }
  #i(t, e = false) {
    Object.assign(this, Object.fromEntries(Object.entries(t).filter(([i, r]) => !(r == null || i === "size" && Number(r) < 0 || i === "path" && e || i === "linkpath" && e || i === "global"))));
  }
  encode(t, e = 0) {
    if (t || (t = this.block = Buffer.alloc(512)), this.#t === "Unsupported" && (this.#t = "0"), !(t.length >= e + 512)) throw new Error("need 512 bytes for header");
    let i = this.ctime || this.atime ? 130 : 155, r = mn(this.path || "", i), n = r[0], o = r[1];
    this.needPax = !!r[2], this.needPax = Lt(t, e, 100, n) || this.needPax, this.needPax = ct(t, e + 100, 8, this.mode) || this.needPax, this.needPax = ct(t, e + 108, 8, this.uid) || this.needPax, this.needPax = ct(t, e + 116, 8, this.gid) || this.needPax, this.needPax = ct(t, e + 124, 12, this.size) || this.needPax, this.needPax = Gi(t, e + 136, 12, this.mtime) || this.needPax, t[e + 156] = Number(this.#t.codePointAt(0)), this.needPax = Lt(t, e + 157, 100, this.linkpath) || this.needPax, t.write("ustar\x0000", e + 257, 8), this.needPax = Lt(t, e + 265, 32, this.uname) || this.needPax, this.needPax = Lt(t, e + 297, 32, this.gname) || this.needPax, this.needPax = ct(t, e + 329, 8, this.devmaj) || this.needPax, this.needPax = ct(t, e + 337, 8, this.devmin) || this.needPax, this.needPax = Lt(t, e + 345, i, o) || this.needPax, t[e + 475] !== 0 ? this.needPax = Lt(t, e + 345, 155, o) || this.needPax : (this.needPax = Lt(t, e + 345, 130, o) || this.needPax, this.needPax = Gi(t, e + 476, 12, this.atime) || this.needPax, this.needPax = Gi(t, e + 488, 12, this.ctime) || this.needPax);
    let h = 256;
    for (let a = e; a < e + 148; a++) h += t[a];
    for (let a = e + 156; a < e + 512; a++) h += t[a];
    return this.cksum = h, ct(t, e + 148, 8, this.cksum), this.cksumValid = true, this.needPax;
  }
  get type() {
    return this.#t === "Unsupported" ? this.#t : oe.get(this.#t);
  }
  get typeKey() {
    return this.#t;
  }
  set type(t) {
    let e = String(Ve.get(t));
    if (ne(e) || e === "Unsupported") this.#t = e;
    else if (ne(t)) this.#t = t;
    else throw new TypeError("invalid entry type: " + t);
  }
};
var mn = (s3, t) => {
  let i = s3, r = "", n, o = Zt.parse(s3).root || ".";
  if (Buffer.byteLength(i) < 100) n = [i, r, false];
  else {
    r = Zt.dirname(i), i = Zt.basename(i);
    do
      Buffer.byteLength(i) <= 100 && Buffer.byteLength(r) <= t ? n = [i, r, false] : Buffer.byteLength(i) > 100 && Buffer.byteLength(r) <= t ? n = [i.slice(0, 99), r, true] : (i = Zt.join(Zt.basename(r), i), r = Zt.dirname(r));
    while (r !== o && n === void 0);
    n || (n = [s3.slice(0, 99), "", true]);
  }
  return n;
};
var xt = (s3, t, e) => s3.subarray(t, t + e).toString("utf8").replace(/\0.*/, "");
var Wi = (s3, t, e) => pn(lt(s3, t, e));
var pn = (s3) => s3 === void 0 ? void 0 : new Date(s3 * 1e3);
var lt = (s3, t, e) => Number(s3[t]) & 128 ? Hs(s3.subarray(t, t + e)) : wn(s3, t, e);
var En = (s3) => isNaN(s3) ? void 0 : s3;
var wn = (s3, t, e) => En(parseInt(s3.subarray(t, t + e).toString("utf8").replace(/\0.*$/, "").trim(), 8));
var Sn = { 12: 8589934591, 8: 2097151 };
var ct = (s3, t, e, i) => i === void 0 ? false : i > Sn[e] || i < 0 ? (Us(i, s3.subarray(t, t + e)), true) : (yn(s3, t, e, i), false);
var yn = (s3, t, e, i) => s3.write(Rn(i, e), t, e, "ascii");
var Rn = (s3, t) => gn(Math.floor(s3).toString(8), t);
var gn = (s3, t) => (s3.length === t - 1 ? s3 : new Array(t - s3.length - 1).join("0") + s3 + " ") + "\0";
var Gi = (s3, t, e, i) => i === void 0 ? false : ct(s3, t, e, i.getTime() / 1e3);
var bn = new Array(156).join("\0");
var Lt = (s3, t, e, i) => i === void 0 ? false : (s3.write(i + bn, t, e, "utf8"), i.length !== Buffer.byteLength(i) || i.length > e);
var ft = class s {
  atime;
  mtime;
  ctime;
  charset;
  comment;
  gid;
  uid;
  gname;
  uname;
  linkpath;
  dev;
  ino;
  nlink;
  path;
  size;
  mode;
  global;
  constructor(t, e = false) {
    this.atime = t.atime, this.charset = t.charset, this.comment = t.comment, this.ctime = t.ctime, this.dev = t.dev, this.gid = t.gid, this.global = e, this.gname = t.gname, this.ino = t.ino, this.linkpath = t.linkpath, this.mtime = t.mtime, this.nlink = t.nlink, this.path = t.path, this.size = t.size, this.uid = t.uid, this.uname = t.uname;
  }
  encode() {
    let t = this.encodeBody();
    if (t === "") return Buffer.allocUnsafe(0);
    let e = Buffer.byteLength(t), i = 512 * Math.ceil(1 + e / 512), r = Buffer.allocUnsafe(i);
    for (let n = 0; n < 512; n++) r[n] = 0;
    new F({ path: ("PaxHeader/" + _n(this.path ?? "")).slice(0, 99), mode: this.mode || 420, uid: this.uid, gid: this.gid, size: e, mtime: this.mtime, type: this.global ? "GlobalExtendedHeader" : "ExtendedHeader", linkpath: "", uname: this.uname || "", gname: this.gname || "", devmaj: 0, devmin: 0, atime: this.atime, ctime: this.ctime }).encode(r), r.write(t, 512, e, "utf8");
    for (let n = e + 512; n < r.length; n++) r[n] = 0;
    return r;
  }
  encodeBody() {
    return this.encodeField("path") + this.encodeField("ctime") + this.encodeField("atime") + this.encodeField("dev") + this.encodeField("ino") + this.encodeField("nlink") + this.encodeField("charset") + this.encodeField("comment") + this.encodeField("gid") + this.encodeField("gname") + this.encodeField("linkpath") + this.encodeField("mtime") + this.encodeField("size") + this.encodeField("uid") + this.encodeField("uname");
  }
  encodeField(t) {
    if (this[t] === void 0) return "";
    let e = this[t], i = e instanceof Date ? e.getTime() / 1e3 : e, r = " " + (t === "dev" || t === "ino" || t === "nlink" ? "SCHILY." : "") + t + "=" + i + `
`, n = Buffer.byteLength(r), o = Math.floor(Math.log(n) / Math.log(10)) + 1;
    return n + o >= Math.pow(10, o) && (o += 1), o + n + r;
  }
  static parse(t, e, i = false) {
    return new s(On(Tn(t), e), i);
  }
};
var On = (s3, t) => t ? Object.assign({}, t, s3) : s3;
var Tn = (s3) => s3.replace(/\n$/, "").split(`
`).reduce(xn, /* @__PURE__ */ Object.create(null));
var xn = (s3, t) => {
  let e = parseInt(t, 10);
  if (e !== Buffer.byteLength(t) + 1) return s3;
  t = t.slice((e + " ").length);
  let i = t.split("="), r = i.shift();
  if (!r) return s3;
  let n = r.replace(/^SCHILY\.(dev|ino|nlink)/, "$1"), o = i.join("=").replace(/\0.*/, "");
  switch (n) {
    case "path":
    case "linkpath":
    case "type":
    case "charset":
    case "comment":
    case "gname":
    case "uname":
      s3[n] = o;
      break;
    case "ctime":
    case "atime":
    case "mtime":
      s3[n] = new Date(Number(o) * 1e3);
      break;
    case "size":
      let h = +o;
      h >= 0 && (s3[n] = h);
      break;
    case "gid":
    case "uid":
    case "dev":
    case "ino":
    case "nlink":
    case "mode":
      s3[n] = +o;
      break;
  }
  return s3;
};
var Ln = process.env.TESTING_TAR_FAKE_PLATFORM || process.platform;
var f = Ln !== "win32" ? (s3) => String(s3) : (s3) => String(s3).replaceAll(/\\/g, "/");
var $e = class extends A {
  extended;
  globalExtended;
  header;
  startBlockSize;
  blockRemain;
  remain;
  type;
  meta = false;
  ignore = false;
  path;
  mode;
  uid;
  gid;
  uname;
  gname;
  size = 0;
  mtime;
  atime;
  ctime;
  linkpath;
  dev;
  ino;
  nlink;
  invalid = false;
  absolute;
  unsupported = false;
  constructor(t, e, i) {
    switch (super({}), this.pause(), this.extended = e, this.globalExtended = i, this.header = t, this.remain = t.size ?? 0, this.startBlockSize = 512 * Math.ceil(this.remain / 512), this.blockRemain = this.startBlockSize, this.type = t.type, this.type) {
      case "File":
      case "OldFile":
      case "Link":
      case "SymbolicLink":
      case "CharacterDevice":
      case "BlockDevice":
      case "Directory":
      case "FIFO":
      case "ContiguousFile":
      case "GNUDumpDir":
        break;
      case "NextFileHasLongLinkpath":
      case "NextFileHasLongPath":
      case "OldGnuLongPath":
      case "GlobalExtendedHeader":
      case "ExtendedHeader":
      case "OldExtendedHeader":
        this.meta = true;
        break;
      default:
        this.ignore = true;
    }
    if (!t.path) throw new Error("no path provided for tar.ReadEntry");
    this.path = f(t.path), this.mode = t.mode, this.mode && (this.mode = this.mode & 4095), this.uid = t.uid, this.gid = t.gid, this.uname = t.uname, this.gname = t.gname, this.size = this.remain, this.mtime = t.mtime, this.atime = t.atime, this.ctime = t.ctime, this.linkpath = t.linkpath ? f(t.linkpath) : void 0, this.uname = t.uname, this.gname = t.gname, e && this.#t(e), i && this.#t(i, true);
  }
  write(t) {
    let e = t.length;
    if (e > this.blockRemain) throw new Error("writing more to entry than is appropriate");
    let i = this.remain, r = this.blockRemain;
    return this.remain = Math.max(0, i - e), this.blockRemain = Math.max(0, r - e), this.ignore ? true : i >= e ? super.write(t) : super.write(t.subarray(0, i));
  }
  #t(t, e = false) {
    t.path && (t.path = f(t.path)), t.linkpath && (t.linkpath = f(t.linkpath)), Object.assign(this, Object.fromEntries(Object.entries(t).filter(([i, r]) => !(r == null || i === "path" && e))));
  }
};
var Dt = (s3, t, e, i = {}) => {
  s3.file && (i.file = s3.file), s3.cwd && (i.cwd = s3.cwd), i.code = e instanceof Error && e.code || t, i.tarCode = t, !s3.strict && i.recoverable !== false ? (e instanceof Error && (i = Object.assign(e, i), e = e.message), s3.emit("warn", t, e, i)) : e instanceof Error ? s3.emit("error", Object.assign(e, i)) : s3.emit("error", Object.assign(new Error(`${t}: ${e}`), i));
};
var Nn = 1024 * 1024;
var Xi = Buffer.from([31, 139]);
var qi = Buffer.from([40, 181, 47, 253]);
var An = Math.max(Xi.length, qi.length);
var B = /* @__PURE__ */ Symbol("state");
var Nt = /* @__PURE__ */ Symbol("writeEntry");
var it = /* @__PURE__ */ Symbol("readEntry");
var Zi = /* @__PURE__ */ Symbol("nextEntry");
var Zs = /* @__PURE__ */ Symbol("processEntry");
var V = /* @__PURE__ */ Symbol("extendedHeader");
var he = /* @__PURE__ */ Symbol("globalExtendedHeader");
var dt = /* @__PURE__ */ Symbol("meta");
var Ys = /* @__PURE__ */ Symbol("emitMeta");
var p = /* @__PURE__ */ Symbol("buffer");
var st = /* @__PURE__ */ Symbol("queue");
var ut = /* @__PURE__ */ Symbol("ended");
var Yi = /* @__PURE__ */ Symbol("emittedEnd");
var At = /* @__PURE__ */ Symbol("emit");
var w = /* @__PURE__ */ Symbol("unzip");
var Xe = /* @__PURE__ */ Symbol("consumeChunk");
var qe = /* @__PURE__ */ Symbol("consumeChunkSub");
var Ki = /* @__PURE__ */ Symbol("consumeBody");
var Ks = /* @__PURE__ */ Symbol("consumeMeta");
var Vs = /* @__PURE__ */ Symbol("consumeHeader");
var ae = /* @__PURE__ */ Symbol("consuming");
var Vi = /* @__PURE__ */ Symbol("bufferConcat");
var Qe = /* @__PURE__ */ Symbol("maybeEnd");
var Yt = /* @__PURE__ */ Symbol("writing");
var $ = /* @__PURE__ */ Symbol("aborted");
var Je = /* @__PURE__ */ Symbol("onDone");
var It = /* @__PURE__ */ Symbol("sawValidEntry");
var je = /* @__PURE__ */ Symbol("sawNullBlock");
var ti = /* @__PURE__ */ Symbol("sawEOF");
var $s = /* @__PURE__ */ Symbol("closeStream");
var In = 1e3;
var le = /* @__PURE__ */ Symbol("compressedBytesRead");
var $i = /* @__PURE__ */ Symbol("decompressedBytesRead");
var Xs = /* @__PURE__ */ Symbol("checkDecompressionRatio");
var Cn = () => true;
var rt = class extends Dn {
  file;
  strict;
  maxMetaEntrySize;
  filter;
  brotli;
  zstd;
  maxDecompressionRatio;
  writable = true;
  readable = false;
  [st] = [];
  [p];
  [it];
  [Nt];
  [B] = "begin";
  [dt] = "";
  [V];
  [he];
  [ut] = false;
  [w];
  [$] = false;
  [It];
  [je] = false;
  [ti] = false;
  [Yt] = false;
  [ae] = false;
  [Yi] = false;
  [le] = 0;
  [$i] = 0;
  constructor(t = {}) {
    super(), this.file = t.file || "", this.on(Je, () => {
      (this[B] === "begin" || this[It] === false) && this.warn("TAR_BAD_ARCHIVE", "Unrecognized archive format");
    }), t.ondone ? this.on(Je, t.ondone) : this.on(Je, () => {
      this.emit("prefinish"), this.emit("finish"), this.emit("end");
    }), this.strict = !!t.strict, this.maxDecompressionRatio = typeof t.maxDecompressionRatio == "number" ? t.maxDecompressionRatio : In, this.maxMetaEntrySize = t.maxMetaEntrySize || Nn, this.filter = typeof t.filter == "function" ? t.filter : Cn;
    let e = t.file && (t.file.endsWith(".tar.br") || t.file.endsWith(".tbr"));
    this.brotli = !(t.gzip || t.zstd) && t.brotli !== void 0 ? t.brotli : e ? void 0 : false;
    let i = t.file && (t.file.endsWith(".tar.zst") || t.file.endsWith(".tzst"));
    this.zstd = !(t.gzip || t.brotli) && t.zstd !== void 0 ? t.zstd : i ? true : void 0, this.on("end", () => this[$s]()), typeof t.onwarn == "function" && this.on("warn", t.onwarn), typeof t.onReadEntry == "function" && this.on("entry", t.onReadEntry);
  }
  warn(t, e, i = {}) {
    Dt(this, t, e, i);
  }
  [Vs](t, e) {
    this[It] === void 0 && (this[It] = false);
    let i;
    try {
      i = new F(t, e, this[V], this[he]);
    } catch (r) {
      return this.warn("TAR_ENTRY_INVALID", r);
    }
    if (i.nullBlock) this[je] ? (this[ti] = true, this[B] === "begin" && (this[B] = "header"), this[At]("eof")) : (this[je] = true, this[At]("nullBlock"));
    else if (this[je] = false, !i.cksumValid) this.warn("TAR_ENTRY_INVALID", "checksum failure", { header: i });
    else if (!i.path) this.warn("TAR_ENTRY_INVALID", "path is required", { header: i });
    else {
      let r = i.type;
      if (/^(Symbolic)?Link$/.test(r) && !i.linkpath) this.warn("TAR_ENTRY_INVALID", "linkpath required", { header: i });
      else if (!/^(Symbolic)?Link$/.test(r) && !/^(Global)?ExtendedHeader$/.test(r) && i.linkpath) this.warn("TAR_ENTRY_INVALID", "linkpath forbidden", { header: i });
      else {
        let n = this[Nt] = new $e(i, this[V], this[he]);
        if (!this[It]) if (n.remain) {
          let o = () => {
            n.invalid || (this[It] = true);
          };
          n.on("end", o);
        } else this[It] = true;
        n.meta ? n.size > this.maxMetaEntrySize ? (n.ignore = true, this[At]("ignoredEntry", n), this[B] = "ignore", n.resume()) : n.size > 0 && (this[dt] = "", n.on("data", (o) => this[dt] += o), this[B] = "meta") : (this[V] = void 0, n.ignore = n.ignore || !this.filter(n.path, n), n.ignore ? (this[At]("ignoredEntry", n), this[B] = n.remain ? "ignore" : "header", n.resume()) : (n.remain ? this[B] = "body" : (this[B] = "header", n.end()), this[it] ? this[st].push(n) : (this[st].push(n), this[Zi]())));
      }
    }
  }
  [$s]() {
    queueMicrotask(() => this.emit("close"));
  }
  [Zs](t) {
    let e = true;
    if (!t) this[it] = void 0, e = false;
    else if (Array.isArray(t)) {
      let [i, ...r] = t;
      this.emit(i, ...r);
    } else this[it] = t, this.emit("entry", t), t.emittedEnd || (t.on("end", () => this[Zi]()), e = false);
    return e;
  }
  [Zi]() {
    do
      ;
    while (this[Zs](this[st].shift()));
    if (this[st].length === 0) {
      let t = this[it];
      !t || t.flowing || t.size === t.remain ? this[Yt] || this.emit("drain") : t.once("drain", () => this.emit("drain"));
    }
  }
  [Ki](t, e) {
    let i = this[Nt];
    if (!i) throw new Error("attempt to consume body without entry??");
    let r = i.blockRemain ?? 0, n = r >= t.length && e === 0 ? t : t.subarray(e, e + r);
    return i.write(n), i.blockRemain || (this[B] = "header", this[Nt] = void 0, i.end()), n.length;
  }
  [Ks](t, e) {
    let i = this[Nt], r = this[Ki](t, e);
    return !this[Nt] && i && this[Ys](i), r;
  }
  [At](t, e, i) {
    this[st].length === 0 && !this[it] ? this.emit(t, e, i) : this[st].push([t, e, i]);
  }
  [Ys](t) {
    switch (this[At]("meta", this[dt]), t.type) {
      case "ExtendedHeader":
      case "OldExtendedHeader":
        this[V] = ft.parse(this[dt], this[V], false);
        break;
      case "GlobalExtendedHeader":
        this[he] = ft.parse(this[dt], this[he], true);
        break;
      case "NextFileHasLongPath":
      case "OldGnuLongPath": {
        let e = this[V] ?? /* @__PURE__ */ Object.create(null);
        this[V] = e, e.path = this[dt].replace(/\0.*/, "");
        break;
      }
      case "NextFileHasLongLinkpath": {
        let e = this[V] || /* @__PURE__ */ Object.create(null);
        this[V] = e, e.linkpath = this[dt].replace(/\0.*/, "");
        break;
      }
      default:
        throw new Error("unknown meta: " + t.type);
    }
  }
  abort(t) {
    if (!this[$]) {
      if (this[w]) {
        let e = this[w];
        e.write = () => true, e.end = () => e, e.emit = () => false, e.destroy?.();
      }
      this[$] = true, this.emit("abort", t), this.warn("TAR_ABORT", t, { recoverable: false });
    }
  }
  [Xs](t) {
    this[$i] += t.length;
    let e = this[$i] / this[le];
    return e > this.maxDecompressionRatio ? (this.abort(new Error(`max decompression ratio exceeded: ${e.toFixed(2)} > ${this.maxDecompressionRatio}`)), false) : true;
  }
  write(t, e, i) {
    if (typeof e == "function" && (i = e, e = void 0), typeof t == "string" && (t = Buffer.from(t, typeof e == "string" ? e : "utf8")), this[$]) return i?.(), false;
    if ((this[w] === void 0 || this.brotli === void 0 && this[w] === false) && t) {
      if (this[p] && (t = Buffer.concat([this[p], t]), this[p] = void 0), t.length < An) return this[p] = t, i?.(), true;
      for (let a = 0; this[w] === void 0 && a < Xi.length; a++) t[a] !== Xi[a] && (this[w] = false);
      let o = false;
      if (this[w] === false && this.zstd !== false) {
        o = true;
        for (let a = 0; a < qi.length; a++) if (t[a] !== qi[a]) {
          o = false;
          break;
        }
      }
      let h = this.brotli === void 0 && !o;
      if (this[w] === false && h) if (t.length < 512) if (this[ut]) this.brotli = true;
      else return this[p] = t, i?.(), true;
      else try {
        new F(t.subarray(0, 512)), this.brotli = false;
      } catch {
        this.brotli = true;
      }
      if (this[w] === void 0 || this[w] === false && (this.brotli || o)) {
        let a = this[ut];
        this[ut] = false, this[w] = this[w] === void 0 ? new Ue({}) : o ? new Ke({}) : new Ge({}), this[w].on("data", (c) => {
          this[Xs](c) && this[Xe](c);
        }), this[w].on("error", (c) => {
          this[$] || this.abort(c);
        }), this[w].on("end", () => {
          this[ut] = true, this[Xe]();
        }), this[Yt] = true, this[le] += t.length;
        let l = !!this[w][a ? "end" : "write"](t);
        return this[Yt] = false, i?.(), l;
      }
    }
    this[Yt] = true, this[w] ? (this[le] += t.length, this[w].write(t)) : this[Xe](t), this[Yt] = false;
    let n = this[st].length > 0 ? false : this[it] ? this[it].flowing : true;
    return !n && this[st].length === 0 && this[it]?.once("drain", () => this.emit("drain")), i?.(), n;
  }
  [Vi](t) {
    t && !this[$] && (this[p] = this[p] ? Buffer.concat([this[p], t]) : t);
  }
  [Qe]() {
    if (this[ut] && !this[Yi] && !this[$] && !this[ae]) {
      this[Yi] = true;
      let t = this[Nt];
      if (t?.blockRemain) {
        let e = this[p] ? this[p].length : 0;
        this.warn("TAR_BAD_ARCHIVE", `Truncated input (needed ${t.blockRemain} more bytes, only ${e} available)`, { entry: t }), this[p] && t.write(this[p]), t.end();
      }
      this[At](Je);
    }
  }
  [Xe](t) {
    if (this[ae] && t) this[Vi](t);
    else if (!t && !this[p]) this[Qe]();
    else if (t) {
      if (this[ae] = true, this[p]) {
        this[Vi](t);
        let e = this[p];
        this[p] = void 0, this[qe](e);
      } else this[qe](t);
      for (; this[p] && this[p]?.length >= 512 && !this[$] && !this[ti]; ) {
        let e = this[p];
        this[p] = void 0, this[qe](e);
      }
      this[ae] = false;
    }
    (!this[p] || this[ut]) && this[Qe]();
  }
  [qe](t) {
    let e = 0, i = t.length;
    for (; e + 512 <= i && !this[$] && !this[ti]; ) switch (this[B]) {
      case "begin":
      case "header":
        this[Vs](t, e), e += 512;
        break;
      case "ignore":
      case "body":
        e += this[Ki](t, e);
        break;
      case "meta":
        e += this[Ks](t, e);
        break;
      default:
        throw new Error("invalid state: " + this[B]);
    }
    e < i && (this[p] = this[p] ? Buffer.concat([t.subarray(e), this[p]]) : t.subarray(e));
  }
  end(t, e, i) {
    return typeof t == "function" && (i = t, e = void 0, t = void 0), typeof e == "function" && (i = e, e = void 0), typeof t == "string" && (t = Buffer.from(t, e)), i && this.once("finish", i), this[$] || (this[w] ? (t && (this[le] += t.length, this[w].write(t)), this[w].end()) : (this[ut] = true, (this.brotli === void 0 || this.zstd === void 0) && (t = t || Buffer.alloc(0)), t && this.write(t), this[Qe]())), this;
  }
};
var mt = (s3) => {
  let t = s3.length - 1, e = -1;
  for (; t > -1 && s3.charAt(t) === "/"; ) e = t, t--;
  return e === -1 ? s3 : s3.slice(0, e);
};
var vn = (s3) => {
  let t = s3.onReadEntry;
  s3.onReadEntry = t ? (e) => {
    t(e), e.resume();
  } : (e) => e.resume();
};
var Qi = (s3, t) => {
  let e = new Map(t.map((o) => [mt(o), true])), i = s3.filter, r = 100, n = (o, h = "", a = 0) => {
    if (a >= r) return e.set(o, false), false;
    let l = h || kn(o).root || ".", c;
    if (o === l) c = false;
    else {
      let d = e.get(o);
      c = d !== void 0 ? d : n(Fn(o), l, a + 1);
    }
    return e.set(o, c), c;
  };
  s3.filter = i ? (o, h) => i(o, h) && n(mt(o)) : (o) => n(mt(o));
};
var Mn = (s3) => {
  let t = new rt(s3), e = s3.file, i;
  try {
    i = Kt.openSync(e, "r");
    let r = Kt.fstatSync(i), n = s3.maxReadSize || 16 * 1024 * 1024;
    if (r.size < n) {
      let o = Buffer.allocUnsafe(r.size), h = Kt.readSync(i, o, 0, r.size, 0);
      t.end(h === o.byteLength ? o : o.subarray(0, h));
    } else {
      let o = 0, h = Buffer.allocUnsafe(n);
      for (; o < r.size; ) {
        let a = Kt.readSync(i, h, 0, n, o);
        if (a === 0) break;
        o += a, t.write(h.subarray(0, a));
      }
      t.end();
    }
  } finally {
    if (typeof i == "number") try {
      Kt.closeSync(i);
    } catch {
    }
  }
};
var Bn = (s3, t) => {
  let e = new rt(s3), i = s3.maxReadSize || 16 * 1024 * 1024, r = s3.file;
  return new Promise((o, h) => {
    e.on("error", h), e.on("end", o), Kt.stat(r, (a, l) => {
      if (a) h(a);
      else {
        let c = new _t(r, { readSize: i, size: l.size });
        c.on("error", h), c.pipe(e);
      }
    });
  });
};
var Ct = K(Mn, Bn, (s3) => new rt(s3), (s3) => new rt(s3), (s3, t) => {
  t?.length && Qi(s3, t), s3.noResume || vn(s3);
});
var Ji = (s3, t, e) => (s3 &= 4095, e && (s3 = (s3 | 384) & -19), t && (s3 & 256 && (s3 |= 64), s3 & 32 && (s3 |= 8), s3 & 4 && (s3 |= 1)), s3);
var { isAbsolute: zn, parse: qs } = Pn;
var ce = (s3) => {
  let t = "", e = qs(s3);
  for (; zn(s3) || e.root; ) {
    let i = s3.charAt(0) === "/" && s3.slice(0, 4) !== "//?/" ? "/" : e.root;
    s3 = s3.slice(i.length), t += i, e = qs(s3);
  }
  return [t, s3];
};
var ei = ["|", "<", ">", "?", ":"];
var ji = ei.map((s3) => String.fromCodePoint(61440 + Number(s3.codePointAt(0))));
var Un = new Map(ei.map((s3, t) => [s3, ji[t]]));
var Hn = new Map(ji.map((s3, t) => [s3, ei[t]]));
var ts = (s3) => ei.reduce((t, e) => t.split(e).join(Un.get(e)), s3);
var Qs = (s3) => ji.reduce((t, e) => t.split(e).join(Hn.get(e)), s3);
var rr = (s3, t) => t ? (s3 = f(s3).replace(/^\.(\/|$)/, ""), mt(t) + "/" + s3) : f(s3);
var Wn = 16 * 1024 * 1024;
var tr = /* @__PURE__ */ Symbol("process");
var er = /* @__PURE__ */ Symbol("file");
var ir = /* @__PURE__ */ Symbol("directory");
var is = /* @__PURE__ */ Symbol("symlink");
var sr = /* @__PURE__ */ Symbol("hardlink");
var fe = /* @__PURE__ */ Symbol("header");
var ii = /* @__PURE__ */ Symbol("read");
var ss = /* @__PURE__ */ Symbol("lstat");
var si = /* @__PURE__ */ Symbol("onlstat");
var rs = /* @__PURE__ */ Symbol("onread");
var ns = /* @__PURE__ */ Symbol("onreadlink");
var os = /* @__PURE__ */ Symbol("openfile");
var hs = /* @__PURE__ */ Symbol("onopenfile");
var pt = /* @__PURE__ */ Symbol("close");
var ri = /* @__PURE__ */ Symbol("mode");
var as = /* @__PURE__ */ Symbol("awaitDrain");
var es = /* @__PURE__ */ Symbol("ondrain");
var q = /* @__PURE__ */ Symbol("prefix");
var de = class extends A {
  path;
  portable;
  myuid = process.getuid && process.getuid() || 0;
  myuser = process.env.USER || "";
  maxReadSize;
  linkCache;
  statCache;
  preservePaths;
  cwd;
  strict;
  mtime;
  noPax;
  noMtime;
  prefix;
  fd;
  blockLen = 0;
  blockRemain = 0;
  buf;
  pos = 0;
  remain = 0;
  length = 0;
  offset = 0;
  win32;
  absolute;
  header;
  type;
  linkpath;
  stat;
  onWriteEntry;
  #t = false;
  constructor(t, e = {}) {
    let i = se(e);
    super(), this.path = f(t), this.portable = !!i.portable, this.maxReadSize = i.maxReadSize || Wn, this.linkCache = i.linkCache || /* @__PURE__ */ new Map(), this.statCache = i.statCache || /* @__PURE__ */ new Map(), this.preservePaths = !!i.preservePaths, this.cwd = f(i.cwd || process.cwd()), this.strict = !!i.strict, this.noPax = !!i.noPax, this.noMtime = !!i.noMtime, this.mtime = i.mtime, this.prefix = i.prefix ? f(i.prefix) : void 0, this.onWriteEntry = i.onWriteEntry, typeof i.onwarn == "function" && this.on("warn", i.onwarn);
    let r = false;
    if (!this.preservePaths) {
      let [o, h] = ce(this.path);
      o && typeof h == "string" && (this.path = h, r = o);
    }
    this.win32 = !!i.win32 || process.platform === "win32", this.win32 && (this.path = Qs(this.path.replaceAll(/\\/g, "/")), t = t.replaceAll(/\\/g, "/")), this.absolute = f(i.absolute || js.resolve(this.cwd, t)), this.path === "" && (this.path = "./"), r && this.warn("TAR_ENTRY_INFO", `stripping ${r} from absolute path`, { entry: this, path: r + this.path });
    let n = this.statCache.get(this.absolute);
    n ? this[si](n) : this[ss]();
  }
  warn(t, e, i = {}) {
    return Dt(this, t, e, i);
  }
  emit(t, ...e) {
    return t === "error" && (this.#t = true), super.emit(t, ...e);
  }
  [ss]() {
    X.lstat(this.absolute, (t, e) => {
      if (t) return this.emit("error", t);
      this[si](e);
    });
  }
  [si](t) {
    this.statCache.set(this.absolute, t), this.stat = t, t.isFile() || (t.size = 0), this.type = Gn(t), this.emit("stat", t), this[tr]();
  }
  [tr]() {
    switch (this.type) {
      case "File":
        return this[er]();
      case "Directory":
        return this[ir]();
      case "SymbolicLink":
        return this[is]();
      default:
        return this.end();
    }
  }
  [ri](t) {
    return Ji(t, this.type === "Directory", this.portable);
  }
  [q](t) {
    return rr(t, this.prefix);
  }
  [fe]() {
    if (!this.stat) throw new Error("cannot write header before stat");
    this.type === "Directory" && this.portable && (this.noMtime = true), this.onWriteEntry?.(this), this.header = new F({ path: this[q](this.path), linkpath: this.type === "Link" && this.linkpath !== void 0 ? this[q](this.linkpath) : this.linkpath, mode: this[ri](this.stat.mode), uid: this.portable ? void 0 : this.stat.uid, gid: this.portable ? void 0 : this.stat.gid, size: this.stat.size, mtime: this.noMtime ? void 0 : this.mtime || this.stat.mtime, type: this.type === "Unsupported" ? void 0 : this.type, uname: this.portable ? void 0 : this.stat.uid === this.myuid ? this.myuser : "", atime: this.portable ? void 0 : this.stat.atime, ctime: this.portable ? void 0 : this.stat.ctime }), this.header.encode() && !this.noPax && super.write(new ft({ atime: this.portable ? void 0 : this.header.atime, ctime: this.portable ? void 0 : this.header.ctime, gid: this.portable ? void 0 : this.header.gid, mtime: this.noMtime ? void 0 : this.mtime || this.header.mtime, path: this[q](this.path), linkpath: this.type === "Link" && this.linkpath !== void 0 ? this[q](this.linkpath) : this.linkpath, size: this.header.size, uid: this.portable ? void 0 : this.header.uid, uname: this.portable ? void 0 : this.header.uname, dev: this.portable ? void 0 : this.stat.dev, ino: this.portable ? void 0 : this.stat.ino, nlink: this.portable ? void 0 : this.stat.nlink }).encode());
    let t = this.header?.block;
    if (!t) throw new Error("failed to encode header");
    super.write(t);
  }
  [ir]() {
    if (!this.stat) throw new Error("cannot create directory entry without stat");
    this.path.slice(-1) !== "/" && (this.path += "/"), this.stat.size = 0, this[fe](), this.end();
  }
  [is]() {
    X.readlink(this.absolute, (t, e) => {
      if (t) return this.emit("error", t);
      this[ns](e);
    });
  }
  [ns](t) {
    this.linkpath = f(t), this[fe](), this.end();
  }
  [sr](t) {
    if (!this.stat) throw new Error("cannot create link entry without stat");
    this.type = "Link", this.linkpath = f(js.relative(this.cwd, t)), this.stat.size = 0, this[fe](), this.end();
  }
  [er]() {
    if (!this.stat) throw new Error("cannot create file entry without stat");
    if (this.stat.nlink > 1) {
      let t = `${this.stat.dev}:${this.stat.ino}`, e = this.linkCache.get(t);
      if (e?.indexOf(this.cwd) === 0) return this[sr](e);
      this.linkCache.set(t, this.absolute);
    }
    if (this[fe](), this.stat.size === 0) return this.end();
    this[os]();
  }
  [os]() {
    X.open(this.absolute, "r", (t, e) => {
      if (t) return this.emit("error", t);
      this[hs](e);
    });
  }
  [hs](t) {
    if (this.fd = t, this.#t) return this[pt]();
    if (!this.stat) throw new Error("should stat before calling onopenfile");
    this.blockLen = 512 * Math.ceil(this.stat.size / 512), this.blockRemain = this.blockLen;
    let e = Math.min(this.blockLen, this.maxReadSize);
    this.buf = Buffer.allocUnsafe(e), this.offset = 0, this.pos = 0, this.remain = this.stat.size, this.length = this.buf.length, this[ii]();
  }
  [ii]() {
    let { fd: t, buf: e, offset: i, length: r, pos: n } = this;
    if (t === void 0 || e === void 0) throw new Error("cannot read file without first opening");
    X.read(t, e, i, r, n, (o, h) => {
      if (o) return this[pt](() => this.emit("error", o));
      this[rs](h);
    });
  }
  [pt](t = () => {
  }) {
    this.fd !== void 0 && X.close(this.fd, t);
  }
  [rs](t) {
    if (t <= 0 && this.remain > 0) {
      let r = Object.assign(new Error("encountered unexpected EOF"), { path: this.absolute, syscall: "read", code: "EOF" });
      return this[pt](() => this.emit("error", r));
    }
    if (t > this.remain) {
      let r = Object.assign(new Error("did not encounter expected EOF"), { path: this.absolute, syscall: "read", code: "EOF" });
      return this[pt](() => this.emit("error", r));
    }
    if (!this.buf) throw new Error("should have created buffer prior to reading");
    if (t === this.remain) for (let r = t; r < this.length && t < this.blockRemain; r++) this.buf[r + this.offset] = 0, t++, this.remain++;
    let e = this.offset === 0 && t === this.buf.length ? this.buf : this.buf.subarray(this.offset, this.offset + t);
    this.write(e) ? this[es]() : this[as](() => this[es]());
  }
  [as](t) {
    this.once("drain", t);
  }
  write(t, e, i) {
    if (typeof e == "function" && (i = e, e = void 0), typeof t == "string" && (t = Buffer.from(t, typeof e == "string" ? e : "utf8")), this.blockRemain < t.length) {
      let r = Object.assign(new Error("writing more data than expected"), { path: this.absolute });
      return this.emit("error", r);
    }
    return this.remain -= t.length, this.blockRemain -= t.length, this.pos += t.length, this.offset += t.length, super.write(t, null, i);
  }
  [es]() {
    if (!this.remain) return this.blockRemain && super.write(Buffer.alloc(this.blockRemain)), this[pt]((t) => t ? this.emit("error", t) : this.end());
    if (!this.buf) throw new Error("buffer lost somehow in ONDRAIN");
    this.offset >= this.length && (this.buf = Buffer.allocUnsafe(Math.min(this.blockRemain, this.buf.length)), this.offset = 0), this.length = this.buf.length - this.offset, this[ii]();
  }
};
var ni = class extends de {
  sync = true;
  [ss]() {
    this[si](X.lstatSync(this.absolute));
  }
  [is]() {
    this[ns](X.readlinkSync(this.absolute));
  }
  [os]() {
    this[hs](X.openSync(this.absolute, "r"));
  }
  [ii]() {
    let t = true;
    try {
      let { fd: e, buf: i, offset: r, length: n, pos: o } = this;
      if (e === void 0 || i === void 0) throw new Error("fd and buf must be set in READ method");
      let h = X.readSync(e, i, r, n, o);
      this[rs](h), t = false;
    } finally {
      if (t) try {
        this[pt](() => {
        });
      } catch {
      }
    }
  }
  [as](t) {
    t();
  }
  [pt](t = () => {
  }) {
    this.fd !== void 0 && X.closeSync(this.fd), t();
  }
};
var oi = class extends A {
  blockLen = 0;
  blockRemain = 0;
  buf = 0;
  pos = 0;
  remain = 0;
  length = 0;
  preservePaths;
  portable;
  strict;
  noPax;
  noMtime;
  readEntry;
  type;
  prefix;
  path;
  mode;
  uid;
  gid;
  uname;
  gname;
  header;
  mtime;
  atime;
  ctime;
  linkpath;
  size;
  onWriteEntry;
  warn(t, e, i = {}) {
    return Dt(this, t, e, i);
  }
  constructor(t, e = {}) {
    let i = se(e);
    super(), this.preservePaths = !!i.preservePaths, this.portable = !!i.portable, this.strict = !!i.strict, this.noPax = !!i.noPax, this.noMtime = !!i.noMtime, this.onWriteEntry = i.onWriteEntry, this.readEntry = t;
    let { type: r } = t;
    if (r === "Unsupported") throw new Error("writing entry that should be ignored");
    this.type = r, this.type === "Directory" && this.portable && (this.noMtime = true), this.prefix = i.prefix, this.path = f(t.path), this.mode = t.mode !== void 0 ? this[ri](t.mode) : void 0, this.uid = this.portable ? void 0 : t.uid, this.gid = this.portable ? void 0 : t.gid, this.uname = this.portable ? void 0 : t.uname, this.gname = this.portable ? void 0 : t.gname, this.size = t.size, this.mtime = this.noMtime ? void 0 : i.mtime || t.mtime, this.atime = this.portable ? void 0 : t.atime, this.ctime = this.portable ? void 0 : t.ctime, this.linkpath = t.linkpath !== void 0 ? f(t.linkpath) : void 0, typeof i.onwarn == "function" && this.on("warn", i.onwarn);
    let n = false;
    if (!this.preservePaths) {
      let [h, a] = ce(this.path);
      h && typeof a == "string" && (this.path = a, n = h);
    }
    this.remain = t.size, this.blockRemain = t.startBlockSize, this.onWriteEntry?.(this), this.header = new F({ path: this[q](this.path), linkpath: this.type === "Link" && this.linkpath !== void 0 ? this[q](this.linkpath) : this.linkpath, mode: this.mode, uid: this.portable ? void 0 : this.uid, gid: this.portable ? void 0 : this.gid, size: this.size, mtime: this.noMtime ? void 0 : this.mtime, type: this.type, uname: this.portable ? void 0 : this.uname, atime: this.portable ? void 0 : this.atime, ctime: this.portable ? void 0 : this.ctime }), n && this.warn("TAR_ENTRY_INFO", `stripping ${n} from absolute path`, { entry: this, path: n + this.path }), this.header.encode() && !this.noPax && super.write(new ft({ atime: this.portable ? void 0 : this.atime, ctime: this.portable ? void 0 : this.ctime, gid: this.portable ? void 0 : this.gid, mtime: this.noMtime ? void 0 : this.mtime, path: this[q](this.path), linkpath: this.type === "Link" && this.linkpath !== void 0 ? this[q](this.linkpath) : this.linkpath, size: this.size, uid: this.portable ? void 0 : this.uid, uname: this.portable ? void 0 : this.uname, dev: this.portable ? void 0 : this.readEntry.dev, ino: this.portable ? void 0 : this.readEntry.ino, nlink: this.portable ? void 0 : this.readEntry.nlink }).encode());
    let o = this.header?.block;
    if (!o) throw new Error("failed to encode header");
    super.write(o), t.pipe(this);
  }
  [q](t) {
    return rr(t, this.prefix);
  }
  [ri](t) {
    return Ji(t, this.type === "Directory", this.portable);
  }
  write(t, e, i) {
    typeof e == "function" && (i = e, e = void 0), typeof t == "string" && (t = Buffer.from(t, typeof e == "string" ? e : "utf8"));
    let r = t.length;
    if (r > this.blockRemain) throw new Error("writing more to entry than is appropriate");
    return this.blockRemain -= r, super.write(t, i);
  }
  end(t, e, i) {
    return this.blockRemain && super.write(Buffer.alloc(this.blockRemain)), typeof t == "function" && (i = t, e = void 0, t = void 0), typeof e == "function" && (i = e, e = void 0), typeof t == "string" && (t = Buffer.from(t, e ?? "utf8")), i && this.once("finish", i), t ? super.end(t, i) : super.end(i), this;
  }
};
var Gn = (s3) => s3.isFile() ? "File" : s3.isDirectory() ? "Directory" : s3.isSymbolicLink() ? "SymbolicLink" : "Unsupported";
var hi = class s2 {
  tail;
  head;
  length = 0;
  static create(t = []) {
    return new s2(t);
  }
  constructor(t = []) {
    for (let e of t) this.push(e);
  }
  *[Symbol.iterator]() {
    for (let t = this.head; t; t = t.next) yield t.value;
  }
  removeNode(t) {
    if (t.list !== this) throw new Error("removing node which does not belong to this list");
    let e = t.next, i = t.prev;
    return e && (e.prev = i), i && (i.next = e), t === this.head && (this.head = e), t === this.tail && (this.tail = i), this.length--, t.next = void 0, t.prev = void 0, t.list = void 0, e;
  }
  unshiftNode(t) {
    if (t === this.head) return;
    t.list && t.list.removeNode(t);
    let e = this.head;
    t.list = this, t.next = e, e && (e.prev = t), this.head = t, this.tail || (this.tail = t), this.length++;
  }
  pushNode(t) {
    if (t === this.tail) return;
    t.list && t.list.removeNode(t);
    let e = this.tail;
    t.list = this, t.prev = e, e && (e.next = t), this.tail = t, this.head || (this.head = t), this.length++;
  }
  push(...t) {
    for (let e = 0, i = t.length; e < i; e++) Yn(this, t[e]);
    return this.length;
  }
  unshift(...t) {
    for (var e = 0, i = t.length; e < i; e++) Kn(this, t[e]);
    return this.length;
  }
  pop() {
    if (!this.tail) return;
    let t = this.tail.value, e = this.tail;
    return this.tail = this.tail.prev, this.tail ? this.tail.next = void 0 : this.head = void 0, e.list = void 0, this.length--, t;
  }
  shift() {
    if (!this.head) return;
    let t = this.head.value, e = this.head;
    return this.head = this.head.next, this.head ? this.head.prev = void 0 : this.tail = void 0, e.list = void 0, this.length--, t;
  }
  forEach(t, e) {
    e = e || this;
    for (let i = this.head, r = 0; i; r++) t.call(e, i.value, r, this), i = i.next;
  }
  forEachReverse(t, e) {
    e = e || this;
    for (let i = this.tail, r = this.length - 1; i; r--) t.call(e, i.value, r, this), i = i.prev;
  }
  get(t) {
    let e = 0, i = this.head;
    for (; i && e < t; e++) i = i.next;
    if (e === t && i) return i.value;
  }
  getReverse(t) {
    let e = 0, i = this.tail;
    for (; i && e < t; e++) i = i.prev;
    if (e === t && i) return i.value;
  }
  map(t, e) {
    e = e || this;
    let i = new s2();
    for (let r = this.head; r; ) i.push(t.call(e, r.value, this)), r = r.next;
    return i;
  }
  mapReverse(t, e) {
    e = e || this;
    var i = new s2();
    for (let r = this.tail; r; ) i.push(t.call(e, r.value, this)), r = r.prev;
    return i;
  }
  reduce(t, e) {
    let i, r = this.head;
    if (arguments.length > 1) i = e;
    else if (this.head) r = this.head.next, i = this.head.value;
    else throw new TypeError("Reduce of empty list with no initial value");
    for (var n = 0; r; n++) i = t(i, r.value, n), r = r.next;
    return i;
  }
  reduceReverse(t, e) {
    let i, r = this.tail;
    if (arguments.length > 1) i = e;
    else if (this.tail) r = this.tail.prev, i = this.tail.value;
    else throw new TypeError("Reduce of empty list with no initial value");
    for (let n = this.length - 1; r; n--) i = t(i, r.value, n), r = r.prev;
    return i;
  }
  toArray() {
    let t = new Array(this.length);
    for (let e = 0, i = this.head; i; e++) t[e] = i.value, i = i.next;
    return t;
  }
  toArrayReverse() {
    let t = new Array(this.length);
    for (let e = 0, i = this.tail; i; e++) t[e] = i.value, i = i.prev;
    return t;
  }
  slice(t = 0, e = this.length) {
    e < 0 && (e += this.length), t < 0 && (t += this.length);
    let i = new s2();
    if (e < t || e < 0) return i;
    t < 0 && (t = 0), e > this.length && (e = this.length);
    let r = this.head, n = 0;
    for (n = 0; r && n < t; n++) r = r.next;
    for (; r && n < e; n++, r = r.next) i.push(r.value);
    return i;
  }
  sliceReverse(t = 0, e = this.length) {
    e < 0 && (e += this.length), t < 0 && (t += this.length);
    let i = new s2();
    if (e < t || e < 0) return i;
    t < 0 && (t = 0), e > this.length && (e = this.length);
    let r = this.length, n = this.tail;
    for (; n && r > e; r--) n = n.prev;
    for (; n && r > t; r--, n = n.prev) i.push(n.value);
    return i;
  }
  splice(t, e = 0, ...i) {
    t > this.length && (t = this.length - 1), t < 0 && (t = this.length + t);
    let r = this.head;
    for (let o = 0; r && o < t; o++) r = r.next;
    let n = [];
    for (let o = 0; r && o < e; o++) n.push(r.value), r = this.removeNode(r);
    r ? r !== this.tail && (r = r.prev) : r = this.tail;
    for (let o of i) r = Zn(this, r, o);
    return n;
  }
  reverse() {
    let t = this.head, e = this.tail;
    for (let i = t; i; i = i.prev) {
      let r = i.prev;
      i.prev = i.next, i.next = r;
    }
    return this.head = e, this.tail = t, this;
  }
};
function Zn(s3, t, e) {
  let i = t, r = t ? t.next : s3.head, n = new ue(e, i, r, s3);
  return n.next === void 0 && (s3.tail = n), n.prev === void 0 && (s3.head = n), s3.length++, n;
}
function Yn(s3, t) {
  s3.tail = new ue(t, s3.tail, void 0, s3), s3.head || (s3.head = s3.tail), s3.length++;
}
function Kn(s3, t) {
  s3.head = new ue(t, void 0, s3.head, s3), s3.tail || (s3.tail = s3.head), s3.length++;
}
var ue = class {
  list;
  next;
  prev;
  value;
  constructor(t, e, i, r) {
    this.list = r, this.value = t, e ? (e.next = this, this.prev = e) : this.prev = void 0, i ? (i.prev = this, this.next = i) : this.next = void 0;
  }
};
var pi = class {
  path;
  absolute;
  entry;
  stat;
  readdir;
  pending = false;
  pendingLink = false;
  ignore = false;
  piped = false;
  constructor(t, e) {
    this.path = t || "./", this.absolute = e;
  }
};
var nr = Buffer.alloc(1024);
var li = /* @__PURE__ */ Symbol("onStat");
var me = /* @__PURE__ */ Symbol("ended");
var W = /* @__PURE__ */ Symbol("queue");
var pe = /* @__PURE__ */ Symbol("pendingLinks");
var Et = /* @__PURE__ */ Symbol("current");
var Ft = /* @__PURE__ */ Symbol("process");
var Ee = /* @__PURE__ */ Symbol("processing");
var ai = /* @__PURE__ */ Symbol("processJob");
var G = /* @__PURE__ */ Symbol("jobs");
var ls = /* @__PURE__ */ Symbol("jobDone");
var ci = /* @__PURE__ */ Symbol("addFSEntry");
var or = /* @__PURE__ */ Symbol("addTarEntry");
var ds = /* @__PURE__ */ Symbol("stat");
var us = /* @__PURE__ */ Symbol("readdir");
var fi = /* @__PURE__ */ Symbol("onreaddir");
var di = /* @__PURE__ */ Symbol("pipe");
var hr = /* @__PURE__ */ Symbol("entry");
var cs = /* @__PURE__ */ Symbol("entryOpt");
var ui = /* @__PURE__ */ Symbol("writeEntryClass");
var lr = /* @__PURE__ */ Symbol("write");
var fs = /* @__PURE__ */ Symbol("ondrain");
var wt = class extends A {
  sync = false;
  opt;
  cwd;
  maxReadSize;
  preservePaths;
  strict;
  noPax;
  prefix;
  linkCache;
  statCache;
  file;
  portable;
  zip;
  readdirCache;
  noDirRecurse;
  follow;
  noMtime;
  mtime;
  filter;
  jobs;
  [ui];
  onWriteEntry;
  [W];
  [pe] = /* @__PURE__ */ new Map();
  [G] = 0;
  [Ee] = false;
  [me] = false;
  constructor(t = {}) {
    if (super(), this.opt = t, this.file = t.file || "", this.cwd = t.cwd || process.cwd(), this.maxReadSize = t.maxReadSize, this.preservePaths = !!t.preservePaths, this.strict = !!t.strict, this.noPax = !!t.noPax, this.prefix = f(t.prefix || ""), this.linkCache = t.linkCache || /* @__PURE__ */ new Map(), this.statCache = t.statCache || /* @__PURE__ */ new Map(), this.readdirCache = t.readdirCache || /* @__PURE__ */ new Map(), this.onWriteEntry = t.onWriteEntry, this[ui] = de, typeof t.onwarn == "function" && this.on("warn", t.onwarn), this.portable = !!t.portable, t.gzip || t.brotli || t.zstd) {
      if ((t.gzip ? 1 : 0) + (t.brotli ? 1 : 0) + (t.zstd ? 1 : 0) > 1) throw new TypeError("gzip, brotli, zstd are mutually exclusive");
      if (t.gzip && (typeof t.gzip != "object" && (t.gzip = {}), this.portable && (t.gzip.portable = true), this.zip = new ze(t.gzip)), t.brotli && (typeof t.brotli != "object" && (t.brotli = {}), this.zip = new We(t.brotli)), t.zstd && (typeof t.zstd != "object" && (t.zstd = {}), this.zip = new Ye(t.zstd)), !this.zip) throw new Error("impossible");
      let e = this.zip;
      e.on("data", (i) => super.write(i)), e.on("end", () => super.end()), e.on("drain", () => this[fs]()), this.on("resume", () => e.resume());
    } else this.on("drain", this[fs]);
    this.noDirRecurse = !!t.noDirRecurse, this.follow = !!t.follow, this.noMtime = !!t.noMtime, t.mtime && (this.mtime = t.mtime), this.filter = typeof t.filter == "function" ? t.filter : () => true, this[W] = new hi(), this[G] = 0, this.jobs = Number(t.jobs) || 4, this[Ee] = false, this[me] = false;
  }
  [lr](t) {
    return super.write(t);
  }
  add(t) {
    return this.write(t), this;
  }
  end(t, e, i) {
    return typeof t == "function" && (i = t, t = void 0), typeof e == "function" && (i = e, e = void 0), t && this.add(t), this[me] = true, this[Ft](), i && i(), this;
  }
  write(t) {
    if (this[me]) throw new Error("write after end");
    return typeof t == "string" ? this[ci](t) : this[or](t), this.flowing;
  }
  [or](t) {
    let e = f(ar.resolve(this.cwd, t.path));
    if (!this.filter(t.path, t)) t.resume();
    else {
      let i = new pi(t.path, e);
      i.entry = new oi(t, this[cs](i)), i.entry.on("end", () => this[ls](i)), this[G] += 1, this[W].push(i);
    }
    this[Ft]();
  }
  [ci](t) {
    let e = f(ar.resolve(this.cwd, t));
    this[W].push(new pi(t, e)), this[Ft]();
  }
  [ds](t) {
    t.pending = true, this[G] += 1;
    let e = this.follow ? "stat" : "lstat";
    mi[e](t.absolute, (i, r) => {
      t.pending = false, this[G] -= 1, i ? this.emit("error", i) : this[li](t, r);
    });
  }
  [li](t, e) {
    if (this.statCache.set(t.absolute, e), t.stat = e, !this.filter(t.path, e)) t.ignore = true;
    else if (e.isFile() && e.nlink > 1 && !this.linkCache.get(`${e.dev}:${e.ino}`) && !this.sync) if (t === this[Et]) this[ai](t);
    else {
      let i = `${e.dev}:${e.ino}`, r = this[pe].get(i);
      r ? r.push(t) : this[pe].set(i, [t]), t.pendingLink = true, t.pending = true;
    }
    this[Ft]();
  }
  [us](t) {
    t.pending = true, this[G] += 1, mi.readdir(t.absolute, (e, i) => {
      if (t.pending = false, this[G] -= 1, e) return this.emit("error", e);
      this[fi](t, i);
    });
  }
  [fi](t, e) {
    this.readdirCache.set(t.absolute, e), t.readdir = e, this[Ft]();
  }
  [Ft]() {
    if (!this[Ee]) {
      this[Ee] = true;
      for (let t = this[W].head; t && this[G] < this.jobs; t = t.next) if (this[ai](t.value), t.value.ignore) {
        let e = t.next;
        this[W].removeNode(t), t.next = e;
      }
      this[Ee] = false, this[me] && this[W].length === 0 && this[G] === 0 && (this.zip ? this.zip.end(nr) : (super.write(nr), super.end()));
    }
  }
  get [Et]() {
    return this[W] && this[W].head && this[W].head.value;
  }
  [ls](t) {
    this[W].shift(), this[G] -= 1;
    let { stat: e } = t;
    if (e && e.isFile() && e.nlink > 1) {
      let i = `${e.dev}:${e.ino}`, r = this[pe].get(i);
      if (r) {
        this[pe].delete(i);
        for (let n of r) n.pending = false, this[ai](n);
      }
    }
    this[Ft]();
  }
  [ai](t) {
    if (t.pending && t.pendingLink && t === this[Et] && (t.pending = false, t.pendingLink = false), !t.pending) {
      if (t.entry) {
        t === this[Et] && !t.piped && this[di](t);
        return;
      }
      if (!t.stat) {
        let e = this.statCache.get(t.absolute);
        e ? this[li](t, e) : this[ds](t);
      }
      if (t.stat && !t.ignore) {
        if (!this.noDirRecurse && t.stat.isDirectory() && !t.readdir) {
          let e = this.readdirCache.get(t.absolute);
          if (e ? this[fi](t, e) : this[us](t), !t.readdir) return;
        }
        if (t.entry = this[hr](t), !t.entry) {
          t.ignore = true;
          return;
        }
        t === this[Et] && !t.piped && this[di](t);
      }
    }
  }
  [cs](t) {
    return { onwarn: (e, i, r) => this.warn(e, i, r), noPax: this.noPax, cwd: this.cwd, absolute: t.absolute, preservePaths: this.preservePaths, maxReadSize: this.maxReadSize, strict: this.strict, portable: this.portable, linkCache: this.linkCache, statCache: this.statCache, noMtime: this.noMtime, mtime: this.mtime, prefix: this.prefix, onWriteEntry: this.onWriteEntry };
  }
  [hr](t) {
    this[G] += 1;
    try {
      return new this[ui](t.path, this[cs](t)).on("end", () => this[ls](t)).on("error", (i) => this.emit("error", i));
    } catch (e) {
      this.emit("error", e);
    }
  }
  [fs]() {
    this[Et] && this[Et].entry && this[Et].entry.resume();
  }
  [di](t) {
    t.piped = true, t.readdir && t.readdir.forEach((r) => {
      let n = t.path, o = n === "./" ? "" : n.replace(/\/*$/, "/");
      this[ci](o + r);
    });
    let e = t.entry, i = this.zip;
    if (!e) throw new Error("cannot pipe without source");
    i ? e.on("data", (r) => {
      i.write(r) || e.pause();
    }) : e.on("data", (r) => {
      super.write(r) || e.pause();
    });
  }
  pause() {
    return this.zip && this.zip.pause(), super.pause();
  }
  warn(t, e, i = {}) {
    Dt(this, t, e, i);
  }
};
var kt = class extends wt {
  sync = true;
  constructor(t) {
    super(t), this[ui] = ni;
  }
  pause() {
  }
  resume() {
  }
  [ds](t) {
    let e = this.follow ? "statSync" : "lstatSync";
    this[li](t, mi[e](t.absolute));
  }
  [us](t) {
    this[fi](t, mi.readdirSync(t.absolute));
  }
  [di](t) {
    let e = t.entry, i = this.zip;
    if (t.readdir && t.readdir.forEach((r) => {
      let n = t.path, o = n === "./" ? "" : n.replace(/\/*$/, "/");
      this[ci](o + r);
    }), !e) throw new Error("Cannot pipe without source");
    i ? e.on("data", (r) => {
      i.write(r);
    }) : e.on("data", (r) => {
      super[lr](r);
    });
  }
};
var Vn = (s3, t) => {
  let e = new kt(s3), i = new Wt(s3.file, { mode: s3.mode || 438 });
  e.pipe(i), fr(e, t);
};
var $n = (s3, t) => {
  let e = new wt(s3), i = new et(s3.file, { mode: s3.mode || 438 });
  e.pipe(i);
  let r = new Promise((n, o) => {
    i.on("error", o), i.on("close", n), e.on("error", o);
  });
  return dr(e, t).catch((n) => e.emit("error", n)), r;
};
var fr = (s3, t) => {
  t.forEach((e) => {
    e.charAt(0) === "@" ? Ct({ file: cr.resolve(s3.cwd, e.slice(1)), sync: true, noResume: true, onReadEntry: (i) => s3.add(i) }) : s3.add(e);
  }), s3.end();
};
var dr = async (s3, t) => {
  for (let e of t) e.charAt(0) === "@" ? await Ct({ file: cr.resolve(String(s3.cwd), e.slice(1)), noResume: true, onReadEntry: (i) => {
    s3.add(i);
  } }) : s3.add(e);
  s3.end();
};
var Xn = (s3, t) => {
  let e = new kt(s3);
  return fr(e, t), e;
};
var qn = (s3, t) => {
  let e = new wt(s3);
  return dr(e, t).catch((i) => e.emit("error", i)), e;
};
var Qn = K(Vn, $n, Xn, qn, (s3, t) => {
  if (!t?.length) throw new TypeError("no paths specified to add to archive");
});
var Jn = process.env.__FAKE_PLATFORM__ || process.platform;
var Er = Jn === "win32";
var { O_CREAT: wr, O_NOFOLLOW: ur, O_TRUNC: Sr, O_WRONLY: yr } = pr.constants;
var Rr = Number(process.env.__FAKE_FS_O_FILENAME__) || pr.constants.UV_FS_O_FILEMAP || 0;
var jn = Er && !!Rr;
var to = 512 * 1024;
var eo = Rr | Sr | wr | yr;
var mr = !Er && typeof ur == "number" ? ur | Sr | wr | yr : null;
var ms = mr !== null ? () => mr : jn ? (s3) => s3 < to ? eo : "w" : () => "w";
var ps = (s3, t, e) => {
  try {
    return wi.lchownSync(s3, t, e);
  } catch (i) {
    if (i?.code !== "ENOENT") throw i;
  }
};
var Ei = (s3, t, e, i) => {
  wi.lchown(s3, t, e, (r) => {
    i(r && r?.code !== "ENOENT" ? r : null);
  });
};
var io = (s3, t, e, i, r) => {
  if (t.isDirectory()) Es(we.resolve(s3, t.name), e, i, (n) => {
    if (n) return r(n);
    let o = we.resolve(s3, t.name);
    Ei(o, e, i, r);
  });
  else {
    let n = we.resolve(s3, t.name);
    Ei(n, e, i, r);
  }
};
var Es = (s3, t, e, i) => {
  wi.readdir(s3, { withFileTypes: true }, (r, n) => {
    if (r) {
      if (r.code === "ENOENT") return i();
      if (r.code !== "ENOTDIR" && r.code !== "ENOTSUP") return i(r);
    }
    if (r || !n.length) return Ei(s3, t, e, i);
    let o = n.length, h = null, a = (l) => {
      if (!h) {
        if (l) return i(h = l);
        if (--o === 0) return Ei(s3, t, e, i);
      }
    };
    for (let l of n) io(s3, l, t, e, a);
  });
};
var so = (s3, t, e, i) => {
  t.isDirectory() && ws(we.resolve(s3, t.name), e, i), ps(we.resolve(s3, t.name), e, i);
};
var ws = (s3, t, e) => {
  let i;
  try {
    i = wi.readdirSync(s3, { withFileTypes: true });
  } catch (r) {
    let n = r;
    if (n?.code === "ENOENT") return;
    if (n?.code === "ENOTDIR" || n?.code === "ENOTSUP") return ps(s3, t, e);
    throw n;
  }
  for (let r of i) so(s3, r, t, e);
  return ps(s3, t, e);
};
var Se = class extends Error {
  path;
  code;
  syscall = "chdir";
  constructor(t, e) {
    super(`${e}: Cannot cd into '${t}'`), this.path = t, this.code = e;
  }
  get name() {
    return "CwdError";
  }
};
var St = class extends Error {
  path;
  symlink;
  syscall = "symlink";
  code = "TAR_SYMLINK_ERROR";
  constructor(t, e) {
    super("TAR_SYMLINK_ERROR: Cannot extract through symbolic link"), this.symlink = t, this.path = e;
  }
  get name() {
    return "SymlinkError";
  }
};
var no = (s3, t) => {
  k.stat(s3, (e, i) => {
    (e || !i.isDirectory()) && (e = new Se(s3, e?.code || "ENOTDIR")), t(e);
  });
};
var gr = (s3, t, e) => {
  s3 = f(s3);
  let i = t.umask ?? 18, r = t.mode | 448, n = (r & i) !== 0, o = t.uid, h = t.gid, a = typeof o == "number" && typeof h == "number" && (o !== t.processUid || h !== t.processGid), l = t.preserve, c = t.unlink, d = f(t.cwd), y = (E, x) => {
    E ? e(E) : x && a ? Es(x, o, h, (Le) => y(Le)) : n ? k.chmod(s3, r, e) : e();
  };
  if (s3 === d) return no(s3, y);
  if (l) return ro.mkdir(s3, { mode: r, recursive: true }).then((E) => y(null, E ?? void 0), y);
  let D = f(Si.relative(d, s3)).split("/");
  Ss(d, D, r, c, d, void 0, y);
};
var Ss = (s3, t, e, i, r, n, o) => {
  if (t.length === 0) return o(null, n);
  let h = t.shift(), a = f(Si.resolve(s3 + "/" + h));
  k.mkdir(a, e, br(a, t, e, i, r, n, o));
};
var br = (s3, t, e, i, r, n, o) => (h) => {
  h ? k.lstat(s3, (a, l) => {
    if (a) a.path = a.path && f(a.path), o(a);
    else if (l.isDirectory()) Ss(s3, t, e, i, r, n, o);
    else if (i) k.unlink(s3, (c) => {
      if (c) return o(c);
      k.mkdir(s3, e, br(s3, t, e, i, r, n, o));
    });
    else {
      if (l.isSymbolicLink()) return o(new St(s3, s3 + "/" + t.join("/")));
      o(h);
    }
  }) : (n = n || s3, Ss(s3, t, e, i, r, n, o));
};
var oo = (s3) => {
  let t = false, e;
  try {
    t = k.statSync(s3).isDirectory();
  } catch (i) {
    e = i?.code;
  } finally {
    if (!t) throw new Se(s3, e ?? "ENOTDIR");
  }
};
var _r = (s3, t) => {
  s3 = f(s3);
  let e = t.umask ?? 18, i = t.mode | 448, r = (i & e) !== 0, n = t.uid, o = t.gid, h = typeof n == "number" && typeof o == "number" && (n !== t.processUid || o !== t.processGid), a = t.preserve, l = t.unlink, c = f(t.cwd), d = (E) => {
    E && h && ws(E, n, o), r && k.chmodSync(s3, i);
  };
  if (s3 === c) return oo(c), d();
  if (a) return d(k.mkdirSync(s3, { mode: i, recursive: true }) ?? void 0);
  let T = f(Si.relative(c, s3)).split("/"), D;
  for (let E = T.shift(), x = c; E && (x += "/" + E); E = T.shift()) {
    x = f(Si.resolve(x));
    try {
      k.mkdirSync(x, i), D = D || x;
    } catch {
      let Le = k.lstatSync(x);
      if (Le.isDirectory()) continue;
      if (l) {
        k.unlinkSync(x), k.mkdirSync(x, i), D = D || x;
        continue;
      } else if (Le.isSymbolicLink()) return new St(x, x + "/" + T.join("/"));
    }
  }
  return d(D);
};
var ys = /* @__PURE__ */ Object.create(null);
var Or = 1e4;
var Vt = /* @__PURE__ */ new Set();
var Tr = (s3) => {
  Vt.has(s3) ? Vt.delete(s3) : ys[s3] = s3.normalize("NFD").toLocaleLowerCase("en").toLocaleUpperCase("en"), Vt.add(s3);
  let t = ys[s3], e = Vt.size - Or;
  if (e > Or / 10) {
    for (let i of Vt) if (Vt.delete(i), delete ys[i], --e <= 0) break;
  }
  return t;
};
var ho = process.env.TESTING_TAR_FAKE_PLATFORM || process.platform;
var ao = ho === "win32";
var lo = (s3) => s3.split("/").slice(0, -1).reduce((e, i) => {
  let r = e.at(-1);
  return r !== void 0 && (i = xr(r, i)), e.push(i || "/"), e;
}, []);
var yi = class {
  #t = /* @__PURE__ */ new Map();
  #i = /* @__PURE__ */ new Map();
  #s = /* @__PURE__ */ new Set();
  reserve(t, e) {
    t = ao ? ["win32 parallelization disabled"] : t.map((r) => mt(xr(Tr(r))));
    let i = new Set(t.map((r) => lo(r)).reduce((r, n) => r.concat(n)));
    this.#i.set(e, { dirs: i, paths: t });
    for (let r of t) {
      let n = this.#t.get(r);
      n ? n.push(e) : this.#t.set(r, [e]);
    }
    for (let r of i) {
      let n = this.#t.get(r);
      if (!n) this.#t.set(r, [/* @__PURE__ */ new Set([e])]);
      else {
        let o = n.at(-1);
        o instanceof Set ? o.add(e) : n.push(/* @__PURE__ */ new Set([e]));
      }
    }
    return this.#r(e);
  }
  #n(t) {
    let e = this.#i.get(t);
    if (!e) throw new Error("function does not have any path reservations");
    return { paths: e.paths.map((i) => this.#t.get(i)), dirs: [...e.dirs].map((i) => this.#t.get(i)) };
  }
  check(t) {
    let { paths: e, dirs: i } = this.#n(t);
    return e.every((r) => r && r[0] === t) && i.every((r) => r && r[0] instanceof Set && r[0].has(t));
  }
  #r(t) {
    return this.#s.has(t) || !this.check(t) ? false : (this.#s.add(t), t(() => this.#e(t)), true);
  }
  #e(t) {
    if (!this.#s.has(t)) return false;
    let e = this.#i.get(t);
    if (!e) throw new Error("invalid reservation");
    let { paths: i, dirs: r } = e, n = /* @__PURE__ */ new Set();
    for (let o of i) {
      let h = this.#t.get(o);
      if (!h || h?.[0] !== t) continue;
      let a = h[1];
      if (!a) {
        this.#t.delete(o);
        continue;
      }
      if (h.shift(), typeof a == "function") n.add(a);
      else for (let l of a) n.add(l);
    }
    for (let o of r) {
      let h = this.#t.get(o), a = h?.[0];
      if (!(!h || !(a instanceof Set))) if (a.size === 1 && h.length === 1) {
        this.#t.delete(o);
        continue;
      } else if (a.size === 1) {
        h.shift();
        let l = h[0];
        typeof l == "function" && n.add(l);
      } else a.delete(t);
    }
    return this.#s.delete(t), n.forEach((o) => this.#r(o)), true;
  }
};
var Lr = () => process.umask();
var Dr = /* @__PURE__ */ Symbol("onEntry");
var _s = /* @__PURE__ */ Symbol("checkFs");
var Nr = /* @__PURE__ */ Symbol("checkFs2");
var Os = /* @__PURE__ */ Symbol("isReusable");
var P = /* @__PURE__ */ Symbol("makeFs");
var Ts = /* @__PURE__ */ Symbol("file");
var xs = /* @__PURE__ */ Symbol("directory");
var gi = /* @__PURE__ */ Symbol("link");
var Ar = /* @__PURE__ */ Symbol("symlink");
var Ir = /* @__PURE__ */ Symbol("hardlink");
var Re = /* @__PURE__ */ Symbol("ensureNoSymlink");
var Cr = /* @__PURE__ */ Symbol("unsupported");
var Fr = /* @__PURE__ */ Symbol("checkPath");
var Rs = /* @__PURE__ */ Symbol("stripAbsolutePath");
var yt = /* @__PURE__ */ Symbol("mkdir");
var O = /* @__PURE__ */ Symbol("onError");
var Ri = /* @__PURE__ */ Symbol("pending");
var kr = /* @__PURE__ */ Symbol("pend");
var $t = /* @__PURE__ */ Symbol("unpend");
var gs = /* @__PURE__ */ Symbol("ended");
var bs = /* @__PURE__ */ Symbol("maybeClose");
var Ls = /* @__PURE__ */ Symbol("skip");
var ge = /* @__PURE__ */ Symbol("doChown");
var be = /* @__PURE__ */ Symbol("uid");
var _e = /* @__PURE__ */ Symbol("gid");
var Oe = /* @__PURE__ */ Symbol("checkedCwd");
var fo = process.env.TESTING_TAR_FAKE_PLATFORM || process.platform;
var Te = fo === "win32";
var uo = 1024;
var mo = (s3, t) => {
  if (!Te) return u.unlink(s3, t);
  let e = s3 + ".DELETE." + Mr(16).toString("hex");
  u.rename(s3, e, (i) => {
    if (i) return t(i);
    u.unlink(e, t);
  });
};
var po = (s3) => {
  if (!Te) return u.unlinkSync(s3);
  let t = s3 + ".DELETE." + Mr(16).toString("hex");
  u.renameSync(s3, t), u.unlinkSync(t);
};
var vr = (s3, t, e) => s3 !== void 0 && s3 === s3 >>> 0 ? s3 : t !== void 0 && t === t >>> 0 ? t : e;
var Xt = class extends rt {
  [gs] = false;
  [Oe] = false;
  [Ri] = 0;
  reservations = new yi();
  transform;
  writable = true;
  readable = false;
  uid;
  gid;
  setOwner;
  preserveOwner;
  processGid;
  processUid;
  maxDepth;
  forceChown;
  win32;
  newer;
  keep;
  noMtime;
  preservePaths;
  unlink;
  cwd;
  strip;
  processUmask;
  umask;
  dmode;
  fmode;
  chmod;
  constructor(t = {}) {
    if (t.ondone = () => {
      this[gs] = true, this[bs]();
    }, super(t), this.transform = t.transform, this.chmod = !!t.chmod, typeof t.uid == "number" || typeof t.gid == "number") {
      if (typeof t.uid != "number" || typeof t.gid != "number") throw new TypeError("cannot set owner without number uid and gid");
      if (t.preserveOwner) throw new TypeError("cannot preserve owner in archive and also set owner explicitly");
      this.uid = t.uid, this.gid = t.gid, this.setOwner = true;
    } else this.uid = void 0, this.gid = void 0, this.setOwner = false;
    this.preserveOwner = t.preserveOwner === void 0 && typeof t.uid != "number" ? process.getuid?.() === 0 : !!t.preserveOwner, this.processUid = (this.preserveOwner || this.setOwner) && process.getuid ? process.getuid() : void 0, this.processGid = (this.preserveOwner || this.setOwner) && process.getgid ? process.getgid() : void 0, this.maxDepth = typeof t.maxDepth == "number" ? t.maxDepth : uo, this.forceChown = t.forceChown === true, this.win32 = !!t.win32 || Te, this.newer = !!t.newer, this.keep = !!t.keep, this.noMtime = !!t.noMtime, this.preservePaths = !!t.preservePaths, this.unlink = !!t.unlink, this.cwd = f(R.resolve(t.cwd || process.cwd())), this.strip = Number(t.strip) || 0, this.processUmask = this.chmod ? typeof t.processUmask == "number" ? t.processUmask : Lr() : 0, this.umask = typeof t.umask == "number" ? t.umask : this.processUmask, this.dmode = t.dmode || 511 & ~this.umask, this.fmode = t.fmode || 438 & ~this.umask, this.on("entry", (e) => this[Dr](e));
  }
  warn(t, e, i = {}) {
    return (t === "TAR_BAD_ARCHIVE" || t === "TAR_ABORT") && (i.recoverable = false), super.warn(t, e, i);
  }
  [bs]() {
    this[gs] && this[Ri] === 0 && (this.emit("prefinish"), this.emit("finish"), this.emit("end"));
  }
  [Rs](t, e) {
    let i = t[e], { type: r } = t;
    if (!i || this.preservePaths) return true;
    let [n, o] = ce(i), h = o.replaceAll(/\\/g, "/").split("/");
    if (h.includes("..") || Te && /^[a-z]:\.\.$/i.test(h[0] ?? "")) {
      if (e === "path" || r === "Link") return this.warn("TAR_ENTRY_ERROR", `${e} contains '..'`, { entry: t, [e]: i }), false;
      let a = R.posix.dirname(t.path), l = R.posix.normalize(R.posix.join(a, h.join("/")));
      if (l.startsWith("../") || l === "..") return this.warn("TAR_ENTRY_ERROR", `${e} escapes extraction directory`, { entry: t, [e]: i }), false;
    }
    return n && (t[e] = String(o), this.warn("TAR_ENTRY_INFO", `stripping ${n} from absolute ${e}`, { entry: t, [e]: i })), true;
  }
  [Fr](t) {
    let e = f(t.path), i = e.split("/");
    if (this.strip) {
      if (i.length < this.strip) return false;
      if (t.type === "Link") {
        let r = f(String(t.linkpath)).split("/");
        if (r.length >= this.strip) t.linkpath = r.slice(this.strip).join("/");
        else return false;
      }
      i.splice(0, this.strip), t.path = i.join("/");
    }
    if (isFinite(this.maxDepth) && i.length > this.maxDepth) return this.warn("TAR_ENTRY_ERROR", "path excessively deep", { entry: t, path: e, depth: i.length, maxDepth: this.maxDepth }), false;
    if (!this[Rs](t, "path") || !this[Rs](t, "linkpath")) return false;
    if (t.absolute = R.isAbsolute(t.path) ? f(R.resolve(t.path)) : f(R.resolve(this.cwd, t.path)), !this.preservePaths && typeof t.absolute == "string" && t.absolute.indexOf(this.cwd + "/") !== 0 && t.absolute !== this.cwd) return this.warn("TAR_ENTRY_ERROR", "path escaped extraction target", { entry: t, path: f(t.path), resolvedPath: t.absolute, cwd: this.cwd }), false;
    if (t.absolute === this.cwd && t.type !== "Directory" && t.type !== "GNUDumpDir") return false;
    if (this.win32) {
      let { root: r } = R.win32.parse(String(t.absolute));
      t.absolute = r + ts(String(t.absolute).slice(r.length));
      let { root: n } = R.win32.parse(t.path);
      t.path = n + ts(t.path.slice(n.length));
    }
    return true;
  }
  [Dr](t) {
    if (!this[Fr](t)) return t.resume();
    switch (co.equal(typeof t.absolute, "string"), t.type) {
      case "Directory":
      case "GNUDumpDir":
        t.mode && (t.mode = t.mode | 448);
      case "File":
      case "OldFile":
      case "ContiguousFile":
      case "Link":
      case "SymbolicLink":
        return this[_s](t);
      default:
        return this[Cr](t);
    }
  }
  [O](t, e) {
    t.name === "CwdError" ? this.emit("error", t) : (this.warn("TAR_ENTRY_ERROR", t, { entry: e }), this[$t](), e.resume());
  }
  [yt](t, e, i) {
    gr(f(t), { uid: this.uid, gid: this.gid, processUid: this.processUid, processGid: this.processGid, umask: this.processUmask, preserve: this.preservePaths, unlink: this.unlink, cwd: this.cwd, mode: e }, i);
  }
  [ge](t) {
    return this.forceChown || this.preserveOwner && (typeof t.uid == "number" && t.uid !== this.processUid || typeof t.gid == "number" && t.gid !== this.processGid) || typeof this.uid == "number" && this.uid !== this.processUid || typeof this.gid == "number" && this.gid !== this.processGid;
  }
  [be](t) {
    return vr(this.uid, t.uid, this.processUid);
  }
  [_e](t) {
    return vr(this.gid, t.gid, this.processGid);
  }
  [Ts](t, e) {
    let i = typeof t.mode == "number" ? t.mode & 4095 : this.fmode, r = new et(String(t.absolute), { flags: ms(t.size), mode: i, autoClose: false });
    r.on("error", (a) => {
      r.fd && u.close(r.fd, () => {
      }), r.write = () => true, this[O](a, t), e();
    });
    let n = 1, o = (a) => {
      if (a) {
        r.fd && u.close(r.fd, () => {
        }), this[O](a, t), e();
        return;
      }
      --n === 0 && r.fd !== void 0 && u.close(r.fd, (l) => {
        l ? this[O](l, t) : this[$t](), e();
      });
    };
    r.on("finish", () => {
      let a = String(t.absolute), l = r.fd;
      if (typeof l == "number" && t.mtime && !this.noMtime) {
        n++;
        let c = t.atime || /* @__PURE__ */ new Date(), d = t.mtime;
        u.futimes(l, c, d, (y) => y ? u.utimes(a, c, d, (T) => o(T && y)) : o());
      }
      if (typeof l == "number" && this[ge](t)) {
        n++;
        let c = this[be](t), d = this[_e](t);
        typeof c == "number" && typeof d == "number" && u.fchown(l, c, d, (y) => y ? u.chown(a, c, d, (T) => o(T && y)) : o());
      }
      o();
    });
    let h = this.transform && this.transform(t) || t;
    h !== t && (h.on("error", (a) => {
      this[O](a, t), e();
    }), t.pipe(h)), h.pipe(r);
  }
  [xs](t, e) {
    let i = typeof t.mode == "number" ? t.mode & 4095 : this.dmode;
    this[yt](String(t.absolute), i, (r) => {
      if (r) {
        this[O](r, t), e();
        return;
      }
      let n = 1, o = () => {
        --n === 0 && (e(), this[$t](), t.resume());
      };
      t.mtime && !this.noMtime && (n++, u.utimes(String(t.absolute), t.atime || /* @__PURE__ */ new Date(), t.mtime, o)), this[ge](t) && (n++, u.chown(String(t.absolute), Number(this[be](t)), Number(this[_e](t)), o)), o();
    });
  }
  [Cr](t) {
    t.unsupported = true, this.warn("TAR_ENTRY_UNSUPPORTED", `unsupported entry type: ${t.type}`, { entry: t }), t.resume();
  }
  [Ar](t, e) {
    let i = f(R.relative(this.cwd, R.resolve(R.dirname(String(t.absolute)), String(t.linkpath)))).split("/");
    this[Re](t, this.cwd, i, () => this[gi](t, String(t.linkpath), "symlink", e), (r) => {
      this[O](r, t), e();
    });
  }
  [Ir](t, e) {
    let i = f(R.resolve(this.cwd, String(t.linkpath))), r = f(String(t.linkpath)).split("/");
    this[Re](t, this.cwd, r, () => this[gi](t, i, "link", e), (n) => {
      this[O](n, t), e();
    });
  }
  [Re](t, e, i, r, n) {
    let o = i.shift();
    if (this.preservePaths || o === void 0) return r();
    let h = R.resolve(e, o);
    u.lstat(h, (a, l) => {
      if (a) return r();
      if (l?.isSymbolicLink()) return n(new St(h, R.resolve(h, i.join("/"))));
      this[Re](t, h, i, r, n);
    });
  }
  [kr]() {
    this[Ri]++;
  }
  [$t]() {
    this[Ri]--, this[bs]();
  }
  [Ls](t) {
    this[$t](), t.resume();
  }
  [Os](t, e) {
    return t.type === "File" && !this.unlink && e.isFile() && e.nlink <= 1 && !Te;
  }
  [_s](t) {
    this[kr]();
    let e = [t.path];
    t.linkpath && e.push(t.linkpath), this.reservations.reserve(e, (i) => this[Nr](t, i));
  }
  [Nr](t, e) {
    let i = (h) => {
      e(h);
    }, r = () => {
      this[yt](this.cwd, this.dmode, (h) => {
        if (h) {
          this[O](h, t), i();
          return;
        }
        this[Oe] = true, n();
      });
    }, n = () => {
      if (t.absolute !== this.cwd) {
        let h = f(R.dirname(String(t.absolute)));
        if (h !== this.cwd) return this[yt](h, this.dmode, (a) => {
          if (a) {
            this[O](a, t), i();
            return;
          }
          o();
        });
      }
      o();
    }, o = () => {
      u.lstat(String(t.absolute), (h, a) => {
        if (a && (this.keep || this.newer && a.mtime > (t.mtime ?? a.mtime))) {
          this[Ls](t), i();
          return;
        }
        if (h || this[Os](t, a)) return this[P](null, t, i);
        if (a.isDirectory()) {
          if (t.type === "Directory") {
            let l = this.chmod && t.mode && (a.mode & 4095) !== t.mode, c = (d) => this[P](d ?? null, t, i);
            return l ? u.chmod(String(t.absolute), Number(t.mode), c) : c();
          }
          if (t.absolute !== this.cwd) return u.rmdir(String(t.absolute), (l) => this[P](l ?? null, t, i));
        }
        if (t.absolute === this.cwd) return this[P](null, t, i);
        mo(String(t.absolute), (l) => this[P](l ?? null, t, i));
      });
    };
    this[Oe] ? n() : r();
  }
  [P](t, e, i) {
    if (t) {
      this[O](t, e), i();
      return;
    }
    switch (e.type) {
      case "File":
      case "OldFile":
      case "ContiguousFile":
        return this[Ts](e, i);
      case "Link":
        return this[Ir](e, i);
      case "SymbolicLink":
        return this[Ar](e, i);
      case "Directory":
      case "GNUDumpDir":
        return this[xs](e, i);
    }
  }
  [gi](t, e, i, r) {
    u[i](e, String(t.absolute), (n) => {
      n ? this[O](n, t) : (this[$t](), t.resume()), r();
    });
  }
};
var ye = (s3) => {
  try {
    return [null, s3()];
  } catch (t) {
    return [t, null];
  }
};
var xe = class extends Xt {
  sync = true;
  [P](t, e) {
    return super[P](t, e, () => {
    });
  }
  [_s](t) {
    if (!this[Oe]) {
      let n = this[yt](this.cwd, this.dmode);
      if (n) return this[O](n, t);
      this[Oe] = true;
    }
    if (t.absolute !== this.cwd) {
      let n = f(R.dirname(String(t.absolute)));
      if (n !== this.cwd) {
        let o = this[yt](n, this.dmode);
        if (o) return this[O](o, t);
      }
    }
    let [e, i] = ye(() => u.lstatSync(String(t.absolute)));
    if (i && (this.keep || this.newer && i.mtime > (t.mtime ?? i.mtime))) return this[Ls](t);
    if (e || this[Os](t, i)) return this[P](null, t);
    if (i.isDirectory()) {
      if (t.type === "Directory") {
        let o = this.chmod && t.mode && (i.mode & 4095) !== t.mode, [h] = o ? ye(() => {
          u.chmodSync(String(t.absolute), Number(t.mode));
        }) : [];
        return this[P](h, t);
      }
      let [n] = ye(() => u.rmdirSync(String(t.absolute)));
      this[P](n, t);
    }
    let [r] = t.absolute === this.cwd ? [] : ye(() => po(String(t.absolute)));
    this[P](r, t);
  }
  [Ts](t, e) {
    let i = typeof t.mode == "number" ? t.mode & 4095 : this.fmode, r = (h) => {
      let a;
      try {
        u.closeSync(n);
      } catch (l) {
        a = l;
      }
      (h || a) && this[O](h || a, t), e();
    }, n;
    try {
      n = u.openSync(String(t.absolute), ms(t.size), i);
    } catch (h) {
      return r(h);
    }
    let o = this.transform && this.transform(t) || t;
    o !== t && (o.on("error", (h) => this[O](h, t)), t.pipe(o)), o.on("data", (h) => {
      try {
        u.writeSync(n, h, 0, h.length);
      } catch (a) {
        r(a);
      }
    }), o.on("end", () => {
      let h = null;
      if (t.mtime && !this.noMtime) {
        let a = t.atime || /* @__PURE__ */ new Date(), l = t.mtime;
        try {
          u.futimesSync(n, a, l);
        } catch (c) {
          try {
            u.utimesSync(String(t.absolute), a, l);
          } catch {
            h = c;
          }
        }
      }
      if (this[ge](t)) {
        let a = this[be](t), l = this[_e](t);
        try {
          u.fchownSync(n, Number(a), Number(l));
        } catch (c) {
          try {
            u.chownSync(String(t.absolute), Number(a), Number(l));
          } catch {
            h = h || c;
          }
        }
      }
      r(h);
    });
  }
  [xs](t, e) {
    let i = typeof t.mode == "number" ? t.mode & 4095 : this.dmode, r = this[yt](String(t.absolute), i);
    if (r) {
      this[O](r, t), e();
      return;
    }
    if (t.mtime && !this.noMtime) try {
      u.utimesSync(String(t.absolute), t.atime || /* @__PURE__ */ new Date(), t.mtime);
    } catch {
    }
    if (this[ge](t)) try {
      u.chownSync(String(t.absolute), Number(this[be](t)), Number(this[_e](t)));
    } catch {
    }
    e(), t.resume();
  }
  [yt](t, e) {
    try {
      return _r(f(t), { uid: this.uid, gid: this.gid, processUid: this.processUid, processGid: this.processGid, umask: this.processUmask, preserve: this.preservePaths, unlink: this.unlink, cwd: this.cwd, mode: e });
    } catch (i) {
      return i;
    }
  }
  [Re](t, e, i, r, n) {
    if (this.preservePaths || i.length === 0) return r();
    let o = e;
    for (let h of i) {
      o = R.resolve(o, h);
      let [a, l] = ye(() => u.lstatSync(o));
      if (a) return r();
      if (l.isSymbolicLink()) return n(new St(o, R.resolve(e, i.join("/"))));
    }
    r();
  }
  [gi](t, e, i, r) {
    let n = `${i}Sync`;
    try {
      u[n](e, String(t.absolute)), r(), t.resume();
    } catch (o) {
      return this[O](o, t);
    }
  }
};
var Eo = (s3) => {
  let t = new xe(s3), e = s3.file, i = Br.statSync(e), r = s3.maxReadSize || 16 * 1024 * 1024;
  new Be(e, { readSize: r, size: i.size }).pipe(t);
};
var wo = (s3, t) => {
  let e = new Xt(s3), i = s3.maxReadSize || 16 * 1024 * 1024, r = s3.file;
  return new Promise((o, h) => {
    e.on("error", h), e.on("close", o), Br.stat(r, (a, l) => {
      if (a) h(a);
      else {
        let c = new _t(r, { readSize: i, size: l.size });
        c.on("error", h), c.pipe(e);
      }
    });
  });
};
var So = K(Eo, wo, (s3) => new xe(s3), (s3) => new Xt(s3), (s3, t) => {
  t?.length && Qi(s3, t);
});
var yo = (s3, t) => {
  let e = new kt(s3), i = true, r, n;
  try {
    try {
      r = v.openSync(s3.file, "r+");
    } catch (a) {
      if (a?.code === "ENOENT") r = v.openSync(s3.file, "w+");
      else throw a;
    }
    let o = v.fstatSync(r), h = Buffer.alloc(512);
    t: for (n = 0; n < o.size; n += 512) {
      for (let c = 0, d = 0; c < 512; c += d) {
        if (d = v.readSync(r, h, c, h.length - c, n + c), n === 0 && h[0] === 31 && h[1] === 139) throw new Error("cannot append to compressed archives");
        if (!d) break t;
      }
      let a = new F(h);
      if (!a.cksumValid) break;
      let l = 512 * Math.ceil((a.size || 0) / 512);
      if (n + l + 512 > o.size) break;
      n += l, s3.mtimeCache && a.mtime && s3.mtimeCache.set(String(a.path), a.mtime);
    }
    i = false, Ro(s3, e, n, r, t);
  } finally {
    if (i) try {
      v.closeSync(r);
    } catch {
    }
  }
};
var Ro = (s3, t, e, i, r) => {
  let n = new Wt(s3.file, { fd: i, start: e });
  t.pipe(n), bo(t, r);
};
var go = (s3, t) => {
  t = Array.from(t);
  let e = new wt(s3), i = (n, o, h) => {
    let a = (T, D) => {
      T ? v.close(n, (E) => h(T)) : h(null, D);
    }, l = 0;
    if (o === 0) return a(null, 0);
    let c = 0, d = Buffer.alloc(512), y = (T, D) => {
      if (T || D === void 0) return a(T);
      if (c += D, c < 512 && D) return v.read(n, d, c, d.length - c, l + c, y);
      if (l === 0 && d[0] === 31 && d[1] === 139) return a(new Error("cannot append to compressed archives"));
      if (c < 512) return a(null, l);
      let E = new F(d);
      if (!E.cksumValid) return a(null, l);
      let x = 512 * Math.ceil((E.size ?? 0) / 512);
      if (l + x + 512 > o || (l += x + 512, l >= o)) return a(null, l);
      s3.mtimeCache && E.mtime && s3.mtimeCache.set(String(E.path), E.mtime), c = 0, v.read(n, d, 0, 512, l, y);
    };
    v.read(n, d, 0, 512, l, y);
  };
  return new Promise((n, o) => {
    e.on("error", o);
    let h = "r+", a = (l, c) => {
      if (l && l.code === "ENOENT" && h === "r+") return h = "w+", v.open(s3.file, h, a);
      if (l || !c) return o(l);
      v.fstat(c, (d, y) => {
        if (d) return v.close(c, () => o(d));
        i(c, y.size, (T, D) => {
          if (T) return o(T);
          let E = new et(s3.file, { fd: c, start: D });
          e.pipe(E), E.on("error", o), E.on("close", n), _o(e, t);
        });
      });
    };
    v.open(s3.file, h, a);
  });
};
var bo = (s3, t) => {
  t.forEach((e) => {
    e.charAt(0) === "@" ? Ct({ file: Pr.resolve(s3.cwd, e.slice(1)), sync: true, noResume: true, onReadEntry: (i) => s3.add(i) }) : s3.add(e);
  }), s3.end();
};
var _o = async (s3, t) => {
  for (let e of t) e.charAt(0) === "@" ? await Ct({ file: Pr.resolve(String(s3.cwd), e.slice(1)), noResume: true, onReadEntry: (i) => s3.add(i) }) : s3.add(e);
  s3.end();
};
var vt = K(yo, go, () => {
  throw new TypeError("file is required");
}, () => {
  throw new TypeError("file is required");
}, (s3, t) => {
  if (!Bs(s3)) throw new TypeError("file is required");
  if (s3.gzip || s3.brotli || s3.zstd || s3.file.endsWith(".br") || s3.file.endsWith(".tbr")) throw new TypeError("cannot append to compressed archives");
  if (!t?.length) throw new TypeError("no paths specified to add/replace");
});
var Oo = K(vt.syncFile, vt.asyncFile, vt.syncNoFile, vt.asyncNoFile, (s3, t = []) => {
  vt.validate?.(s3, t), To(s3);
});
var To = (s3) => {
  let t = s3.filter;
  s3.mtimeCache || (s3.mtimeCache = /* @__PURE__ */ new Map()), s3.filter = t ? (e, i) => t(e, i) && !((s3.mtimeCache?.get(e) ?? i.mtime ?? 0) > (i.mtime ?? 0)) : (e, i) => !((s3.mtimeCache?.get(e) ?? i.mtime ?? 0) > (i.mtime ?? 0));
};

// packages/installer/src/archive.ts
var import_yauzl = __toESM(require_yauzl(), 1);
var maxExpanded = 2 * 1024 * 1024 * 1024;
var maxEntries = 5e4;
function archivePath(name) {
  if (!name || name.includes("\\") || /^[A-Za-z]:/.test(name) || name.startsWith("/") || name.split("/").includes("..") || /[\x00-\x1f]/.test(name))
    throw new Fault("UNSAFE_ARCHIVE", "Archive entry escapes its extraction root.", 2);
  const clean = name.replace(/^\.\//, "");
  const segments = clean.replace(/\/$/, "").split("/");
  if (clean && segments.some((segment) => segment === "" || segment === "."))
    throw new Fault("UNSAFE_ARCHIVE", 'Archive entry has an empty or "." path segment.', 2);
  return clean;
}
function entryKey(clean) {
  return path14.posix.normalize(clean).replace(/\/$/, "");
}
async function extractArchive(file, target, type, allowLinks = false) {
  await mkdir7(target, { recursive: true, mode: 448 });
  let total = 0, count = 0;
  const seen = /* @__PURE__ */ new Set();
  const check = (name, size) => {
    const clean = archivePath(name);
    total += size;
    count++;
    if (total > maxExpanded || count > maxEntries || size > 512 * 1024 * 1024)
      throw new Fault("ARCHIVE_LIMIT", "Archive exceeds the expanded size or entry limit.", 2);
    if (!clean) return clean;
    const key = entryKey(clean);
    if (seen.has(key)) throw new Fault("DUPLICATE_ARCHIVE_ENTRY", "Archive contains duplicate paths.", 2);
    seen.add(key);
    return clean;
  };
  if (type === "tar.gz") {
    const links = [];
    const files = [];
    let invalid;
    await Ct({
      file,
      strict: true,
      onReadEntry: (entry) => {
        if (invalid) return;
        try {
          const name = check(entry.path, entry.size);
          if (entry.type === "SymbolicLink" || entry.type === "Link") {
            if (!allowLinks)
              throw new Fault("UNSAFE_ARCHIVE", "Links are not allowed in native packages.", 2);
            if (!entry.linkpath) throw new Fault("UNSAFE_ARCHIVE", "Link has no target.", 2);
            const linkTarget = entry.type === "Link" ? entry.linkpath : path14.posix.join(path14.posix.dirname(name), entry.linkpath);
            if (path14.isAbsolute(entry.linkpath))
              throw new Fault("UNSAFE_ARCHIVE", "Absolute link target.", 2);
            links.push({
              name: entryKey(name),
              target: entryKey(archivePath(path14.posix.normalize(linkTarget))),
              hard: entry.type === "Link"
            });
          } else if (!["File", "Directory", "OldFile", "ExtendedHeader", "GlobalExtendedHeader"].includes(entry.type))
            throw new Fault("UNSAFE_ARCHIVE", "Unsupported archive entry type.", 2);
          else if (entry.type === "File" || entry.type === "OldFile") files.push(entryKey(name));
        } catch (error) {
          invalid = error;
        }
      }
    });
    if (invalid) throw invalid;
    for (const entry of links)
      if (files.some((name) => name.startsWith(entry.name + "/")))
        throw new Fault("UNSAFE_ARCHIVE", "An archive link shadows a directory that contains files.", 2);
    await So({
      file,
      cwd: target,
      strict: true,
      preservePaths: false,
      noChmod: false,
      filter: (_name, entry) => "type" in entry && ["File", "Directory", "OldFile"].includes(entry.type)
    });
    let pending = links;
    while (pending.length) {
      const remaining = [];
      for (const entry of pending) {
        const destination = await contained(target, entry.name), source = await contained(target, entry.target);
        try {
          await lstat5(source);
        } catch {
          remaining.push(entry);
          continue;
        }
        await mkdir7(path14.dirname(destination), { recursive: true });
        if (entry.hard) await link(source, destination);
        else await symlink(path14.relative(path14.dirname(destination), source), destination);
      }
      if (remaining.length === pending.length)
        throw new Fault("UNSAFE_ARCHIVE", "Archive link target is missing or cyclic.", 2);
      pending = remaining;
    }
    return;
  }
  await new Promise((resolve, reject) => {
    import_yauzl.default.open(file, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) {
        reject(error);
        return;
      }
      const fail = (e) => {
        zip.close();
        reject(e);
      };
      zip.on("error", fail);
      zip.on("end", resolve);
      zip.on("entry", (entry) => {
        void (async () => {
          const name = check(entry.fileName, entry.uncompressedSize);
          const mode = entry.externalFileAttributes >>> 16;
          if ((mode & 61440) === 40960 || entry.generalPurposeBitFlag & 1)
            throw new Fault("UNSAFE_ARCHIVE", "Encrypted entries and symlinks are not accepted.", 2);
          const destination = await contained(target, name || ".");
          if (!name || name.endsWith("/")) await mkdir7(destination, { recursive: true, mode: 448 });
          else {
            await mkdir7(path14.dirname(destination), { recursive: true, mode: 448 });
            const stream = await new Promise(
              (res, rej) => zip.openReadStream(entry, (e, s3) => e || !s3 ? rej(e) : res(s3))
            );
            await pipeline(
              stream,
              createWriteStream(destination, { flags: "wx", mode: mode & 73 ? 448 : 384 })
            );
          }
          zip.readEntry();
        })().catch(fail);
      });
      zip.readEntry();
    });
  });
}
async function extractVerifiedArchive(file, sha256, target, type, allowLinks = false, privateRoot = path14.dirname(target)) {
  await mkdir7(privateRoot, { recursive: true, mode: 448 });
  const directory = await mkdtemp3(path14.join(privateRoot, ".archive-"));
  try {
    const copy = path14.join(directory, "archive");
    const digest2 = createHash2("sha256");
    await pipeline(
      createReadStream(file),
      async function* (source) {
        for await (const chunk of source) {
          digest2.update(chunk);
          yield chunk;
        }
      },
      createWriteStream(copy, { flags: "wx", mode: 384 })
    );
    if (digest2.digest("hex") !== sha256)
      throw new Fault(
        "INTEGRITY_FAILURE",
        "Archive SHA-256 changed after verification. Nothing was extracted.",
        3,
        "blocked"
      );
    await extractArchive(copy, target, type, allowLinks);
  } finally {
    await rm7(directory, { recursive: true, force: true });
  }
}

// packages/installer/src/command.ts
import path15 from "node:path";
import { spawn as spawn2 } from "node:child_process";
import { stat as stat5 } from "node:fs/promises";
var windowsExtensions = [".exe", ".cmd", ".bat"];
var cmdUnsafe = /[&|<>^%"!\x00-\x1f]/;
async function isFile(file) {
  try {
    return (await stat5(file)).isFile();
  } catch {
    return false;
  }
}
function windowsSuffixes(env) {
  const configured = (env.PATHEXT ?? env.Pathext ?? ".COM;.EXE;.BAT;.CMD").split(";").map((extension) => extension.trim().toLowerCase()).filter((extension) => windowsExtensions.includes(extension));
  return configured.length ? [...new Set(configured)] : windowsExtensions;
}
async function searchPath(name, host = {}) {
  const platform = host.platform ?? process.platform, env = host.env ?? process.env;
  const windows = platform === "win32";
  const pathValue = (windows ? env.Path ?? env.PATH ?? env.path : env.PATH) ?? "";
  const suffixes = windows ? windowsExtensions.includes(path15.extname(name).toLowerCase()) ? [""] : windowsSuffixes(env) : [""];
  for (const directory of pathValue.split(windows ? ";" : path15.delimiter)) {
    const entry = directory.trim().replace(/^"(.*)"$/, "$1");
    if (!entry || !(path15.isAbsolute(entry) || path15.win32.isAbsolute(entry))) continue;
    for (const suffix of suffixes) {
      const candidate = path15.join(entry, name + suffix);
      if (await isFile(candidate)) return candidate;
    }
  }
  return void 0;
}
function cmdQuote(value) {
  if (cmdUnsafe.test(value))
    throw new Fault(
      "UNSAFE_COMMAND_ARGUMENT",
      "A Windows batch command path or argument contains cmd.exe metacharacters. Nothing was run.",
      2,
      "blocked"
    );
  return '"' + value.replace(/(\\+)$/, "$1$1") + '"';
}
async function resolveCommand(command, args, host = {}) {
  const platform = host.platform ?? process.platform, env = host.env ?? process.env;
  if (platform !== "win32") return { executable: command, args, verbatim: false };
  let resolved;
  if (/[\\/]/.test(command) || path15.win32.isAbsolute(command)) {
    const extension = path15.extname(command).toLowerCase();
    for (const suffix of windowsExtensions.includes(extension) ? [""] : windowsSuffixes(env))
      if (await isFile(command + suffix)) {
        resolved = command + suffix;
        break;
      }
  } else resolved = await searchPath(command, { platform, env });
  if (!resolved) return { executable: command, args, verbatim: false };
  if (![".cmd", ".bat"].includes(path15.extname(resolved).toLowerCase()))
    return { executable: resolved, args, verbatim: false };
  const line = [resolved, ...args].map(cmdQuote).join(" ");
  return {
    executable: env.ComSpec ?? env.COMSPEC ?? "cmd.exe",
    args: ["/d", "/s", "/c", '"' + line + '"'],
    verbatim: true
  };
}
async function runCommand(request, host = {}) {
  const command = await resolveCommand(request.executable, request.args, {
    ...host,
    ...request.env ? { env: { ...host.env ?? {}, ...request.env } } : {}
  });
  if (!command.verbatim) return runProcess({ ...request, ...command });
  return new Promise((resolve, reject) => {
    const child = spawn2(command.executable, command.args, {
      cwd: request.cwd,
      env: request.env ?? process.env,
      shell: false,
      stdio: "pipe",
      windowsHide: true,
      windowsVerbatimArguments: true
    });
    let stdout = "", stderr = "", bytes = 0, timedOut = false, truncated = false;
    const max = request.maxBytes ?? 1024 * 1024;
    const stop = () => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1500).unref();
    };
    const collect = (isError) => (data) => {
      const room = Math.max(0, max - bytes);
      bytes += data.length;
      const text = data.subarray(0, room).toString();
      if (isError) stderr += text;
      else stdout += text;
      if (bytes > max) {
        truncated = true;
        stop();
      }
    };
    child.stdout.on("data", collect(false));
    child.stderr.on("data", collect(true));
    child.stdin.on("error", () => {
    });
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, request.timeoutMs ?? 3e4);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Fault("DEPENDENCY_MISSING", error.message, 3, "dependency_missing"));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: redact(stdout),
        stderr: redact(stderr),
        timedOut,
        cancelled: false,
        truncated
      });
    });
    child.stdin.end(request.input ?? "");
  });
}

// packages/installer/src/toolchain.ts
var artifactSchema = external_exports.strictObject({
  id: external_exports.enum(["node", "java", "sqlcl"]),
  version: external_exports.string().min(1),
  url: external_exports.url(),
  sha256: external_exports.string().regex(/^[a-f0-9]{64}$/),
  os: external_exports.string(),
  arch: external_exports.string(),
  type: external_exports.enum(["zip", "tar.gz"]),
  executable: external_exports.string(),
  allowedHosts: external_exports.array(external_exports.string()).min(1),
  license: external_exports.string(),
  consentRequired: external_exports.boolean()
});
var lockSchema = external_exports.strictObject({
  schemaVersion: external_exports.literal(1),
  artifacts: external_exports.array(artifactSchema),
  provenance: external_exports.record(external_exports.string(), external_exports.unknown())
});
async function canonicalHome(home) {
  let existing = path16.resolve(home);
  const rest = [];
  while (!await exists(existing)) {
    const parent = path16.dirname(existing);
    if (parent === existing) break;
    rest.unshift(path16.basename(existing));
    existing = parent;
  }
  return path16.join(await realpath6(existing), ...rest);
}
async function runtimeState(home = managedHome()) {
  const file = path16.join(home, "runtime.json");
  return await exists(file) ? await readJson(file) : { schemaVersion: 1, components: {} };
}
function platformProfile(os2 = process.platform, arch = process.arch) {
  if (![
    ["darwin", "arm64"],
    ["linux", "x64"],
    ["win32", "x64"]
  ].some(([o, a]) => os2 === o && arch === a))
    throw new Fault(
      "UNSUPPORTED_PLATFORM",
      `No locked client profile for ${os2}/${arch}. Use a supported runner or remote development host.`,
      3,
      "blocked"
    );
  return { os: os2, arch, status: os2 === "darwin" ? "locally-tested" : "requires-platform-CI" };
}
async function findExecutable(name) {
  const found = await searchPath(name);
  return found ? realpath6(found) : void 0;
}
async function treeDigest(root) {
  const entries = [];
  async function walk(directory) {
    for (const entry of await readdir4(directory, { withFileTypes: true })) {
      const file = path16.join(directory, entry.name), name = path16.relative(root, file).split(path16.sep).join("/");
      if (entry.isSymbolicLink()) entries.push([name, "link:" + await readlink(file)]);
      else if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) entries.push([name, "file:" + await hashFile(file)]);
      else throw new Fault("SPECIAL_FILE_NOT_ALLOWED", "Toolchain trees accept files and links only.", 3);
    }
  }
  await walk(root);
  entries.sort(([a], [b2]) => a < b2 ? -1 : a > b2 ? 1 : 0);
  return hash(JSON.stringify(entries));
}
async function renameWithRetry(from, to2, platform = process.platform, attempts = 6) {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename4(from, to2);
      return;
    } catch (error) {
      const code = error.code;
      if (platform !== "win32" || !["EPERM", "EBUSY", "EACCES"].includes(code ?? "") || attempt >= attempts)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
}
async function moveAside(destination) {
  const broken = `${destination}.broken-${Date.now()}`;
  await renameWithRetry(destination, broken);
  await rm8(broken, { recursive: true, force: true }).catch(() => {
  });
}
async function intactInstallation(destination, executable, recorded) {
  if (!await exists(executable)) return false;
  if (recorded && recorded.destination !== destination) return false;
  if (!recorded) return true;
  try {
    return await hashFile(executable) === recorded.executableSha256 && await treeDigest(destination) === recorded.treeSha256;
  } catch {
    return false;
  }
}
async function installArtifact(artifact, destination, cache, offline) {
  const file = await download(artifact, cache, offline);
  await mkdir8(path16.dirname(destination), { recursive: true, mode: 448 });
  const staging = await mkdtemp4(destination + ".staging-");
  try {
    await extractVerifiedArchive(file, artifact.sha256, staging, artifact.type, artifact.id !== "sqlcl");
    if (!await exists(path16.join(staging, artifact.executable)))
      throw new Fault(
        "ARTIFACT_LAYOUT_MISMATCH",
        "Vendor executable is missing from the locked archive layout.",
        3
      );
    await renameWithRetry(staging, destination);
  } finally {
    await rm8(staging, { recursive: true, force: true });
  }
}
var ToolchainService = class {
  async inspect() {
    return { platform: platformProfile(), state: await runtimeState() };
  }
  async plan(r) {
    const platform = platformProfile();
    const lock = parse(
      lockSchema,
      await readJson(path16.join(resourceRoot(), "toolchains/toolchain.lock.json"))
    );
    const home = await canonicalHome(r.home ?? managedHome()), cache = path16.resolve(r.cacheDir ?? path16.join(home, "cache"));
    const artifacts = lock.artifacts.filter((a) => a.os === platform.os && a.arch === platform.arch);
    const steps = await Promise.all(
      artifacts.map(async (artifact) => {
        const candidate = artifact.id === "node" ? process.execPath : artifact.id === "sqlcl" ? process.env.APEXREST_SQLCL ?? await findExecutable("sql") : process.env.APEXREST_JAVA_HOME ? path16.join(
          process.env.APEXREST_JAVA_HOME,
          "bin",
          process.platform === "win32" ? "java.exe" : "java"
        ) : void 0;
        let reuse;
        if (candidate && !r.dryRun) {
          try {
            const result = await runCommand({
              executable: candidate,
              args: artifact.id === "node" ? ["--version"] : ["-version"],
              cwd: process.cwd(),
              timeoutMs: 15e3
            });
            if (result.code === 0 && (result.stdout + result.stderr).includes(
              artifact.id === "java" ? artifact.version.split("+")[0] : artifact.version
            ))
              reuse = candidate;
          } catch {
          }
        }
        const destination = path16.join(home, "toolchains", artifact.id, artifact.version);
        return {
          artifact,
          destination,
          reuse,
          ...candidate && r.dryRun ? { candidate, candidateStatus: "found, not probed" } : {},
          action: reuse ? "reuse" : await exists(path16.join(destination, artifact.executable)) ? "verify" : "download-install",
          consent: artifact.consentRequired && !r.acceptOracleLicense && !reuse ? "required" : "not-required"
        };
      })
    );
    return {
      schemaVersion: 1,
      home,
      cache,
      platform,
      steps,
      offline: r.offline ?? false,
      proxy: proxyStatus(),
      extraCA: Boolean(process.env.NODE_EXTRA_CA_CERTS)
    };
  }
  async apply(r) {
    const plan = await this.plan(r);
    if (r.dryRun) return { status: "planned", plan };
    if (!r.yes)
      throw new Fault(
        "SETUP_APPROVAL_REQUIRED",
        "Review dependencies install --dry-run, then pass --yes for technical steps. License and elevation consent are separate.",
        4,
        "needs-user-action"
      );
    await mkdir8(plan.home, { recursive: true, mode: 448 });
    const disk = await statfs(plan.home);
    if (disk.bavail * disk.bsize < 1024 * 1024 * 1024)
      throw new Fault("INSUFFICIENT_DISK", "At least 1 GiB of free local space is required.", 3);
    return withLock(path16.join(plan.home, "toolchain.lock"), async () => {
      const state = await runtimeState(plan.home);
      const actions = [];
      for (const step of plan.steps) {
        const artifact = step.artifact;
        const executable = step.reuse ?? path16.join(step.destination, artifact.executable);
        const intact = Boolean(step.reuse) || await intactInstallation(step.destination, executable, state.integrity?.[artifact.id]);
        if (!intact && step.consent === "required") {
          state.components[artifact.id] = "needs-consent";
          actions.push({
            code: "ORACLE_LICENSE_CONSENT_REQUIRED",
            component: artifact.id,
            details: artifact.license
          });
          continue;
        }
        if (!intact) {
          if (await exists(step.destination)) await moveAside(step.destination);
          await installArtifact(artifact, step.destination, plan.cache, r.offline);
        }
        if (process.platform !== "win32" && !step.reuse) await chmod3(executable, 448);
        const javaHome = state.java ? path16.dirname(path16.dirname(state.java)) : void 0;
        const result = await runProcess({
          executable,
          args: artifact.id === "node" ? ["--version"] : ["-version"],
          cwd: plan.home,
          env: { ...process.env, ...javaHome ? { JAVA_HOME: javaHome } : {} },
          timeoutMs: 2e4
        });
        if (result.code !== 0 || !(result.stdout + result.stderr).includes(
          artifact.id === "java" ? artifact.version.split("+")[0] : artifact.version
        ))
          throw new Fault("TOOLCHAIN_PROBE_FAILED", `${artifact.id} did not report its locked version.`, 3);
        state[artifact.id] = executable;
        state.components[artifact.id] = "verified";
        if (step.reuse) delete state.integrity?.[artifact.id];
        else
          state.integrity = {
            ...state.integrity,
            [artifact.id]: {
              destination: step.destination,
              executableSha256: await hashFile(executable),
              treeSha256: await treeDigest(step.destination)
            }
          };
        await writeJson(path16.join(plan.home, "runtime.json"), state);
      }
      await writeJson(path16.join(plan.home, "runtime.json"), state);
      return {
        schemaVersion: 1,
        status: actions.length ? "needs-user-action" : "toolchain-verified",
        components: state.components,
        actions,
        state
      };
    });
  }
};

export {
  runProcess,
  savedConnectionName,
  ordsUrl,
  ordsUsername,
  connections,
  resolveConnection,
  editConnection,
  configureConnection,
  sqlclMode,
  sqlclRestriction,
  databaseTransport,
  sqlclConfig,
  configureSqlcl,
  coordination,
  LocalDeploymentControl,
  VERSION,
  syncPath,
  privateCopy,
  checkSnapshot,
  checkSyncBackup,
  checkpoint,
  SyncStore,
  APEXLANG_EQUIVALENCE_POLICY,
  compareApplicationExports,
  importSelectionSchema,
  importOptions,
  sourceRelease,
  supportedFile,
  scopedExportFile,
  pickFiles,
  overlaySelection,
  changedFiles,
  selectImport,
  persistSnapshot,
  stageSelection,
  rebaseAfterImport,
  resourceRoot,
  projectInit,
  projectInspect,
  databaseMeetsApex262Minimum,
  auditUpgradeSource,
  sqlclToken,
  SCRIPT_RESTRICT_LEVEL,
  OracleAdapter,
  installSources,
  oracle_exports,
  runCommand,
  lockSchema,
  canonicalHome,
  runtimeState,
  platformProfile,
  treeDigest,
  renameWithRetry,
  ToolchainService
};
