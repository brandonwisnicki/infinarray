import { createReadStream } from 'fs';
import { Writable } from 'stream';
import { pipeline } from 'stream/promises';
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
  parseLineFn: (line: string) => T;
  randomFn: () => number;
  maxElementsPerCheckpoint: number;
  minElementsPerCheckpoint: number;
  maxRandomElementsCacheSize: number;
  initRandomElementsCacheSize: number;
  enableCheckpointDownsizing: boolean;
  minAccessesBeforeDownsizing: number;
  resizeCacheHitThreshold: number;
}

const DEFAULT_OPTIONS: InfinarrayOptions<any> = {
  delimiter: '\n',
  skipHeader: false,
  maxElementsPerCheckpoint: 4096,
  minElementsPerCheckpoint: 64,
  maxRandomElementsCacheSize: 65536,
  initRandomElementsCacheSize: 512,
  enableCheckpointDownsizing: true,
  minAccessesBeforeDownsizing: 15,
  resizeCacheHitThreshold: 0.5,
  randomFn: Math.random,
  parseLineFn: JSON.parse,
};

function clampIndex(idx: number, length: number): number | undefined {
  const index = idx;
  if (-length <= index && index < 0) {
    return index + length;
  }
  if (index < -length) {
    return 0;
  }
  if (index >= length) {
    return undefined;
  }
  return index;
}

export class Infinarray<T> {
  private filePath: string;
  private checkpoints: Checkpoint[] = [];
  private randomElementsCache: { index: number; value: T }[] = [];
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

  private parseLine: (line: string) => T;
  private elementsPerCheckpoint: number;

  constructor(
    filePath: string,
    options: Partial<InfinarrayOptions<T>> = DEFAULT_OPTIONS
  ) {
    if (options.delimiter && Buffer.from(options.delimiter).length !== 1) {
      throw new Error('Delimiter must be a single byte character');
    }
    this.filePath = filePath;
    const fullConfig = { ...DEFAULT_OPTIONS, ...options };

    this.parseLine = fullConfig.parseLineFn;
    this.randomFn = fullConfig.randomFn;

    this.elementsPerCheckpoint = fullConfig.maxElementsPerCheckpoint;
    this.randomSampleSize = fullConfig.initRandomElementsCacheSize;
    this.delimiter = fullConfig.delimiter;
    this.skipHeader = fullConfig.skipHeader;
    this.enableCheckpointResizing = fullConfig.enableCheckpointDownsizing;
    this.minTriesBeforeResizing = fullConfig.minAccessesBeforeDownsizing;
    this.resizeCacheHitThreshold = fullConfig.resizeCacheHitThreshold;
    this.minElementsPerCheckpoint = fullConfig.minElementsPerCheckpoint;
    this.maxRandomSampleSize = fullConfig.maxRandomElementsCacheSize;
  }

  /**
   * Gets the length of the array. This is a number one higher than the highest index in the array.
   */
  get length() {
    return this.arrayLength;
  }

