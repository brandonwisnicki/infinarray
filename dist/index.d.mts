declare abstract class InfinarrayBase<T> {
    /**
     * Gets the length of the array. This is a number one higher than the highest index in the array.
     */
    abstract get length(): number;
    /**
     * Gets the fraction of successful cache hits over the number of total accesses
     */
    abstract get cacheHitRatio(): number;
    /**
     * Returns the item located at the specified index.
     * @param index The zero-based index of the desired code unit. A negative index will count back from the last item.
     */
    abstract at(index: number): Promise<T | undefined>;
    /**
     * Determines whether all the members of an array satisfy the specified test.
     * @param predicate A function that accepts up to three arguments. The every method calls
     * the predicate function for each element in the array until the predicate returns a value
     * which is coercible to the Boolean value false, or until the end of the array.
     * @param thisArg An object to which the this keyword can refer in the predicate function.
     * If thisArg is omitted, undefined is used as the this value.
     */
    abstract every(predicate: (value: T, index: number, thisArg?: InfinarrayBase<T>) => boolean, thisArg?: any): Promise<boolean>;
    /**
     * Returns the elements of an array that meet the condition specified in a callback function.
     * @param predicate A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array.
     * @param thisArg An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value.
     */
    abstract filter(predicate: (value: T, index: number, array: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<T[]>;
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
    abstract findFirstEntry(predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown, thisArg?: any, fromIndex?: number): Promise<{
        index: number;
        value: T;
    } | undefined>;
    /**
     * Returns the value of the first element in the array where predicate is true, and undefined
     * otherwise.
     * @param predicate find calls predicate once for each element of the array, in ascending
     * order, until it finds one where predicate returns true. If such an element is found, find
     * immediately returns that element value. Otherwise, find returns undefined.
     * @param thisArg If provided, it will be used as the this value for each invocation of
     * predicate. If it is not provided, undefined is used instead.
     */
    abstract find(predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<T | undefined>;
    /**
     * Returns the index of the first element in the array where predicate is true, and -1
     * otherwise.
     * @param predicate find calls predicate once for each element of the array, in ascending
     * order, until it finds one where predicate returns true. If such an element is found,
     * findIndex immediately returns that element index. Otherwise, findIndex returns -1.
     * @param thisArg If provided, it will be used as the this value for each invocation of
     * predicate. If it is not provided, undefined is used instead.
     */
    abstract findIndex(predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<number>;
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
    abstract findLastEntry(predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<{
        index: number;
        value: T;
    } | undefined>;
    /**
     * Returns the value of the last element in the array where predicate is true, and undefined
     * otherwise.
     * @param predicate findLast calls predicate once for each element of the array, in ascending
     * order. findLast returns the last value that returned true for the predicate.
     * Otherwise, find returns undefined.
     * @param thisArg If provided, it will be used as the this value for each invocation of
     * predicate. If it is not provided, undefined is used instead.
     */
    abstract findLast(predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<T | undefined>;
    /**
     * Returns the index of the last element in the array where predicate is true, and undefined
     * otherwise.
     * @param predicate findLastIndex calls predicate once for each element of the array, in ascending
     * order. findLastIndex returns the last index that returned true for the predicate.
     * Otherwise, find returns -1.
     * @param thisArg If provided, it will be used as the this value for each invocation of
     * predicate. If it is not provided, undefined is used instead.
     */
    abstract findLastIndex(predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<number>;
    /**
     * Performs the specified action for each element in an array.
     * @param callbackfn  A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array.
     * @param thisArg  An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
     */
    abstract forEach(callbackfn: (value: T, index: number, array: InfinarrayBase<T>) => void, thisArg?: any): Promise<void>;
    /**
     * Determines whether the specified callback function returns true for any element of an array.
     * @param predicate A function that accepts up to three arguments. The some method calls
     * the predicate function for each element in the array until the predicate returns a value
     * which is coercible to the Boolean value true, or until the end of the array.
     * @param thisArg An object to which the this keyword can refer in the predicate function.
     * If thisArg is omitted, undefined is used as the this value.
     */
    abstract some(predicate: (value: T, index: number, array: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<boolean>;
    /**
     * Determines whether an array includes a certain element, returning true or false as appropriate.
     * @param searchElement The element to search for.
     * @param fromIndex The position in this array at which to begin searching for searchElement.
     */
    abstract includes(searchElement: T, fromIndex?: number): Promise<boolean>;
    /**
     * Returns the index of the first occurrence of a value in an array, or -1 if it is not present.
     * @param searchElement The value to locate in the array.
     * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0.
     */
    abstract indexOf(searchElement: T, fromIndex?: number): Promise<number>;
    /**
     * Returns a section of an array.
     * @param start The beginning of the specified portion of the array.
     * @param end The end of the specified portion of the array. This is exclusive of the element at the index 'end'.
     */
    abstract slice(start?: number, end?: number): Promise<T[]>;
    /**
     * Returns a random index from the array if not empty, and -1 otherwise.
     */
    abstract sampleIndex(): number;
    /**
     * Returns a random entry from the array if not empty, and undefined otherwise.
     */
    abstract sampleEntry(): Promise<{
        index: number;
        value: any;
    } | undefined>;
    /**
     * Returns a random item from the array if not empty, and undefined otherwise.
     */
    abstract sampleValue(): Promise<T | undefined>;
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
declare class Infinarray<T> extends InfinarrayBase<T> {
    /**
     * Enables readonly mode for the object.
     * In readonly mode, the underlying array file cannot be changed.
     * This must be false to use the `push` function
     */
    readonly: boolean;
    private filePath;
    private checkpoints;
    private randomElementsCache;
    private pushedValuesBuffer;
    private maxPushedValuesBufferSize;
    private cachedChunk;
    private ready;
    private cacheHits;
    private cacheMisses;
    private arrayLength;
    private randomSampleSize;
    private delimiter;
    private skipHeader;
    private enableCheckpointResizing;
    private minTriesBeforeResizing;
    private resizeCacheHitThreshold;
    private minElementsPerCheckpoint;
    private maxRandomSampleSize;
    private randomFn;
    private stringifyFn;
    private parseLine;
    private elementsPerCheckpoint;
    constructor(filePath: string, options?: Partial<InfinarrayOptions<T>>);
    get length(): number;
    get cacheHitRatio(): number;
    /**
     * Initializes and loads the array. This must be called before any array operations.
     */
    init(): Promise<void>;
    at(index: number): Promise<T | undefined>;
    every(predicate: (value: T, index: number, thisArg?: InfinarrayBase<T>) => boolean, thisArg?: any): Promise<boolean>;
    filter(predicate: (value: T, index: number, array: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<T[]>;
    findFirstEntry(predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown, thisArg?: any, fromIndex?: number): Promise<{
        index: number;
        value: T;
    } | undefined>;
    find(predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<T | undefined>;
    findIndex(predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<number>;
    findLastEntry(predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<{
        index: number;
        value: T;
    } | undefined>;
    findLast(predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<T | undefined>;
    findLastIndex(predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<number>;
    forEach(callbackfn: (value: T, index: number, array: InfinarrayBase<T>) => void, thisArg?: any): Promise<void>;
    some(predicate: (value: T, index: number, array: InfinarrayBase<T>) => unknown, thisArg?: any): Promise<boolean>;
    includes(searchElement: T, fromIndex?: number): Promise<boolean>;
    indexOf(searchElement: T, fromIndex?: number): Promise<number>;
    slice(start?: number, end?: number): Promise<T[]>;
    sampleIndex(): number;
    sampleEntry(): Promise<{
        index: number;
        value: any;
    } | undefined>;
    sampleValue(): Promise<T | undefined>;
    /**
     * Calls a defined callback function on each element of an array, and writes an array to a file that contains the results.
     * @param filePath The file path to write the new mapped data to
     * @param callbackfn A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array.
     * @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
     */
    map<U>(filePath: string, callbackfn: (value: T, index: number, array: Infinarray<T>) => U, options?: Partial<{
        stringifyFn: (value: U) => string;
        delimiter: string;
    }>, thisArg?: any): Promise<void>;
    /**
     * Appends new elements to the end of an array, and returns the new length of the array.
     * Readonly mode must be disabled to use this function as this manipulates the underlying file
     * @param items New elements to add to the array.
     */
    push(...items: T[]): Promise<number>;
    /**
     * This flushes the buffer of pushed values, writing everything to the file.
     * If data has been pushed to the Infinarray, this must be called before the
     * Infinarray object goes out of scope, otherwise data may be lost.
     */
    flushPushedValues(): Promise<void>;
    private get;
    private isFullyInMemory;
    private isIndexInPushBuffer;
    private generateCheckpoints;
    private generateRandomElementsCache;
}

declare class InfinarrayView<TMaterial, TView> extends InfinarrayBase<TView> {
    materialArray: Infinarray<TMaterial>;
    mapFn: (row: TMaterial) => TView;
    constructor(array: Infinarray<TMaterial>, mapFn: (row: TMaterial) => TView);
    get length(): number;
    get cacheHitRatio(): number;
    at(index: number): Promise<TView | undefined>;
    every(predicate: (value: TView, index: number, thisArg?: InfinarrayBase<TView> | undefined) => boolean, thisArg?: any): Promise<boolean>;
    filter(predicate: (value: TView, index: number, array: InfinarrayBase<TView>) => unknown, thisArg?: any): Promise<TView[]>;
    findFirstEntry(predicate: (value: TView, index: number, obj: InfinarrayBase<TView>) => unknown, thisArg?: any, fromIndex?: number): Promise<{
        index: number;
        value: TView;
    } | undefined>;
    find(predicate: (value: TView, index: number, obj: InfinarrayBase<TView>) => unknown, thisArg?: any): Promise<TView | undefined>;
    findIndex(predicate: (value: TView, index: number, obj: InfinarrayBase<TView>) => unknown, thisArg?: any): Promise<number>;
    findLastEntry(predicate: (value: TView, index: number, obj: InfinarrayBase<TView>) => unknown, thisArg?: any): Promise<{
        index: number;
        value: TView;
    } | undefined>;
    findLast(predicate: (value: TView, index: number, obj: InfinarrayBase<TView>) => unknown, thisArg?: any): Promise<TView | undefined>;
    findLastIndex(predicate: (value: TView, index: number, obj: InfinarrayBase<TView>) => unknown, thisArg?: any): Promise<number>;
    forEach(callbackfn: (value: TView, index: number, array: InfinarrayBase<TView>) => void, thisArg?: any): Promise<void>;
    some(predicate: (value: TView, index: number, array: InfinarrayBase<TView>) => unknown, thisArg?: any): Promise<boolean>;
    includes(searchElement: TView, fromIndex?: number): Promise<boolean>;
    indexOf(searchElement: TView, fromIndex?: number): Promise<number>;
    slice(start?: number, fromIndex?: number): Promise<TView[]>;
    sampleIndex(): number;
    sampleEntry(): Promise<{
        index: number;
        value: any;
    } | undefined>;
    sampleValue(): Promise<TView | undefined>;
}

export { Infinarray, InfinarrayView };
