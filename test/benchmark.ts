/* eslint-disable @typescript-eslint/naming-convention */
import { Bench, Task } from 'tinybench';
import Infinarray from '../src/infinarray';

const BIG_FILE_PATH = './test/data/big_file.json';
const MEDIUM_FILE_PATH = './test/data/medium_file.json';
const SMALL_FILE_PATH = './test/data/small_file.json';
const TINY_FILE_PATH = './test/data/tiny_file.json';
const EMPTY_FILE_PATH = './test/data/empty.json';

let arr: Infinarray<any> | undefined;
let i = 0;

const initArray = (path: string) => {
  return async () => {
    arr = new Infinarray<any[]>(path);
    i = 0;
    await arr.init();
  };
};

const iterateI = () => {
  i++;
  if (i >= arr!.length) {
    i = 0;
  }
};

const destroyArray = () => {
  arr = undefined;
  i = 0;
};

const bench = new Bench({
  // time: 10000,
  teardown: destroyArray,
});

const files = [
  {
    name: '1m row file',
    path: BIG_FILE_PATH,
  },
  {
    name: '150k row file',
    path: MEDIUM_FILE_PATH,
  },
  {
    name: '250 row file',
    path: SMALL_FILE_PATH,
  },
  {
    name: '4 row file',
    path: TINY_FILE_PATH,
  },
];

const benchmarks: (
  | {
      name: string;
      fn: () => Promise<void>;
      preloadArray: true;
      iterateI: boolean;
      onlyFilesIdx?: number[];
    }
  | {
      name: string;
      fn: (path: string) => () => Promise<void>;
      preloadArray: false;
      iterateI: boolean;
      onlyFilesIdx?: number[];
    }
)[] = [
  {
    name: 'load file',
    fn: (path: string) => {
      return async () => {
        const arr = new Infinarray<any[]>(path);
        await arr.init();
      };
    },
    preloadArray: false,
    iterateI: false,
  },
  {
    name: 'sequential read',
    fn: async () => {
      const res = await arr!.at(i);
    },
    preloadArray: true,
    iterateI: true,
  },
  {
    name: 'random sample',
    fn: async () => {
      const res = await arr!.sampleValue();
    },
    preloadArray: true,
    iterateI: false,
  },
  {
    name: 'slice 2500 elements',
    fn: async () => {
      const middle = Math.floor((arr!.length - 2500) * Math.random()) + 1250;
      const start = middle - 1250;
      const end = middle + 1250;
      const res = await arr!.slice(start, end);
    },
    onlyFilesIdx: [0, 1],
    preloadArray: true,
    iterateI: false,
  },
];

benchmarks.forEach((benchmark) => {
  files.forEach((file, idx) => {
    if (!benchmark.onlyFilesIdx || benchmark.onlyFilesIdx.includes(idx)) {
      const fn = benchmark.preloadArray
        ? benchmark.fn
        : benchmark.fn(file.path);
      bench.add(`${benchmark.name} - ${file.name}`, fn, {
        beforeAll: benchmark.preloadArray ? initArray(file.path) : undefined,
        afterEach: benchmark.iterateI ? iterateI : undefined,
      });
    }
  });
});

await bench.warmup();
await bench.run();

console.table(
  bench.table((task) => {
    if (task.result) {
      if (task.result.error) {
        throw task.result.error;
      }
      return {
        'Task Name': task.name,
        'ops/sec': task.result.error
          ? 'NaN'
          : parseInt(task.result.hz.toString(), 10).toLocaleString(),
        'Average Time (ms)': task.result.error ? 'NaN' : task.result.mean,
        Margin: task.result.error
          ? 'NaN'
          : `\xb1${task.result.rme.toFixed(2)}%`,
        Samples: task.result.error ? 'NaN' : task.result.samples.length,
      };
    }
    return {
      'Task Name': task.name,
      'ops/sec': 'Error',
      'Average Time (ms)': 'Error',
      Margin: 'Error',
      Samples: 'Error',
    };
  })
);
