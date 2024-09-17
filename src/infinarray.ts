import { createReadStream, createWriteStream, statSync } from 'fs';
import { open } from 'fs/promises';
import { Transform, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { clampIndex, InfinarrayBase, sameValueZero } from './infinarray-base';
import { getLines } from './lines';

const NOT_READY_ERROR =
  'Infinarray not initialized (Make sure to run init() before other functions)';

interface Checkpoint {
  byte: number;
  index: number;
}

interface InfinarrayOptions<T> {
  delimiter: string;
  skipHeader: boolean;
  readonly: boolean;

  parseLineFn: (line: string) => T;
  stringifyFn: (value: T) => string;
  randomFn: () => number;

  maxElementsPerCheckpoint: number;
  minElementsPerCheckpoint: number;

  maxRandomElementsCacheSize: number;
  initRandomElementsCacheSize: number;

  maxPushedValuesBufferSize: number;

  enableCheckpointDownsizing: boolean;
  minAccessesBeforeDownsizing: number;
  resizeCacheHitThreshold: number;
}

const DEFAULT_OPTIONS: InfinarrayOptions<any> = {
  delimiter: '\n',
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
  resizeCacheHitThreshold: 0.5,
};

export class Infinarray<T> extends InfinarrayBase<T> {
  /**
   * Enables readonly mode for the object.
   * In readonly mode, the underlying array file cannot be changed.
   * This must be false to use the `push` function
   */
  public readonly: boolean;

  private filePath: string;
  private checkpoints: Checkpoint[] = [];
  private randomElementsCache: { index: number; value: T }[] = [];
  private pushedValuesBuffer: T[] = [];
  private maxPushedValuesBufferSize;
  private cachedChunk: { idx: number; data: any[] } | null = null;
  private ready = false;

  private cacheHits = 0;
  private cacheMisses = 0;
  private arrayLength = 0;

  private randomSampleSize: number;
  private delimiter: string;
  private skipHeader: boolean;
  private enableCheckpointResizing: boolean;
  private minTriesBeforeResizing: number;
  private resizeCacheHitThreshold: number;
  private minElementsPerCheckpoint: number;
  private maxRandomSampleSize: number;
  private randomFn: () => number;
  private stringifyFn: (value: T) => string;
  private parseLine: (line: string) => T;
  private elementsPerCheckpoint: number;

  constructor(
    filePath: string,
    options: Partial<InfinarrayOptions<T>> = DEFAULT_OPTIONS
  ) {
    super();
    if (options.delimiter && Buffer.from(options.delimiter).length !== 1) {
      throw new Error('Delimiter must be a single byte character');
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
      throw new Error('Infinarray object already initialized');
    }

    await this.generateCheckpoints();
    this.ready = true;
    if (!this.isFullyInMemory()) {
      await this.generateRandomElementsCache();
    }
  }

  async at(index: number): Promise<T | undefined> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    if (index >= this.length || index < -this.length) {
      return undefined;
    }

    if (index < 0) {
      return this.get(index + this.length);
    }

    return this.get(index);
  }

  async every(
    predicate: (
      value: T,
      index: number,
      thisArg?: InfinarrayBase<T>
    ) => boolean,
    thisArg?: any
  ): Promise<boolean> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    await this.flushPushedValues();

    if (this.cachedChunk) {
      for (
        let i = this.cachedChunk.idx;
        i < this.cachedChunk.idx + this.cachedChunk.data.length;
        i++
      ) {
        if (!predicate.call(thisArg ?? this, this.cachedChunk.data[i], i, this))
          return false;
      }
      if (this.isFullyInMemory()) {
        return true;
      }
    }

    const ac = new AbortController();
    const { signal } = ac;
    const readStream = createReadStream(this.filePath);
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    let idx = 0;
    const falsePredicateError = 'FALSE PREDICATE';
    try {
      let returnValue = true;
      await pipeline(
        readStream,
        linesAndBytes,
        new Writable({
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
          },
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

  async filter(
    predicate: (value: T, index: number, array: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<T[]> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    await this.flushPushedValues();

    const filteredArray: T[] = [];

    if (this.isFullyInMemory() && this.cachedChunk) {
      for (let i = 0; i < this.cachedChunk.data.length; i++) {
        if (
          predicate.call(thisArg ?? this, this.cachedChunk.data[i], i, this)
        ) {
          filteredArray.push(this.cachedChunk.data[i]);
        }
      }

      return filteredArray;
    }

    const readStream = createReadStream(this.filePath);
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);

    let idx = 0;
    await pipeline(
      readStream,
      linesAndBytes,
      new Writable({
        objectMode: true,
        write: (chunk, _, callback) => {
          const parsed = this.parseLine(chunk.line);
          if (predicate.call(thisArg ?? this, parsed, idx, this)) {
            filteredArray.push(parsed);
          }
          idx++;
          return callback();
        },
      })
    );

    return filteredArray;
  }

  async findFirstEntry(
    predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown,
    thisArg?: any,
    fromIndex = 0
  ): Promise<{ index: number; value: T } | undefined> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    await this.flushPushedValues();

    if (fromIndex >= this.length) {
      return undefined;
    }

    const startIndex = Math.max(0, fromIndex);

    if (this.isFullyInMemory() && this.cachedChunk) {
      for (let i = startIndex; i < this.cachedChunk.data.length; i++) {
        if (
          predicate.call(thisArg ?? this, this.cachedChunk.data[i], i, this)
        ) {
          return { index: i, value: this.cachedChunk.data[i] };
        }
      }
      return undefined;
    }

    const ac = new AbortController();
    const { signal } = ac;

    const startCheckpoint =
      this.checkpoints[Math.floor(startIndex / this.elementsPerCheckpoint)];

    const readStream = createReadStream(this.filePath, {
      start: startCheckpoint.byte,
    });
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    let idx = startCheckpoint.index;
    const entryFound = 'ENTRY FOUND';
    let entry: { index: number; value: T } | undefined;
    try {
      await pipeline(
        readStream,
        linesAndBytes,
        new Writable({
          objectMode: true,
          write: (chunk, _, callback) => {
            if (idx >= startIndex) {
              const parsed = this.parseLine(chunk.line);

              if (
                !entry &&
                predicate.call(thisArg ?? this, parsed, idx, this)
              ) {
                entry = { index: idx, value: parsed };
                setImmediate(() => ac.abort(entryFound));
                return callback();
              }
            }
            idx++;
            return callback();
          },
        }),
        { signal }
      );

      return undefined;
    } catch (err) {
      if (ac.signal.aborted && ac.signal.reason === entryFound) {
        return entry;
      }
      throw err;
    }
  }

  async find(
    predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<T | undefined> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.findFirstEntry(predicate, thisArg))?.value;
  }

  async findIndex(
    predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<number> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.findFirstEntry(predicate, thisArg))?.index ?? -1;
  }

  async findLastEntry(
    predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<{ index: number; value: T } | undefined> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    await this.flushPushedValues();

    let entry: { index: number; value: T } | undefined;
    if (this.isFullyInMemory() && this.cachedChunk) {
      for (let i = 0; i < this.cachedChunk.data.length; i++) {
        if (
          predicate.call(thisArg ?? this, this.cachedChunk.data[i], i, this)
        ) {
          entry = { index: i, value: this.cachedChunk.data[i] };
        }
      }
      return entry;
    }

    const readStream = createReadStream(this.filePath);
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    let idx = 0;
    await pipeline(
      readStream,
      linesAndBytes,
      new Writable({
        objectMode: true,
        write: (chunk, _, callback) => {
          const parsed = this.parseLine(chunk.line);
          if (predicate.call(thisArg ?? this, parsed, idx, this)) {
            entry = { index: idx, value: parsed };
          }
          idx++;
          return callback();
        },
      })
    );
    return entry;
  }

  async findLast(
    predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<T | undefined> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.findLastEntry(predicate, thisArg))?.value;
  }

  async findLastIndex(
    predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<number> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.findLastEntry(predicate, thisArg))?.index ?? -1;
  }

  async forEach(
    callbackfn: (value: T, index: number, array: InfinarrayBase<T>) => void,
    thisArg?: any
  ): Promise<void> {
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

    const readStream = createReadStream(this.filePath);
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    const strm = readStream.pipe(linesAndBytes);

    let idx = 0;

    await pipeline(
      readStream,
      linesAndBytes,
      new Writable({
        objectMode: true,
        write: (chunk, _, callback) => {
          const parsed = this.parseLine(chunk.line);
          callbackfn.call(thisArg ?? this, parsed, idx, this);
          idx++;
          return callback();
        },
      })
    );
  }

  async some(
    predicate: (value: T, index: number, array: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<boolean> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.find(predicate, thisArg)) != null;
  }

  async includes(searchElement: T, fromIndex = 0): Promise<boolean> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    const from = clampIndex(fromIndex, this.length);
    if (from == null) {
      return false;
    }
    return (
      (await this.findFirstEntry(
        (val) => sameValueZero(val, searchElement),
        undefined,
        from
      )) != null
    );
  }

  async indexOf(searchElement: T, fromIndex = 0): Promise<number> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    const from = clampIndex(fromIndex, this.length);
    if (from == null) {
      return -1;
    }
    return (
      (
        await this.findFirstEntry(
          (val) => val === searchElement,
          undefined,
          from
        )
      )?.index ?? -1
    );
  }

  async slice(start = 0, end = this.length): Promise<T[]> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }

    await this.flushPushedValues();

    const startIdx = clampIndex(start, this.length);
    const endIdx =
      end >= this.length ? this.length : clampIndex(end, this.length);

    if (startIdx == null || endIdx == null || endIdx <= startIdx) {
      return [];
    }
    if (
      this.cachedChunk &&
      this.cachedChunk.idx <= startIdx &&
      endIdx < this.cachedChunk.idx + this.elementsPerCheckpoint
    ) {
      return this.cachedChunk.data.slice(
        startIdx - this.cachedChunk.idx,
        endIdx - this.cachedChunk.idx
      );
    }

    const ac = new AbortController();
    const { signal } = ac;

    const startCheckpoint =
      this.checkpoints[Math.floor(startIdx / this.elementsPerCheckpoint)];

    const readStream = createReadStream(this.filePath, {
      start: startCheckpoint.byte,
    });
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    let idx = startCheckpoint.index;
    const reachedEnd = 'REACHED END INDEX';
    const slicedArray: T[] = [];
    try {
      await pipeline(
        readStream,
        linesAndBytes,
        new Writable({
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
          },
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

  async sampleEntry(): Promise<
    | {
        index: number;
        value: any;
      }
    | undefined
  > {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    if (this.length === 0) {
      return undefined;
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

  async sampleValue(): Promise<T | undefined> {
    return (await this.sampleEntry())?.value;
  }

  /**
   * Calls a defined callback function on each element of an array, and writes an array to a file that contains the results.
   * @param filePath The file path to write the new mapped data to
   * @param callbackfn A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array.
   * @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  async map<U>(
    filePath: string,
    callbackfn: (value: T, index: number, array: Infinarray<T>) => U,
    options?: Partial<{
      stringifyFn: (value: U) => string;
      delimiter: string;
    }>,
    thisArg?: any
  ) {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }

    const defaultOptions = {
      stringifyFn: JSON.stringify,
      delimiter: this.delimiter,
    };
    const fullOptions = { ...defaultOptions, ...options };

    await this.flushPushedValues();

    const readStream = createReadStream(this.filePath);
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    const writeStream = createWriteStream(filePath);
    let idx = 0;
    await pipeline(
      readStream,
      linesAndBytes,
      new Transform({
        objectMode: true,
        transform: (chunk, _, callback) => {
          const parsed = this.parseLine(chunk.line);
          const ret =
            fullOptions.stringifyFn(
              callbackfn.call(thisArg ?? this, parsed, idx, this)
            ) + fullOptions.delimiter;
          idx++;
          return callback(null, ret);
        },
      }),
      writeStream
    );
  }

  /**
   * Appends new elements to the end of an array, and returns the new length of the array.
   * Readonly mode must be disabled to use this function as this manipulates the underlying file
   * @param items New elements to add to the array.
   */
  async push(...items: T[]): Promise<number> {
    if (this.readonly) {
      throw new Error(
        'Infinarray is in readonly mode, objects cannot be pushed'
      );
    }

    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }

    this.pushedValuesBuffer.push(...items);

    if (this.pushedValuesBuffer.length > this.maxPushedValuesBufferSize) {
      await this.flushPushedValues();
    }

    // Injects pushed objects into random cache through reservoir sampling
    items.forEach((item, idx) => {
      const rand = Math.floor(this.randomFn() * (this.arrayLength + idx));
      if (rand < this.randomElementsCache.length) {
        this.randomElementsCache[rand] = {
          index: this.arrayLength + idx,
          value: item,
        };
      }
    });

    // Checks if current checkpoint is the last checkpoint. If it is, then fill up
    // this checkpoint cache with the new values
    if (this.cachedChunk?.idx === this.checkpoints.length - 1) {
      let i = 0;
      while (
        i < items.length &&
        this.cachedChunk.data.length < this.elementsPerCheckpoint
      ) {
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
    const { size } = statSync(this.filePath);
    const startByte = size - delimiterBuffer.length;

    const finalBytesBuffer = Buffer.alloc(delimiterBuffer.length);
    const handle = await open(this.filePath, 'a+');
    await handle.read(finalBytesBuffer, 0, delimiterBuffer.length, startByte);

    const delimiterExistsAtEnd = delimiterBuffer.equals(finalBytesBuffer);

    let currByteIdx = size;
    let strToAppend = '';
    if (!delimiterExistsAtEnd && size > 0) {
      currByteIdx += delimiterBuffer.length;
      strToAppend += '\n';
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

  private async get(idx: number): Promise<T | undefined> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    let checkpointIdx = Math.floor(idx / this.elementsPerCheckpoint);
    let offset = idx % this.elementsPerCheckpoint;

    if (idx >= this.length || idx < 0) {
      return undefined;
    }

    if (this.cachedChunk?.idx === checkpointIdx) {
      this.cacheHits++;
      return this.cachedChunk.data[offset];
    }

    // This should never occur
    if (this.isFullyInMemory()) {
      throw new Error(
        'Array is fully stored in memory, but could not find value'
      );
    }

    this.cacheMisses++;

    if (this.isIndexInPushBuffer(idx)) {
      return this.pushedValuesBuffer[
        idx - (this.length - this.pushedValuesBuffer.length)
      ];
    }

    // If the cache success ratio dips below threshold, this rebuilds the checkpoints with half the number of rows
    if (
      this.enableCheckpointResizing &&
      this.cacheHits + this.cacheMisses > this.minTriesBeforeResizing &&
      this.cacheHitRatio < this.resizeCacheHitThreshold &&
      this.elementsPerCheckpoint !== this.minElementsPerCheckpoint
    ) {
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
    const readUntilByte =
      checkpointIdx + 1 < this.checkpoints.length
        ? this.checkpoints[checkpointIdx + 1].byte - 1
        : undefined;
    const readStream = createReadStream(this.filePath, {
      start: skipToByte,
      end: readUntilByte,
    });

    const array: T[] = [];

    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    await pipeline(
      readStream,
      linesAndBytes,
      new Writable({
        objectMode: true,
        write: (chunk, _, callback) => {
          array.push(this.parseLine(chunk.line));
          callback();
        },
      })
    );

    this.cachedChunk = { idx: checkpointIdx, data: array };

    return array[offset];
  }

  private isFullyInMemory() {
    return this.elementsPerCheckpoint >= this.length;
  }

  private isIndexInPushBuffer(index: number) {
    return index >= this.length - this.pushedValuesBuffer.length;
  }

  private async generateCheckpoints(warmupCacheIdx = 0) {
    await this.flushPushedValues();
    const warmupCacheCheckpointIdx = Math.floor(
      warmupCacheIdx / this.elementsPerCheckpoint
    );

    const readStream = createReadStream(this.filePath);
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    const checkpoints: Checkpoint[] = [];
    const precache: T[] = [];
    this.arrayLength = 0;
    await pipeline(
      readStream,
      linesAndBytes,
      new Writable({
        objectMode: true,
        write: (chunk, _, callback) => {
          if (
            warmupCacheCheckpointIdx <= chunk.idx &&
            chunk.idx < warmupCacheCheckpointIdx + this.elementsPerCheckpoint
          ) {
            precache.push(this.parseLine(chunk.line));
          }

          this.arrayLength++;
          if (chunk.idx % this.elementsPerCheckpoint === 0) {
            checkpoints.push({ byte: chunk.byteIdx, index: chunk.idx });
            return callback();
          } else {
            return callback();
          }
        },
      })
    );

    this.cachedChunk = { idx: warmupCacheCheckpointIdx, data: precache };

    if (checkpoints.length === 0) {
      checkpoints.push({ index: 0, byte: 0 });
    }

    this.checkpoints = checkpoints;
  }

  private async generateRandomElementsCache() {
    await this.flushPushedValues();

    const randomIdxs: {
      originalIdx: number;
      valIdx: number;
    }[] = [];

    for (let i = 0; i < this.randomSampleSize; i++) {
      randomIdxs.push({
        originalIdx: i,
        valIdx: Math.floor(this.randomFn() * this.length),
      });
    }

    randomIdxs.sort((el1, el2) => el2.valIdx - el1.valIdx);

    this.randomElementsCache = new Array(this.randomSampleSize);

    let current = randomIdxs.pop();

    await this.every((val, idx) => {
      while (idx === current?.valIdx) {
        this.randomElementsCache[current.originalIdx] = {
          index: current.valIdx,
          value: val,
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
