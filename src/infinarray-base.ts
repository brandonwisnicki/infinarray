export function clampIndex(index: number, length: number): number | undefined {
  const idx = index;
  if (-length <= idx && idx < 0) {
    return idx + length;
  }
  if (idx < -length) {
    return 0;
  }
  if (idx >= length) {
    return undefined;
  }
  return idx;
}

// Consistent with equality implementation in prototype.Array.includes
export function sameValueZero(x: unknown, y: unknown) {
  if (typeof x === 'number' && typeof y === 'number') {
    // x and y are equal (may be -0 and 0) or they are both NaN
    // eslint-disable-next-line no-self-compare
    return x === y || (x !== x && y !== y);
  }
  return x === y;
}

export abstract class InfinarrayBase<T> {
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
  abstract every(
    predicate: (
      value: T,
      index: number,
      thisArg?: InfinarrayBase<T>
    ) => boolean,
    thisArg?: any
  ): Promise<boolean>;

  /**
   * Returns the elements of an array that meet the condition specified in a callback function.
   * @param predicate A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value.
   */
  abstract filter(
    predicate: (value: T, index: number, array: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<T[]>;

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
  abstract findFirstEntry(
    predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown,
    thisArg?: any,
    fromIndex?: number
  ): Promise<{ index: number; value: T } | undefined>;

  /**
   * Returns the value of the first element in the array where predicate is true, and undefined
   * otherwise.
   * @param predicate find calls predicate once for each element of the array, in ascending
   * order, until it finds one where predicate returns true. If such an element is found, find
   * immediately returns that element value. Otherwise, find returns undefined.
   * @param thisArg If provided, it will be used as the this value for each invocation of
   * predicate. If it is not provided, undefined is used instead.
   */
  abstract find(
    predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<T | undefined>;

  /**
   * Returns the index of the first element in the array where predicate is true, and -1
   * otherwise.
   * @param predicate find calls predicate once for each element of the array, in ascending
   * order, until it finds one where predicate returns true. If such an element is found,
   * findIndex immediately returns that element index. Otherwise, findIndex returns -1.
   * @param thisArg If provided, it will be used as the this value for each invocation of
   * predicate. If it is not provided, undefined is used instead.
   */
  abstract findIndex(
    predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<number>;

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
  abstract findLastEntry(
    predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<{ index: number; value: T } | undefined>;

  /**
   * Returns the value of the last element in the array where predicate is true, and undefined
   * otherwise.
   * @param predicate findLast calls predicate once for each element of the array, in ascending
   * order. findLast returns the last value that returned true for the predicate.
   * Otherwise, find returns undefined.
   * @param thisArg If provided, it will be used as the this value for each invocation of
   * predicate. If it is not provided, undefined is used instead.
   */
  abstract findLast(
    predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<T | undefined>;

  /**
   * Returns the index of the last element in the array where predicate is true, and undefined
   * otherwise.
   * @param predicate findLastIndex calls predicate once for each element of the array, in ascending
   * order. findLastIndex returns the last index that returned true for the predicate.
   * Otherwise, find returns -1.
   * @param thisArg If provided, it will be used as the this value for each invocation of
   * predicate. If it is not provided, undefined is used instead.
   */
  abstract findLastIndex(
    predicate: (value: T, index: number, obj: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<number>;

  /**
   * Performs the specified action for each element in an array.
   * @param callbackfn  A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array.
   * @param thisArg  An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
   */
  abstract forEach(
    callbackfn: (value: T, index: number, array: InfinarrayBase<T>) => void,
    thisArg?: any
  ): Promise<void>;

  /**
   * Determines whether the specified callback function returns true for any element of an array.
   * @param predicate A function that accepts up to three arguments. The some method calls
   * the predicate function for each element in the array until the predicate returns a value
   * which is coercible to the Boolean value true, or until the end of the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function.
   * If thisArg is omitted, undefined is used as the this value.
   */
  abstract some(
    predicate: (value: T, index: number, array: InfinarrayBase<T>) => unknown,
    thisArg?: any
  ): Promise<boolean>;

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
  abstract sampleEntry(): Promise<
    | {
        index: number;
        value: any;
      }
    | undefined
  >;

  /**
   * Returns a random item from the array if not empty, and undefined otherwise.
   */
  abstract sampleValue(): Promise<T | undefined>;
}
