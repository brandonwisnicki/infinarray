![](logo.png)

# Infinarray - Work with [infinitely sized](https://en.wikipedia.org/wiki/False_advertising#Puffing) arrays

### Infinarray allows you to access large files as if it were an array.

Call array functions like `filter` and `forEach` without having to think about streams. Infinarray caches array data to allow for fast sequential array indexing and fast random sampling. Infinarray also supports array manipulation with `push` and `map`. Supports [jsonl](https://jsonlines.org/) out of the box

## Quick Start

### Installation: `npm i infinarray`

```typescript
import { Infinarray } from 'infinarray';

const array = new Infinarray<string>('./my-big-file.txt');
await array.init();

await array.at(10_000_000); // get the value at line 10,000,000

await array.sampleValue(); // get a random value in the array

await array.includes(value);

await array.filter((el) => el === 'foobar'); // returns a js array of filtered elements
```

See [below](#api) for all available functions

## Use Case

Infinarray might be useful to you if

- You need a layer of indirection with streams
- You need to repeatedly open new streams for the same file
- You need random and sequential array reads

This is my use case for building Infinarray. It is currently being used to allow users to write code working with large files without needing to constantly use streams just to get a single element from the array.

## Features

- Enjoy the low memory footprint of streams with the flexibility of in-memory arrays
- Automatically caches elements you will likely use to prevent unnecessary file reads
- Update the array and the underlying file through `Infinarray.push`
- Use all the most common JS array operations you already know
- Fully type-safe
- Built around Node.js streams

## API

Infinarray currently supports the following functions the standard JS Arrays.

#### ⚠️🚨Don't forget to `await` these functions. These are all promises🚨⚠️

- `at`
- `find`
- `findIndex`
- `every`
- `some`
- `includes`
- `filter`
- `findLast`
- `findLastIndex`
- `forEach`
- `indexOf`
- `slice`
- `push`[\*](#writing-to-infinarray)
- `map`

Infinarray also has a few of its own functions to improve DX such as...

- `sampleValue` - Returns a random value from the array (faster than `array.get(randomIndex())`)
- `findEntry` - Like `find`, but returns both the index and value
- `findLastEntry` - Like `findLast`, but returns both the index and value

## Usage & Options

The Infinarray constructor takes in a file path string, and optionally a configuration object. The generic type represents the type of each row.

`music.txt`

```json
["Artist", "Year of Birth", "Country"]
["Billy Joel", 1949, "USA"]
["Elton John", 1947, "England"]
["Paul Simon", 1941, "USA"]
```

```typescript
import { Infinarray } from 'infinarray';

const myArray = new Infinarray<[string, number, string]>('music.txt', {
  delimiter: '\n',
  skipHeader: true,
  parseLineFn: JSON.parse,
});
await myArray.init();

myArray.length; // 3
```

All configuration options are below:

`delimiter: string`: The string of characters that are used to split each element in the readable stream. The delimeter is removed from the array elements. (default: `'\n'`)

`skipHeader: boolean`: Skips the first line of the file (default: `false`)

`parseLineFn: (line: string) => T`: Converts the text string to the generic type of the `Infinarray` object. This is called on every element split by the `delimiter` (default: `JSON.parse`)

`stringifyFn: (value: T) => string`: Converts the item type into a string that can be inserted into the underlying data file. You should _not_ include the delimiter in this function as Infinarray automatically handles it already. (default: `JSON.stringify`)

`randomFn: () => number`: A function that returns a value in [0, 1]. This is used for randomly sampling values (default: `Math.random`)

`readonly: boolean`: When this is false, Infinarray is allowed to manipulate the contents of the array through the `push` command. (default: `true`)

`maxElementsPerCheckpoint: number`: The maximum number of elements that a single checkpoint can reference. The cache stores a all of the data reference by a single checkpoint, so increasing this will increase your memory footprint. (default: `4096`)

`minElementsPerCheckpoint`: The number of elements per checkpoint will never be downsized below this value. (default: `64`)

`maxRandomElementsCacheSize`: The maximum number of elements that can be stored in the random elements cache. Increase this value if you are accessing a large number of random values. (default: `65536`)

`initRandomElementsCacheSize`: The initial number of elements in the random elements cache. (default: `512`)

`maxPushedValuesBufferSize`: The maximum number of pushed elements that can be stored in-memory, before being flushed and written to the underlying file. (default: `1024`)

`enableCheckpointDownsizing`: If enabled, the elements per checkpoint will be halved when the `cacheHitRatio` dips below the `resizeCacheHitThreshold`. When the cache hit ratio is very low, then the cache is likely not useful, and the array will be faster with smaller checkpoint sizes. (default: `true`)

`minAccessesBeforeDownsizing`: The number of array accesses with `at` to allow before checking if a downsize should occur. This is important to give a fair sample size before deciding if a downsize is needed. (default: `15`)

`resizeCacheHitThreshold`: The ratio that the `cacheHitRatio` must stay above to prevent downsizing. Higher values will lead to much more aggresive downsizing. Set to `0` to never downsize (default: `0.5`)

## Writing to Infinarray

While Infinarray supports pushing items to the array, it is essential to flush the pushed values buffer before the process exits or before the Infinarray object goes out of scope, otherwise data may be lost. If `maxPushedValuesBufferSize` is set to 0, flushing is not required, however, this will have high performance implications as a file handle is created on each push.

```typescript
import { Infinarray } from 'infinarray';

const array = new Infinarray<string>('./my-big-file.jsonl', {
  readonly: false,
  maxPushedValuesBufferSize: 1024,
});
await array.init();

await array.push('foo');
await array.push('bar');
await array.push(...['foo', 'bar', 'foo']);

// ⚠️🚨 Don't forget to call this! 🚨⚠️
await array.flushPushedValues();
```

This package also supports creating brand new array files through `Infinarray.map`. This does not require flushing as it does not use the buffer.

```typescript
await arr.map(`my-new-array.jsonl`, (val, idx) => `${idx}) ${val}`, {
  delimiter: '\n', // default
  stringifyFn: JSON.stringify, // default
});
```

To work with this new array, you must create a new Infinarray object pointing to this path

## Benchmarks

The benchmarking program is in `test/benchmark.ts`

These are results from a machine with a Intel i7-14700K, 32GB RAM

```
┌───────────────────────────────────────┬─────────────┬────────────────────────┬────────────┬─────────┐
│ Task                                  │ ops/sec     │ Average Time (ms)      │ Margin     │ Samples │
├───────────────────────────────────────┼─────────────┼────────────────────────┼────────────┼─────────┤
│ 'load file - 1m row file'             │ '1'         │ 874.8188999999996      │ '±0.36%'   │ 10      │
│ 'load file - 150k row file'           │ '7'         │ 136.0815599999998      │ '±0.76%'   │ 10      │
│ 'load file - 250 row file'            │ '3,051'     │ 0.3276722986247347     │ '±1.32%'   │ 1527    │
│ 'load file - 4 row file'              │ '7,284'     │ 0.1372766675816727     │ '±1.36%'   │ 3643    │
│ 'sequential read - 1m row file'       │ '1,056,431' │ 0.0009465825108564938  │ '±14.31%'  │ 528385  │
│ 'sequential read - 150k row file'     │ '1,039,074' │ 0.0009623946131193574  │ '±14.27%'  │ 519633  │
│ 'sequential read - 250 row file'      │ '6,649,973' │ 0.00015037654271179697 │ '±0.69%'   │ 3324988 │
│ 'sequential read - 4 row file'        │ '6,104,166' │ 0.00016382252257783711 │ '±1.97%'   │ 3052084 │
│ 'random sample - 1m row file'         │ '700'       │ 1.4270456140351684     │ '±195.97%' │ 513     │
│ 'random sample - 150k row file'       │ '27,706'    │ 0.036093145593134424   │ '±87.14%'  │ 15873   │
│ 'random sample - 250 row file'        │ '5,504,555' │ 0.0001816677191208119  │ '±0.67%'   │ 2752298 │
│ 'random sample - 4 row file'          │ '5,530,562' │ 0.00018081342156039352 │ '±0.67%'   │ 2765282 │
│ 'slice 2500 elements - 1m row file'   │ '400'       │ 2.496337810945246      │ '±1.56%'   │ 201     │
│ 'slice 2500 elements - 150k row file' │ '407'       │ 2.4522663414635177     │ '±1.99%'   │ 205     │
└───────────────────────────────────────┴─────────────┴────────────────────────┴────────────┴─────────┘
```

## Contributing

I am far from an expert on streams, caching, or life in general, and I'm always looking to improve this package. If you see some glaring issues, find a bug, or have any questions, please file an issue on the GitHub repo. I am also open to any PRs if you are feeling generous!