  /**
   * Gets the fraction of successful cache hits over the number of total accesses
   */
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
    await this.generateCheckpoints();
    this.ready = true;
    if (!this.isFullyInMemory()) {
      await this.generateRandomElementsCache();
    }
  }

  /**
   * Returns the item located at the specified index.
   * @param index The zero-based index of the desired code unit. A negative index will count back from the last item.
   */
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

  /**
   * Determines whether all the members of an array satisfy the specified test.
   * @param predicate A function that accepts up to three arguments. The every method calls
   * the predicate function for each element in the array until the predicate returns a value
   * which is coercible to the Boolean value false, or until the end of the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function.
   * If thisArg is omitted, undefined is used as the this value.
   */
  async every(
    predicate: (value: T, index: number, thisArg?: Infinarray<T>) => boolean,
    thisArg?: any
  ): Promise<boolean> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }

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
            if (!predicate.call(this, parsed, idx, this)) {
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

  /**
   * Returns the elements of an array that meet the condition specified in a callback function.
   * @param predicate A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value.
   */
  async filter(
    predicate: (value: T, index: number, array: Infinarray<T>) => unknown,
    thisArg?: any
  ): Promise<T[]> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
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
          if (predicate.call(thisArg, parsed, idx, this)) {
            filteredArray.push(parsed);
          }
          idx++;
          return callback();
        },
      })
    );

    return filteredArray;
  }

  /**
   * Returns the entry of the first element in the array where predicate is true, and undefined
   * otherwise.
   * @param predicate find calls predicate once for each element of the array, in ascending
   * order, until it finds one where predicate returns true. If such an element is found, find
   * immediately returns that element value. Otherwise, find returns undefined.
   * @param thisArg If provided, it will be used as the this value for each invocation of
   * predicate. If it is not provided, undefined is used instead.
   * @param fromIndex The position in this array at which to begin searching for entries.
   */
  async findFirstEntry(
    predicate: (value: T, index: number, obj: Infinarray<T>) => unknown,
    thisArg?: any,
    fromIndex = 0
  ): Promise<{ idx: number; value: T } | undefined> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    if (fromIndex >= this.length) {
      return undefined;
    }

    const startIndex = Math.max(0, fromIndex);

    if (this.isFullyInMemory() && this.cachedChunk) {
      for (let i = startIndex; i < this.cachedChunk.data.length; i++) {
        if (
          predicate.call(thisArg ?? this, this.cachedChunk.data[i], i, this)
        ) {
          return { idx: i, value: this.cachedChunk.data[i] };
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
    let entry: { idx: number; value: T } | undefined;
    try {
      await pipeline(
        readStream,
        linesAndBytes,
        new Writable({
          objectMode: true,
          write: (chunk, _, callback) => {
            if (idx >= startIndex) {
              const parsed = this.parseLine(chunk.line);
              if (!entry && predicate.call(this, parsed, idx, this)) {
                entry = { idx, value: parsed };
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

  /**
   * Returns the value of the first element in the array where predicate is true, and undefined
   * otherwise.
   * @param predicate find calls predicate once for each element of the array, in ascending
   * order, until it finds one where predicate returns true. If such an element is found, find
   * immediately returns that element value. Otherwise, find returns undefined.
   * @param thisArg If provided, it will be used as the this value for each invocation of
   * predicate. If it is not provided, undefined is used instead.
   */
  async find(
    predicate: (value: T, index: number, obj: Infinarray<T>) => unknown,
    thisArg?: any
  ): Promise<T | undefined> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.findFirstEntry(predicate, thisArg))?.value;
  }

  /**
   * Returns the index of the first element in the array where predicate is true, and -1
   * otherwise.
   * @param predicate find calls predicate once for each element of the array, in ascending
   * order, until it finds one where predicate returns true. If such an element is found,
   * findIndex immediately returns that element index. Otherwise, findIndex returns -1.
   * @param thisArg If provided, it will be used as the this value for each invocation of
   * predicate. If it is not provided, undefined is used instead.
   */
  async findIndex(
    predicate: (value: T, index: number, obj: Infinarray<T>) => unknown,
    thisArg?: any
  ): Promise<number> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.findFirstEntry(predicate, thisArg))?.idx ?? -1;
  }

  /**
   * Returns the entry of the last element in the array where predicate is true, and undefined
   * otherwise.
   * @param predicate findLastEntry calls predicate once for each element of the array, in ascending
   * order. findLastEntry returns the last entry that returned true for the predicate.
   * Otherwise, find returns undefined.
   * @param thisArg If provided, it will be used as the this value for each invocation of
   * predicate. If it is not provided, undefined is used instead.
   * @param fromIndex The position in this array at which to begin searching for entries.
   */
  async findLastEntry(
    predicate: (value: T, index: number, obj: Infinarray<T>) => unknown,
    thisArg?: any
  ): Promise<{ idx: number; value: T } | undefined> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    let entry: { idx: number; value: T } | undefined;
    if (this.isFullyInMemory() && this.cachedChunk) {
      for (let i = 0; i < this.cachedChunk.data.length; i++) {
        if (
          predicate.call(thisArg ?? this, this.cachedChunk.data[i], i, this)
        ) {
          entry = { idx: i, value: this.cachedChunk.data[i] };
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
          if (predicate.call(this, parsed, idx, this)) {
            entry = { idx, value: parsed };
          }
          idx++;
          return callback();
        },
      })
    );
    return entry;
  }

  /**
   * Returns the value of the last element in the array where predicate is true, and undefined
   * otherwise.
   * @param predicate findLast calls predicate once for each element of the array, in ascending
   * order. findLast returns the last value that returned true for the predicate.
   * Otherwise, find returns undefined.
   * @param thisArg If provided, it will be used as the this value for each invocation of
   * predicate. If it is not provided, undefined is used instead.
   */
  async findLast(
    predicate: (value: T, index: number, obj: Infinarray<T>) => unknown,
    thisArg?: any
  ): Promise<T | undefined> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.findLastEntry(predicate, thisArg))?.value;
  }

  /**
   * Returns the index of the last element in the array where predicate is true, and undefined
   * otherwise.
   * @param predicate findLastIndex calls predicate once for each element of the array, in ascending
   * order. findLastIndex returns the last index that returned true for the predicate.
   * Otherwise, find returns -1.
   * @param thisArg If provided, it will be used as the this value for each invocation of
   * predicate. If it is not provided, undefined is used instead.
   */
  async findLastIndex(
    predicate: (value: T, index: number, obj: Infinarray<T>) => unknown,
    thisArg?: any
  ): Promise<number> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.findLastEntry(predicate, thisArg))?.idx ?? -1;
  }

  /**
   * Performs the specified action for each element in an array.
   * @param callbackfn  A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array.
   * @param thisArg  An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
   */
  async forEach(
    callbackfn: (value: T, index: number, array: Infinarray<T>) => void,
    thisArg?: any
  ): Promise<void> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    if (this.isFullyInMemory() && this.cachedChunk) {
      for (let i = 0; i < this.cachedChunk.data.length; i++) {
        callbackfn.call(thisArg ?? this, this.cachedChunk.data[i], i, this);
      }
      return;
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
          callbackfn.call(this, parsed, idx, this);
          idx++;
          return callback();
        },
      })
    );
  }

  /**
   * Determines whether the specified callback function returns true for any element of an array.
   * @param predicate A function that accepts up to three arguments. The some method calls
   * the predicate function for each element in the array until the predicate returns a value
   * which is coercible to the Boolean value true, or until the end of the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function.
   * If thisArg is omitted, undefined is used as the this value.
   */
  async some(
    predicate: (value: T, index: number, array: Infinarray<T>) => unknown,
    thisArg?: any
  ): Promise<boolean> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    return (await this.find(predicate, thisArg)) != null;
  }

  /**
   * Determines whether an array includes a certain element, returning true or false as appropriate.
   * @param searchElement The element to search for.
   * @param fromIndex The position in this array at which to begin searching for searchElement.
   */
  async includes(searchElement: T, fromIndex = 0): Promise<boolean> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    // Consistent with equality implementation in prototype.Array.includes
    function sameValueZero(x: unknown, y: unknown) {
      if (typeof x === 'number' && typeof y === 'number') {
        // x and y are equal (may be -0 and 0) or they are both NaN
        // eslint-disable-next-line no-self-compare
        return x === y || (x !== x && y !== y);
      }
      return x === y;
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

  /**
   * Returns the index of the first occurrence of a value in an array, or -1 if it is not present.
   * @param searchElement The value to locate in the array.
   * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0.
   */
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
      )?.idx ?? -1
    );
  }

  /**
   * Returns a section of an array.
   * @param start The beginning of the specified portion of the array.
   * @param end The end of the specified portion of the array. This is exclusive of the element at the index 'end'.
   */
  async slice(start = 0, end = this.length): Promise<T[]> {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
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

  /**
   * Returns a random index from the array if not empty, and -1 otherwise.
   */
  sampleIndex() {
    if (!this.ready) {
      throw new Error(NOT_READY_ERROR);
    }
    if (this.length === 0) {
      return -1;
    }
    return Math.floor(this.randomFn() * this.length);
  }

  /**
   * Returns a random entry from the array if not empty, and undefined otherwise.
   */
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

  /**
   * Returns a random item from the array if not empty, and undefined otherwise.
   */
  async sampleValue(): Promise<T | undefined> {
    return (await this.sampleEntry())?.value;
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

  private async generateCheckpoints(warmupCacheIdx = 0) {
    const warmupCacheCheckpointIdx = Math.floor(
      warmupCacheIdx / this.elementsPerCheckpoint
    );

    const readStream = createReadStream(this.filePath);
    const linesAndBytes = getLines(this.delimiter, this.skipHeader);
    const checkpoints: Checkpoint[] = [];
    const precache: T[] = [];

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

    this.checkpoints = checkpoints;
  }

  private async generateRandomElementsCache() {
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
