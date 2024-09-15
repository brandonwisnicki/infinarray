import { Infinarray } from './infinarray';
import { clampIndex, InfinarrayBase, sameValueZero } from './infinarray-base';

export class InfinarrayView<TMaterial, TView> extends InfinarrayBase<TView> {
  materialArray: Infinarray<TMaterial>;
  mapFn: (row: TMaterial) => TView;
  constructor(array: Infinarray<TMaterial>, mapFn: (row: TMaterial) => TView) {
    super();
    this.materialArray = array;
    this.mapFn = mapFn;
  }

  get length(): number {
    return this.materialArray.length;
  }

  get cacheHitRatio(): number {
    return this.materialArray.cacheHitRatio;
  }

  async at(index: number): Promise<TView | undefined> {
    const val = await this.materialArray.at(index);
    if (val !== undefined) {
      return this.mapFn(val);
    }
    return undefined;
  }

  every(
    predicate: (
      value: TView,
      index: number,
      thisArg?: InfinarrayBase<TView> | undefined
    ) => boolean,
    thisArg?: any
  ): Promise<boolean> {
    return this.materialArray.every(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );
  }

  async filter(
    predicate: (
      value: TView,
      index: number,
      array: InfinarrayBase<TView>
    ) => unknown,
    thisArg?: any
  ): Promise<TView[]> {
    const arr = await this.materialArray.filter(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );
    return arr.map(this.mapFn);
  }

  async findFirstEntry(
    predicate: (
      value: TView,
      index: number,
      obj: InfinarrayBase<TView>
    ) => unknown,
    thisArg?: any,
    fromIndex?: number
  ): Promise<{ index: number; value: TView } | undefined> {
    const firstEntry = await this.materialArray.findFirstEntry(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg,
      fromIndex
    );

    if (firstEntry) {
      return { index: firstEntry.index, value: this.mapFn(firstEntry.value) };
    } else {
      return undefined;
    }
  }

  async find(
    predicate: (
      value: TView,
      index: number,
      obj: InfinarrayBase<TView>
    ) => unknown,
    thisArg?: any
  ): Promise<TView | undefined> {
    const val = await this.materialArray.find(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );

    if (val) {
      return this.mapFn(val);
    } else {
      return undefined;
    }
  }

  findIndex(
    predicate: (
      value: TView,
      index: number,
      obj: InfinarrayBase<TView>
    ) => unknown,
    thisArg?: any
  ): Promise<number> {
    return this.materialArray.findIndex(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );
  }

  async findLastEntry(
    predicate: (
      value: TView,
      index: number,
      obj: InfinarrayBase<TView>
    ) => unknown,
    thisArg?: any
  ): Promise<{ index: number; value: TView } | undefined> {
    const lastEntry = await this.materialArray.findLastEntry(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );

    if (lastEntry) {
      return { index: lastEntry.index, value: this.mapFn(lastEntry.value) };
    } else {
      return undefined;
    }
  }

  async findLast(
    predicate: (
      value: TView,
      index: number,
      obj: InfinarrayBase<TView>
    ) => unknown,
    thisArg?: any
  ): Promise<TView | undefined> {
    const val = await this.materialArray.findLast(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );

    if (val) {
      return this.mapFn(val);
    } else {
      return undefined;
    }
  }

  findLastIndex(
    predicate: (
      value: TView,
      index: number,
      obj: InfinarrayBase<TView>
    ) => unknown,
    thisArg?: any
  ): Promise<number> {
    return this.materialArray.findLastIndex(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );
  }

  async forEach(
    callbackfn: (
      value: TView,
      index: number,
      array: InfinarrayBase<TView>
    ) => void,
    thisArg?: any
  ): Promise<void> {
    this.materialArray.forEach(
      (value, index) => callbackfn(this.mapFn(value), index, this),
      thisArg
    );
  }

  some(
    predicate: (
      value: TView,
      index: number,
      array: InfinarrayBase<TView>
    ) => unknown,
    thisArg?: any
  ): Promise<boolean> {
    return this.materialArray.some(
      (value, index) => predicate(this.mapFn(value), index, this),
      thisArg
    );
  }

  async includes(searchElement: TView, fromIndex = 0): Promise<boolean> {
    const from = clampIndex(fromIndex, this.length);
    if (from == null) {
      return false;
    }
    return (
      (await this.materialArray.findFirstEntry(
        (val) => sameValueZero(this.mapFn(val), searchElement),
        undefined,
        from
      )) != null
    );
  }

  async indexOf(searchElement: TView, fromIndex = 0): Promise<number> {
    const from = clampIndex(fromIndex, this.length);
    if (from == null) {
      return -1;
    }
    return (
      (
        await this.materialArray.findFirstEntry(
          (val) => this.mapFn(val) === searchElement,
          undefined,
          from
        )
      )?.index ?? -1
    );
  }

  async slice(start?: number, fromIndex = this.length): Promise<TView[]> {
    const slicedArray = await this.materialArray.slice(start, fromIndex);
    return slicedArray.map(this.mapFn);
  }

  sampleIndex(): number {
    return this.materialArray.sampleIndex();
  }

  async sampleEntry(): Promise<{ index: number; value: any } | undefined> {
    const entry = await this.materialArray.sampleEntry();
    if (entry) {
      return { index: entry.index, value: this.mapFn(entry.value) };
    } else {
      return undefined;
    }
  }

  async sampleValue(): Promise<TView | undefined> {
    const value = await this.materialArray.sampleValue();

    if (value) {
      return this.mapFn(value);
    } else {
      return undefined;
    }
  }
}
