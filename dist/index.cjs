'use strict';

const fs = require('fs');
const promises$1 = require('fs/promises');
const stream = require('stream');
const promises = require('stream/promises');

function clampIndex(index, length) {
  const idx = index;
  if (-length <= idx && idx < 0) {
    return idx + length;
  }
  if (idx < -length) {
    return 0;
  }
  if (idx >= length) {
    return void 0;
  }
  return idx;
}
function sameValueZero(x, y) {
  if (typeof x === "number" && typeof y === "number") {
    return x === y || x !== x && y !== y;
  }
  return x === y;
}
class InfinarrayBase {
}

const nextSplitPatternIdx = (buf, offset, bytesToMatch) => {
  if (offset >= buf.length)
    return -1;
  let i;
  for (i = offset; i < buf.length; i++) {
    if (buf[i] === bytesToMatch[0]) {
      if (bytesToMatch.length > 1) {
        let fullMatch = true;
        let j = i;
        for (let k = 0; j < i + bytesToMatch.length; j++, k++) {
          if (buf[j] !== bytesToMatch[k]) {
            fullMatch = false;
            break;
          }
        }
        if (fullMatch)
          return j - bytesToMatch.length;
      } else {
        break;
      }
    }
  }
  const idx = i + bytesToMatch.length - 1;
  return idx;
};
const getLines = (splitString = "\n", skipFirstLine = false) => {
  const splitBuffer = Buffer.from(splitString);
  let buffered;
  let numberBytes = 0;
  let currIdx = 0;
  let firstLineSkipped = !skipFirstLine;
  return new stream.Transform({
    readableObjectMode: true,
    transform(chunk, _, cb) {
      let buffer = chunk;
      let offset = 0;
      let lastSplitIdx = 0;
      if (buffered) {
        buffer = Buffer.concat([buffered, chunk]);
        offset = buffered.length;
        buffered = void 0;
      }
      while (true) {
        const splitCharIdx = nextSplitPatternIdx(
          buffer,
          offset - splitBuffer.length + 1,
          splitBuffer
        );
        if (splitCharIdx !== -1 && splitCharIdx < buffer.length) {
          if (lastSplitIdx !== splitCharIdx) {
            const line = buffer.subarray(lastSplitIdx, splitCharIdx);
            if (firstLineSkipped) {
              this.push({
                idx: currIdx++,
                byteIdx: numberBytes,
                line: line.toString("utf8")
              });
            } else {
              firstLineSkipped = true;
            }
            numberBytes += line.length + 1;
          }
          offset = splitCharIdx + splitBuffer.length;
          lastSplitIdx = offset;
        } else {
          buffered = buffer.subarray(lastSplitIdx);
          break;
        }
      }
      cb();
    },
    flush(cb) {
      if (buffered && buffered.length > 0) {
        if (firstLineSkipped) {
          this.push({
            idx: currIdx++,
            byteIdx: numberBytes,
            line: Buffer.from(buffered).toString("utf8")
          });
        } else {
          firstLineSkipped = true;
        }
        numberBytes += buffered.length + 1;
      }
      cb();
    }
  });
};

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => {
  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const NOT_READY_ERROR = "Infinarray not initialized (Make sure to run init() before other functions)";
const DEFAULT_OPTIONS = {
  delimiter: "\n",
  skipHeader: false,
  readonly: true,
  randomFn: Math.random,
  parseLineFn: JSON.parse,
  stringifyFn: JSON.stringify,
  maxElementsPerCheckpoint: 4096,
  minElementsPerCheckpoint: 64,
  maxRandomElementsCacheSize: 65536,
  initRandomElementsCacheSize: 512,
  maxPushedValuesBufferSize: 1024,
  enableCheckpointDownsizing: true,
  minAccessesBeforeDownsizing: 15,
  resizeCacheHitThreshold: 0.5
};
class Infinarray extends InfinarrayBase {
  constructor(filePath, options = DEFAULT_OPTIONS) {
    super();
    /**
     * Enables readonly mode for the object.
     * In readonly mode, the underlying array file cannot be changed.
     * This must be false to use the `push` function
     */
    __publicField$1(this, "readonly");
    __publicField$1(this, "filePath");
    __publicField$1(this, "checkpoints", []);
    __publicField$1(this, "randomElementsCache", []);
    __publicField$1(this, "pushedValuesBuffer", []);
    __publicField$1(this, "maxPushedValuesBufferSize");
    __publicField$1(this, "cachedChunk", null);
    __publicField$1(this, "ready", false);
    __publicField$1(this, "cacheHits", 0);
    __publicField$1(this, "cacheMisses", 0);
    __publicField$1(this, "arrayLength", 0);
    __publicField$1(this, "randomSampleSize");
    __publicField$1(this, "delimiter");
    __publicField$1(this, "skipHeader");
    __publicField$1(this, "enableCheckpointResizing");
    __publicField$1(this, "minTriesBeforeResizing");
    __publicField$1(this, "resizeCacheHitThreshold");
    __publicField$1(this, "minElementsPerCheckpoint");
    __publicField$1(this, "maxRandomSampleSize");
    __publicField$1(this, "randomFn");
    __publicField$1(this, "stringifyFn");
    __publicField$1(this, "parseLine");
    __publicField$1(this, "elementsPerCheckpoint");
    if (options.delimiter && Buffer.from(options.delimiter).length !== 1) {
      throw new Error("Delimiter must be a single byte character");
    }
    this.filePath = filePath;
    const fullConfig = { ...DEFAULT_OPTIONS, ...options };
    this.parseLine = fullConfig.parseLineFn;
    this.randomFn = fullConfig.randomFn;
    this.stringifyFn = fullConfig.stringifyFn;
    this.readonly = fullConfig.readonly;
    this.elementsPerCheckpoint = fullConfig.maxElementsPerCheckpoint;
    this.randomSampleSize = fullConfig.initRandomElementsCacheSize;
    this.delimiter = fullConfig.delimiter;
    this.skipHeader = fullConfig.skipHeader;
    this.enableCheckpointResizing = fullConfig.enableCheckpointDownsizing;
    this.minTriesBeforeResizing = fullConfig.minAccessesBeforeDownsizing;
    this.resizeCacheHitThreshold = fullConfig.resizeCacheHitThreshold;
    this.minElementsPerCheckpoint = fullConfig.minElementsPerCheckpoint;
    this.maxRandomSampleSize = fullConfig.maxRandomElementsCacheSize;
    this.maxPushedValuesBufferSize = fullConfig.maxPushedValuesBufferSize;
  }
  get length() {
    return this.arrayLength;
  }
  get cacheHitRatio() {
    const totalCacheChecks = this.cacheMisses + this.cacheHits;
    if (totalCacheChecks === 0) {
      return 0;
    }
    return this.cacheHits / totalCacheChecks;
  }
  /**
   * Initializes and loads the array. This must be called before any array operations.
   */
  async init() {
    if (this.ready) {
      throw new Error("Infinarray object already initialized");
    }
    await this.generateCheckpoints();
    this.ready = true;
    if (!this.isFullyInMemory()) {
      await this.generateRandomElementsCache();
    }
  }
  async at(index) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    if (index >= this.length || index < -this.length) {
      return void 0;
    }
    if (index < 0) {
      return this.get(index + this.length);
    }
    return this.get(index);
  }
  async every(predicate, thisArg) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    await this.flushPushedValues();
    if (this.cachedChunk) {
      for (let i = this.cachedChunk.idx; i < this.cachedChunk.idx + this.cachedChunk.data.length; i++) {
        if (!predicate.call(thisArg ?? this, this.cachedChunk.data[i], i, this))
          return false;
      }
      if (this.isFullyInMemory()) {
        return true;
      }
    }
    const ac = new AbortController();
    const { signal } = ac;
    const readStream = fs.createReadStream(this.filePath);
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    let idx = 0;
    const falsePredicateError = "FALSE PREDICATE";
    try {
      let returnValue = true;
      await promises.pipeline(
        readStream,
        linesAndBytes,
        new stream.Writable({
          objectMode: true,
          write: (chunk, _, callback) => {
            const parsed = this.parseLine(chunk.line);
            if (!predicate.call(thisArg ?? this, parsed, idx, this)) {
              returnValue = false;
              setImmediate(() => ac.abort(falsePredicateError));
              return callback();
            }
            idx++;
            return callback();
          }
        }),
        { signal }
      );
      return returnValue;
    } catch (err) {
      if (ac.signal.aborted && ac.signal.reason === falsePredicateError) {
        return false;
      }
      throw err;
    }
  }
  async filter(predicate, thisArg) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    await this.flushPushedValues();
    const filteredArray = [];
    if (this.isFullyInMemory() && this.cachedChunk) {
      for (let i = 0; i < this.cachedChunk.data.length; i++) {
        if (predicate.call(thisArg ?? this, this.cachedChunk.data[i], i, this)) {
          filteredArray.push(this.cachedChunk.data[i]);
        }
      }
      return filteredArray;
    }
    const readStream = fs.createReadStream(this.filePath);
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    let idx = 0;
    await promises.pipeline(
      readStream,
      linesAndBytes,
      new stream.Writable({
        objectMode: true,
        write: (chunk, _, callback) => {
          const parsed = this.parseLine(chunk.line);
          if (predicate.call(thisArg ?? this, parsed, idx, this)) {
            filteredArray.push(parsed);
          }
          idx++;
          return callback();
        }
      })
    );
    return filteredArray;
  }
  async findFirstEntry(predicate, thisArg, fromIndex = 0) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    await this.flushPushedValues();
    if (fromIndex >= this.length) {
      return void 0;
    }
    const startIndex = Math.max(0, fromIndex);
    if (this.isFullyInMemory() && this.cachedChunk) {
      for (let i = startIndex; i < this.cachedChunk.data.length; i++) {
        if (predicate.call(thisArg ?? this, this.cachedChunk.data[i], i, this)) {
          return { index: i, value: this.cachedChunk.data[i] };
        }
      }
      return void 0;
    }
    const ac = new AbortController();
    const { signal } = ac;
    const startCheckpoint = this.checkpoints[Math.floor(startIndex / this.elementsPerCheckpoint)];
    const readStream = fs.createReadStream(this.filePath, {
      start: startCheckpoint.byte
    });
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    let idx = startCheckpoint.index;
    const entryFound = "ENTRY FOUND";
    let entry;
    try {
      await promises.pipeline(
        readStream,
        linesAndBytes,
        new stream.Writable({
          objectMode: true,
          write: (chunk, _, callback) => {
            if (idx >= startIndex) {
              const parsed = this.parseLine(chunk.line);
              if (!entry && predicate.call(thisArg ?? this, parsed, idx, this)) {
                entry = { index: idx, value: parsed };
                setImmediate(() => ac.abort(entryFound));
                return callback();
              }
            }
            idx++;
            return callback();
          }
        }),
        { signal }
      );
      return void 0;
    } catch (err) {
      if (ac.signal.aborted && ac.signal.reason === entryFound) {
        return entry;
      }
      throw err;
    }
  }
  async find(predicate, thisArg) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.findFirstEntry(predicate, thisArg))?.value;
  }
  async findIndex(predicate, thisArg) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.findFirstEntry(predicate, thisArg))?.index ?? -1;
  }
  async findLastEntry(predicate, thisArg) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    await this.flushPushedValues();
    let entry;
    if (this.isFullyInMemory() && this.cachedChunk) {
      for (let i = 0; i < this.cachedChunk.data.length; i++) {
        if (predicate.call(thisArg ?? this, this.cachedChunk.data[i], i, this)) {
          entry = { index: i, value: this.cachedChunk.data[i] };
        }
      }
      return entry;
    }
    const readStream = fs.createReadStream(this.filePath);
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    let idx = 0;
    await promises.pipeline(
      readStream,
      linesAndBytes,
      new stream.Writable({
        objectMode: true,
        write: (chunk, _, callback) => {
          const parsed = this.parseLine(chunk.line);
          if (predicate.call(thisArg ?? this, parsed, idx, this)) {
            entry = { index: idx, value: parsed };
          }
          idx++;
          return callback();
        }
      })
    );
    return entry;
  }
  async findLast(predicate, thisArg) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.findLastEntry(predicate, thisArg))?.value;
  }
  async findLastIndex(predicate, thisArg) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.findLastEntry(predicate, thisArg))?.index ?? -1;
  }
  async forEach(callbackfn, thisArg) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    await this.flushPushedValues();
    if (this.isFullyInMemory() && this.cachedChunk) {
      for (let i = 0; i < this.cachedChunk.data.length; i++) {
        callbackfn.call(thisArg ?? this, this.cachedChunk.data[i], i, this);
      }
      return;
    }
    const readStream = fs.createReadStream(this.filePath);
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    let idx = 0;
    await promises.pipeline(
      readStream,
      linesAndBytes,
      new stream.Writable({
        objectMode: true,
        write: (chunk, _, callback) => {
          const parsed = this.parseLine(chunk.line);
          callbackfn.call(thisArg ?? this, parsed, idx, this);
          idx++;
          return callback();
        }
      })
    );
  }
  async some(predicate, thisArg) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return await this.find(predicate, thisArg) != null;
  }
  async includes(searchElement, fromIndex = 0) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    const from = clampIndex(fromIndex, this.length);
    if (from == null) {
      return false;
    }
    return await this.findFirstEntry(
      (val) => sameValueZero(val, searchElement),
      void 0,
      from
    ) != null;
  }
  async indexOf(searchElement, fromIndex = 0) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    const from = clampIndex(fromIndex, this.length);
    if (from == null) {
      return -1;
    }
    return (await this.findFirstEntry(
      (val) => val === searchElement,
      void 0,
      from
    ))?.index ?? -1;
  }
  async slice(start = 0, end = this.length) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    await this.flushPushedValues();
    const startIdx = clampIndex(start, this.length);
    const endIdx = end >= this.length ? this.length : clampIndex(end, this.length);
    if (startIdx == null || endIdx == null || endIdx <= startIdx) {
      return [];
    }
    if (this.cachedChunk && this.cachedChunk.idx <= startIdx && endIdx < this.cachedChunk.idx + this.elementsPerCheckpoint) {
      return this.cachedChunk.data.slice(
        startIdx - this.cachedChunk.idx,
        endIdx - this.cachedChunk.idx
      );
    }
    const ac = new AbortController();
    const { signal } = ac;
    const startCheckpoint = this.checkpoints[Math.floor(startIdx / this.elementsPerCheckpoint)];
    const readStream = fs.createReadStream(this.filePath, {
      start: startCheckpoint.byte
    });
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    let idx = startCheckpoint.index;
    const reachedEnd = "REACHED END INDEX";
    const slicedArray = [];
    try {
      await promises.pipeline(
        readStream,
        linesAndBytes,
        new stream.Writable({
          objectMode: true,
          write: (chunk, _, callback) => {
            if (idx >= startIdx && idx < endIdx) {
              const parsed = this.parseLine(chunk.line);
              slicedArray.push(parsed);
              if (idx === endIdx - 1) {
                setImmediate(() => ac.abort(reachedEnd));
              }
            }
            idx++;
            return callback();
          }
        }),
        { signal }
      );
      return slicedArray;
    } catch (err) {
      if (ac.signal.aborted && ac.signal.reason === reachedEnd) {
        return slicedArray;
      }
      throw err;
    }
  }
  sampleIndex() {
    if (this.length === 0) {
      return -1;
    }
    return Math.floor(this.randomFn() * this.length);
  }
  async sampleEntry() {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    if (this.length === 0) {
      return void 0;
    }
    if (this.isFullyInMemory() && this.cachedChunk) {
      const index = this.sampleIndex();
      return { index, value: this.cachedChunk.data[index] };
    }
    if (this.randomElementsCache.length === 0) {
      this.randomSampleSize = Math.min(
        this.randomSampleSize * 2,
        this.maxRandomSampleSize
      );
      await this.generateRandomElementsCache();
    }
    return this.randomElementsCache.pop();
  }
  async sampleValue() {
    return (await this.sampleEntry())?.value;
  }
  /**
   * Calls a defined callback function on each element of an array, and writes an array to a file that contains the results.
   * @param filePath The file path to write the new mapped data to
   * @param callbackfn A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array.
   * @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  async map(filePath, callbackfn, options, thisArg) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    const defaultOptions = {
      stringifyFn: JSON.stringify,
      delimiter: this.delimiter
    };
    const fullOptions = { ...defaultOptions, ...options };
    await this.flushPushedValues();
    const readStream = fs.createReadStream(this.filePath);
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    const writeStream = fs.createWriteStream(filePath);
    let idx = 0;
    await promises.pipeline(
      readStream,
      linesAndBytes,
      new stream.Transform({
        objectMode: true,
        transform: (chunk, _, callback) => {
          const parsed = this.parseLine(chunk.line);
          const ret = fullOptions.stringifyFn(
            callbackfn.call(thisArg ?? this, parsed, idx, this)
          ) + fullOptions.delimiter;
          idx++;
          return callback(null, ret);
        }
      }),
      writeStream
    );
  }
  /**
   * Appends new elements to the end of an array, and returns the new length of the array.
   * Readonly mode must be disabled to use this function as this manipulates the underlying file
   * @param items New elements to add to the array.
   */
  async push(...items) {
    if (this.readonly) {
      throw new Error(
        "Infinarray is in readonly mode, objects cannot be pushed"
      );
    }
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    this.pushedValuesBuffer.push(...items);
    if (this.pushedValuesBuffer.length > this.maxPushedValuesBufferSize) {
      await this.flushPushedValues();
    }
    items.forEach((item, idx) => {
      const rand = Math.floor(this.randomFn() * (this.arrayLength + idx));
      if (rand < this.randomElementsCache.length) {
        this.randomElementsCache[rand] = {
          index: this.arrayLength + idx,
          value: item
        };
      }
    });
    if (this.cachedChunk?.idx === this.checkpoints.length - 1) {
      let i = 0;
      while (i < items.length && this.cachedChunk.data.length < this.elementsPerCheckpoint) {
        this.cachedChunk.data.push(items[i]);
        i++;
      }
    }
    this.arrayLength += items.length;
    return this.length;
  }
  /**
   * This flushes the buffer of pushed values, writing everything to the file.
   * If data has been pushed to the Infinarray, this must be called before the
   * Infinarray object goes out of scope, otherwise data may be lost.
   */
  async flushPushedValues() {
    if (this.pushedValuesBuffer.length === 0) {
      return;
    }
    const delimiterBuffer = Buffer.from(this.delimiter);
    const { size } = fs.statSync(this.filePath);
    const startByte = size - delimiterBuffer.length;
    const finalBytesBuffer = Buffer.alloc(delimiterBuffer.length);
    const handle = await promises$1.open(this.filePath, "a+");
    await handle.read(finalBytesBuffer, 0, delimiterBuffer.length, startByte);
    const delimiterExistsAtEnd = delimiterBuffer.equals(finalBytesBuffer);
    let currByteIdx = size;
    let strToAppend = "";
    if (!delimiterExistsAtEnd && size > 0) {
      currByteIdx += delimiterBuffer.length;
      strToAppend += "\n";
    }
    const lastFlushedIndex = this.length - this.pushedValuesBuffer.length;
    this.pushedValuesBuffer.forEach((item, idx) => {
      const currIdx = lastFlushedIndex + idx + 1;
      strToAppend += this.stringifyFn(item);
      currByteIdx += Buffer.from(strToAppend).length;
      if (currIdx % this.elementsPerCheckpoint === 0) {
        this.checkpoints.push({ byte: currByteIdx, index: currIdx });
      }
      if (idx !== this.pushedValuesBuffer.length - 1) {
        strToAppend += this.delimiter;
        currByteIdx += delimiterBuffer.length;
      }
    });
    await handle.appendFile(strToAppend);
    await handle.close();
    this.pushedValuesBuffer = [];
  }
  async get(idx) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    let checkpointIdx = Math.floor(idx / this.elementsPerCheckpoint);
    let offset = idx % this.elementsPerCheckpoint;
    if (idx >= this.length || idx < 0) {
      return void 0;
    }
    if (this.cachedChunk?.idx === checkpointIdx) {
      this.cacheHits++;
      return this.cachedChunk.data[offset];
    }
    if (this.isFullyInMemory()) {
      throw new Error(
        "Array is fully stored in memory, but could not find value"
      );
    }
    this.cacheMisses++;
    if (this.isIndexInPushBuffer(idx)) {
      return this.pushedValuesBuffer[idx - (this.length - this.pushedValuesBuffer.length)];
    }
    if (this.enableCheckpointResizing && this.cacheHits + this.cacheMisses > this.minTriesBeforeResizing && this.cacheHitRatio < this.resizeCacheHitThreshold && this.elementsPerCheckpoint !== this.minElementsPerCheckpoint) {
      this.elementsPerCheckpoint = Math.max(
        this.minElementsPerCheckpoint,
        Math.floor(this.elementsPerCheckpoint / 2)
      );
      this.cacheMisses = 0;
      this.cacheHits = 0;
      await this.generateCheckpoints(idx);
      if (this.cachedChunk?.idx === checkpointIdx) {
        return this.cachedChunk.data[offset];
      }
      checkpointIdx = Math.floor(idx / this.elementsPerCheckpoint);
      offset = idx % this.elementsPerCheckpoint;
    }
    const skipToByte = this.checkpoints[checkpointIdx].byte;
    const readUntilByte = checkpointIdx + 1 < this.checkpoints.length ? this.checkpoints[checkpointIdx + 1].byte - 1 : void 0;
    const readStream = fs.createReadStream(this.filePath, {
      start: skipToByte,
      end: readUntilByte
    });
    const array = [];
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    await promises.pipeline(
      readStream,
      linesAndBytes,
      new stream.Writable({
        objectMode: true,
        write: (chunk, _, callback) => {
          array.push(this.parseLine(chunk.line));
          callback();
        }
      })
    );
    this.cachedChunk = { idx: checkpointIdx, data: array };
    return array[offset];
  }
  isFullyInMemory() {
    return this.elementsPerCheckpoint >= this.length;
  }
  isIndexInPushBuffer(index) {
    return index >= this.length - this.pushedValuesBuffer.length;
  }
  async generateCheckpoints(warmupCacheIdx = 0) {
    await this.flushPushedValues();
    const warmupCacheCheckpointIdx = Math.floor(
      warmupCacheIdx / this.elementsPerCheckpoint
    );
    const readStream = fs.createReadStream(this.filePath);
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    const checkpoints = [];
    const precache = [];
    this.arrayLength = 0;
    await promises.pipeline(
      readStream,
      linesAndBytes,
      new stream.Writable({
        objectMode: true,
        write: (chunk, _, callback) => {
          if (warmupCacheCheckpointIdx <= chunk.idx && chunk.idx < warmupCacheCheckpointIdx + this.elementsPerCheckpoint) {
            precache.push(this.parseLine(chunk.line));
          }
          this.arrayLength++;
          if (chunk.idx % this.elementsPerCheckpoint === 0) {
            checkpoints.push({ byte: chunk.byteIdx, index: chunk.idx });
            return callback();
          } else {
            return callback();
          }
        }
      })
    );
    this.cachedChunk = { idx: warmupCacheCheckpointIdx, data: precache };
    if (checkpoints.length === 0) {
      checkpoints.push({ index: 0, byte: 0 });
    }
    this.checkpoints = checkpoints;
  }
  async generateRandomElementsCache() {
    await this.flushPushedValues();
    const randomIdxs = [];
    for (let i = 0; i < this.randomSampleSize; i++) {
      randomIdxs.push({
        originalIdx: i,
        valIdx: Math.floor(this.randomFn() * this.length)
      });
    }
    randomIdxs.sort((el1, el2) => el2.valIdx - el1.valIdx);
    this.randomElementsCache = new Array(this.randomSampleSize);
    let current = randomIdxs.pop();
    await this.every((val, idx) => {
      while (idx === current?.valIdx) {
        this.randomElementsCache[current.originalIdx] = {
          index: current.valIdx,
          value: val
        };
        current = randomIdxs.pop();
      }
      if (randomIdxs.length === 0) {
        return false;
      }
      return true;
    });
  }
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class InfinarrayView extends InfinarrayBase {
  constructor(array, mapFn) {
    super();
    __publicField(this, "materialArray");
    __publicField(this, "mapFn");
    this.materialArray = array;
    this.mapFn = mapFn;
  }
  get length() {
    return this.materialArray.length;
  }
  get cacheHitRatio() {
    return this.materialArray.cacheHitRatio;
  }
  async at(index) {
    const val = await this.materialArray.at(index);
    if (val !== void 0) {
      return this.mapFn(val);
    }
    return void 0;
  }
  every(predicate, thisArg) {
    return this.materialArray.every(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );
  }
  async filter(predicate, thisArg) {
    const arr = await this.materialArray.filter(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );
    return arr.map(this.mapFn);
  }
  async findFirstEntry(predicate, thisArg, fromIndex) {
    const firstEntry = await this.materialArray.findFirstEntry(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg,
      fromIndex
    );
    if (firstEntry) {
      return { index: firstEntry.index, value: this.mapFn(firstEntry.value) };
    } else {
      return void 0;
    }
  }
  async find(predicate, thisArg) {
    const val = await this.materialArray.find(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );
    if (val) {
      return this.mapFn(val);
    } else {
      return void 0;
    }
  }
  findIndex(predicate, thisArg) {
    return this.materialArray.findIndex(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );
  }
  async findLastEntry(predicate, thisArg) {
    const lastEntry = await this.materialArray.findLastEntry(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );
    if (lastEntry) {
      return { index: lastEntry.index, value: this.mapFn(lastEntry.value) };
    } else {
      return void 0;
    }
  }
  async findLast(predicate, thisArg) {
    const val = await this.materialArray.findLast(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );
    if (val) {
      return this.mapFn(val);
    } else {
      return void 0;
    }
  }
  findLastIndex(predicate, thisArg) {
    return this.materialArray.findLastIndex(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );
  }
  async forEach(callbackfn, thisArg) {
    this.materialArray.forEach(
      (value, index) => callbackfn(this.mapFn(value), index, this),
      thisArg
    );
  }
  some(predicate, thisArg) {
    return this.materialArray.some(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );
  }
  async includes(searchElement, fromIndex = 0) {
    const from = clampIndex(fromIndex, this.length);
    if (from == null) {
      return false;
    }
    return await this.materialArray.findFirstEntry(
      (val) => sameValueZero(this.mapFn(val), searchElement),
      void 0,
      from
    ) != null;
  }
  async indexOf(searchElement, fromIndex = 0) {
    const from = clampIndex(fromIndex, this.length);
    if (from == null) {
      return -1;
    }
    return (await this.materialArray.findFirstEntry(
      (val) => this.mapFn(val) === searchElement,
      void 0,
      from
    ))?.index ?? -1;
  }
  async slice(start, fromIndex = this.length) {
    const slicedArray = await this.materialArray.slice(start, fromIndex);
    return slicedArray.map(this.mapFn);
  }
  sampleIndex() {
    return this.materialArray.sampleIndex();
  }
  async sampleEntry() {
    const entry = await this.materialArray.sampleEntry();
    if (entry) {
      return { index: entry.index, value: this.mapFn(entry.value) };
    } else {
      return void 0;
    }
  }
  async sampleValue() {
    const value = await this.materialArray.sampleValue();
    if (value) {
      return this.mapFn(value);
    } else {
      return void 0;
    }
  }
}

exports.Infinarray = Infinarray;
exports.InfinarrayBase = InfinarrayBase;
exports.InfinarrayView = InfinarrayView;
