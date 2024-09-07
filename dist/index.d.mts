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
declare class Infinarray<T> {
    private filePath;
    private checkpoints;
    private randomElementsCache;
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
    private parseLine;
    private elementsPerCheckpoint;
    constructor(filePath: string, options?: Partial<InfinarrayOptions<T>>);
    /**
     * Gets the length of the array. This is a number one higher than the highest index in the array.
     */
    get length(): number;
    /**
     * Gets the fraction of successful cache hits over the number of total accesses
     */
    get cacheHitRatio(): number;
    /**
     * Initializes and loads the array. This must be called before any array operations.
     */
    init(): Promise<void>;
    /**
     * Returns the item located at the specified index.
     * @param index The zero-based index of the desired code unit. A negative index will count back from the last item.
     */
    at(index: number): Promise<T | undefined>;
    /**
     * Determines whether all the members of an array satisfy the specified test.
     * @param predicate A function that accepts up to three arguments. The every method calls
     * the predicate function for each element in the array until the predicate returns a value
     * which is coercible to the Boolean value false, or until the end of the array.
     * @param thisArg An object to which the this keyword can refer in the predicate function.
     * If thisArg is omitted, undefined is used as the this value.
     */
    every(predicate: (value: T, index: number, thisArg?: Infinarray<T>) => boolean, thisArg?: any): Promise<boolean>;
    /**
     * Returns the elements of an array that meet the condition specified in a callback function.
     * @param predicate A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array.
     * @param thisArg An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value.
     */
    filter(predicate: (value: T, index: number, array: Infinarray<T>) => unknown, thisArg?: any): Promise<T[]>;
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
    findFirstEntry(predicate: (value: T, index: number, obj: Infinarray<T>) => unknown, thisArg?: any, fromIndex?: number): Promise<{
        idx: number;
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
    find(predicate: (value: T, index: number, obj: Infinarray<T>) => unknown, thisArg?: any): Promise<T | undefined>;
    /**
     * Returns the index of the first element in the array where predicate is true, and -1
     * otherwise.
     * @param predicate find calls predicate once for each element of the array, in ascending
     * order, until it finds one where predicate returns true. If such an element is found,
     * findIndex immediately returns that element index. Otherwise, findIndex returns -1.
     * @param thisArg If provided, it will be used as the this value for each invocation of
     * predicate. If it is not provided, undefined is used instead.
     */
    findIndex(predicate: (value: T, index: number, obj: Infinarray<T>) => unknown, thisArg?: any): Promise<number>;
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
    findLastEntry(predicate: (value: T, index: number, obj: Infinarray<T>) => unknown, thisArg?: any): Promise<{
        idx: number;
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
    findLast(predicate: (value: T, index: number, obj: Infinarray<T>) => unknown, thisArg?: any): Promise<T | undefined>;
    /**
     * Returns the index of the last element in the array where predicate is true, and undefined
     * otherwise.
     * @param predicate findLastIndex calls predicate once for each element of the array, in ascending
     * order. findLastIndex returns the last index that returned true for the predicate.
     * Otherwise, find returns -1.
     * @param thisArg If provided, it will be used as the this value for each invocation of
     * predicate. If it is not provided, undefined is used instead.
     */
    findLastIndex(predicate: (value: T, index: number, obj: Infinarray<T>) => unknown, thisArg?: any): Promise<number>;
    /**
     * Performs the specified action for each element in an array.
     * @param callbackfn  A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array.
     * @param thisArg  An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
     */
    forEach(callbackfn: (value: T, index: number, array: Infinarray<T>) => void, thisArg?: any): Promise<void>;
    /**
     * Determines whether the specified callback function returns true for any element of an array.
     * @param predicate A function that accepts up to three arguments. The some method calls
     * the predicate function for each element in the array until the predicate returns a value
     * which is coercible to the Boolean value true, or until the end of the array.
     * @param thisArg An object to which the this keyword can refer in the predicate function.
     * If thisArg is omitted, undefined is used as the this value.
     */
    some(predicate: (value: T, index: number, array: Infinarray<T>) => unknown, thisArg?: any): Promise<boolean>;
    /**
     * Determines whether an array includes a certain element, returning true or false as appropriate.
     * @param searchElement The element to search for.
     * @param fromIndex The position in this array at which to begin searching for searchElement.
     */
    includes(searchElement: T, fromIndex?: number): Promise<boolean>;
    /**
     * Returns the index of the first occurrence of a value in an array, or -1 if it is not present.
     * @param searchElement The value to locate in the array.
     * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0.
     */
    indexOf(searchElement: T, fromIndex?: number): Promise<number>;
    /**
     * Returns a section of an array.
     * @param start The beginning of the specified portion of the array.
     * @param end The end of the specified portion of the array. This is exclusive of the element at the index 'end'.
     */
    slice(start?: number, end?: number): Promise<T[]>;
    /**
     * Returns a random index from the array if not empty, and -1 otherwise.
     */
    sampleIndex(): number;
    /**
     * Returns a random entry from the array if not empty, and undefined otherwise.
     */
    sampleEntry(): Promise<{
        index: number;
        value: any;
    } | undefined>;
    /**
     * Returns a random item from the array if not empty, and undefined otherwise.
     */
    sampleValue(): Promise<T | undefined>;
    private get;
    private isFullyInMemory;
    private generateCheckpoints;
    private generateRandomElementsCache;
}

export { Infinarray };
