/* eslint-disable dot-notation */
import assert from 'node:assert';
import test, { suite } from 'node:test';
import Infinarray from '../src';

const BIG_FILE_PATH = './test/data/big_file.json';
const SMALL_FILE_PATH = './test/data/small_file.json';
const SMALL_FILE_HEADER_PATH = './test/data/small_file_header.json';

const TINY_FILE_PATH = './test/data/tiny_file.json';
const EMPTY_FILE_PATH = './test/data/empty.json';

suite('infinarray', () => {
  suite('init', () => {
    test('big file', async () => {
      const arr = new Infinarray<any[]>(BIG_FILE_PATH);
      await arr.init();

      assert.strictEqual(arr.length, 1_000_000);
    });

    test('small file', async (t) => {
      const arr = new Infinarray<any[]>(SMALL_FILE_PATH);
      await arr.init();

      assert.strictEqual(arr.length, 250);
    });

    test('tiny file', async (t) => {
      const arr = new Infinarray<any[]>(TINY_FILE_PATH);
      await arr.init();

      assert.strictEqual(arr.length, 4);
    });

    test('empty file', async (t) => {
      const arr = new Infinarray<any[]>(EMPTY_FILE_PATH);
      await arr.init();

      assert.strictEqual(arr.length, 0);
    });
  });

  suite('placeholder suite', () => {
    test('placeholder test', async () => {});
  });

  suite('configurations', () => {
    test('skip header', async () => {
      const arr = new Infinarray<string[]>(SMALL_FILE_HEADER_PATH, {
        skipHeader: true,
      });
      await arr.init();

      assert.strictEqual(arr.length, 250);
      assert.deepStrictEqual(await arr.at(0), [
        'Banded Sea Krait',
        'Turaco',
        'Hermit Crab',
      ]);
    });
  });

  suite('random', () => {
    test('resize', async () => {
      const arr = new Infinarray<any[]>(BIG_FILE_PATH);
      await arr.init();
      const originalSampleCountSize = arr['randomSampleSize'];
      const elems = [];
      for (let i = 0; i < originalSampleCountSize; i++) {
        elems.push(await arr.sampleEntry());
      }
      assert.strictEqual(elems.length, originalSampleCountSize);
      assert.strictEqual(arr['randomElementsCache'].length, 0);

      assert.notStrictEqual(await arr.sampleEntry(), undefined);

      assert.strictEqual(
        arr['randomElementsCache'].length,
        originalSampleCountSize * 2 - 1
      );
    });
  });

  suite('slice', () => {
    test('stream', async () => {
      const arr = new Infinarray<string>(BIG_FILE_PATH);
      await arr.init();

      assert.strictEqual((await arr.slice(0, 10)).length, 10);

      assert.strictEqual((await arr.slice(-100, -10)).length, 90);
      assert.strictEqual((await arr.slice()).length, arr.length);
    });

    test('fully in memory', async () => {
      const arr = new Infinarray<string>(SMALL_FILE_PATH);
      await arr.init();

      assert.strictEqual((await arr.slice(0, 10)).length, 10);
      assert.strictEqual((await arr.slice(-100, -10)).length, 90);

      assert.strictEqual((await arr.slice()).length, arr.length);
    });
  });

  suite('indexOf', () => {
    test('stream', async () => {
      const arr = new Infinarray<string>(BIG_FILE_PATH, {
        parseLineFn: (line) => line.toString(),
      });
      await arr.init();

      assert.strictEqual(
        await arr.indexOf('["Banded Sea Krait","Turaco","Hermit Crab"]'),
        0
      );

      assert.strictEqual(
        await arr.indexOf('["Banded Sea Krait","Turaco","Hermit Crab"]', 1),
        -1
      );

      assert.strictEqual(
        await arr.indexOf('["Baboon","Falcon","Stick Insects"]'),
        583_655
      );

      assert.strictEqual(
        await arr.indexOf('["Baboon","loch ness","Stick Insects"]'),
        -1
      );
    });

    test('fully in memory', async () => {
      const arr = new Infinarray<string>(SMALL_FILE_PATH, {
        parseLineFn: (line) => line.toString(),
      });
      await arr.init();

      assert.strictEqual(
        await arr.indexOf(`["Banded Sea Krait","Turaco","Hermit Crab"]`),
        0
      );

      assert.strictEqual(
        await arr.indexOf(`["Banded Sea Krait","Turaco","Hermit Crab"]`, 1),
        -1
      );

      assert.strictEqual(
        await arr.indexOf(`["Geese","Honey","Fennec Fox"]`),
        133
      );

      assert.strictEqual(
        await arr.indexOf(`["Baboon","loch ness","Stick Insects"]`),
        -1
      );
    });
  });

  suite('includes', () => {
    test('stream', async () => {
      const arr = new Infinarray<string>(BIG_FILE_PATH, {
        parseLineFn: (line) => line.toString(),
      });
      await arr.init();

      assert.strictEqual(
        await arr.includes(`["Banded Sea Krait","Turaco","Hermit Crab"]`),
        true
      );
      assert.strictEqual(
        await arr.includes(`["Banded Sea Krait","Turaco","Hermit Crab"]`, 1),
        false
      );

      assert.strictEqual(await arr.includes(`hello world!`, 1), false);

      assert.strictEqual(await arr.includes(`seadragon`, 1_000_001), false);
    });

    test('negative from', async () => {
      const arr = new Infinarray<string>(BIG_FILE_PATH, {
        parseLineFn: (line) => line.toString(),
      });
      await arr.init();

      assert.strictEqual(
        await arr.includes(
          `["Banded Sea Krait","Turaco","Hermit Crab"]`,
          -1_000_000
        ),
        true
      );
      assert.strictEqual(
        await arr.includes(
          `["Banded Sea Krait","Turaco","Hermit Crab"]`,
          -999_999
        ),
        false
      );

      assert.strictEqual(await arr.includes(`hello world!`, -1_000_001), false);
    });
  });

  suite('for each', () => {
    test('incrementer', async () => {
      const arr = new Infinarray<string[]>(BIG_FILE_PATH);
      await arr.init();
      let counter = 0;

      await arr.forEach((val, idx) => counter++);

      assert.strictEqual(counter, 1_000_000);
    });

    test('count hogs', async () => {
      const arr = new Infinarray<string[]>(BIG_FILE_PATH);
      await arr.init();
      let counter = 0;

      await arr.forEach(
        (val, idx) =>
          (counter += val.filter((anim) =>
            anim.toLowerCase().includes('hogs')
          ).length)
      );

      assert.strictEqual(counter, 19_828);
    });

    test('count hogs in memory', async () => {
      const arr = new Infinarray<string[]>(SMALL_FILE_PATH);
      await arr.init();
      let counter = 0;

      await arr.forEach(
        (val, idx) =>
          (counter += val.filter((anim) =>
            anim.toLowerCase().includes('hogs')
          ).length)
      );

      assert.strictEqual(counter, 5);
    });
  });

  suite('find first entry', () => {
    test('stream', async () => {
      const arr = new Infinarray<string[]>(BIG_FILE_PATH);
      await arr.init();

      const res = await arr.findFirstEntry((val) =>
        val.some((animal) => animal.toLowerCase().includes('seadragon'))
      );

      assert.deepStrictEqual(res, {
        idx: 255,
        value: ['Leafy Seadragon', 'French Angelfish', 'Guinea Pig'],
      });

      const res2 = await arr.findFirstEntry((val) =>
        val.some((animal) => animal.toLowerCase().includes('loch ness monster'))
      );

      assert.deepStrictEqual(res2, undefined);

      const res3 = await arr.findFirstEntry(
        (val) =>
          val.some((animal) => animal.toLowerCase().includes('seadragon')),
        undefined,
        500
      );

      assert.deepStrictEqual(res3, {
        idx: 548,
        value: ['Leafy Seadragon', 'Hawaiian Honeycreeper', 'Duck'],
      });
    });

    test('fully in memory', async () => {
      const arr = new Infinarray<string[]>(SMALL_FILE_PATH);
      await arr.init();

      const res = await arr.findFirstEntry((val) =>
        val.some((animal) => animal.toLowerCase().includes('polar bear'))
      );
      assert.deepStrictEqual(res, {
        idx: 11,
        value: ['Polar Bear', 'Devil Fish', 'Horse'],
      });

      const res2 = await arr.findFirstEntry((val) =>
        val.some((animal) => animal.toLowerCase().includes('loch ness monster'))
      );

      assert.deepStrictEqual(res2, undefined);
    });
  });

  suite('find last entry', () => {
    test('stream', async () => {
      const arr = new Infinarray<string[]>(BIG_FILE_PATH);
      await arr.init();

      const res = await arr.findLastEntry((val) =>
        val.some((animal) => animal.toLowerCase().includes('seadragon'))
      );

      assert.deepStrictEqual(res, {
        idx: 999_101,
        value: ['Ant', 'Leafy Seadragon', 'Courser'],
      });

      const res2 = await arr.findLastEntry((val) =>
        val.some((animal) => animal.toLowerCase().includes('loch ness monster'))
      );

      assert.deepStrictEqual(res2, undefined);
    });

    test('fully in memory', async () => {
      const arr = new Infinarray<string[]>(SMALL_FILE_PATH);
      await arr.init();

      const res = await arr.findLastEntry((val) =>
        val.some((animal) => animal.toLowerCase().includes('pigs and hogs'))
      );
      assert.deepStrictEqual(res, {
        idx: 248,
        value: ['Barbet', 'Pigs and Hogs', 'Pigeon'],
      });

      const res2 = await arr.findLastEntry((val) =>
        val.some((animal) => animal.toLowerCase().includes('loch ness monster'))
      );

      assert.deepStrictEqual(res2, undefined);
    });
  });

  suite('filter', () => {
    test('filter sea dragons', async () => {
      const arr = new Infinarray<string[]>(BIG_FILE_PATH);
      await arr.init();

      const res = await arr.filter((val) =>
        val.some((animal) => animal.toLowerCase().includes('seadragon'))
      );
      assert.strictEqual(res.length, 1409);
    });

    test('get every 10 thousandth row', async () => {
      const arr = new Infinarray<string[]>(BIG_FILE_PATH);
      await arr.init();

      const res = await arr.filter((_, idx) => idx % 10000 === 0);
      assert.deepStrictEqual(res[30], [
        'Guinea Fowl',
        'Brown Bear',
        'Flatfish',
      ]);
      assert.strictEqual(res.length, 100);
    });
  });

  suite('every', () => {
    test('every true', async () => {
      const arr = new Infinarray<string[]>(BIG_FILE_PATH);
      await arr.init();

      const res = await arr.every((val, idx) => val.length === 3);
      assert.strictEqual(res, true);
    });

    test('every true', async () => {
      const arr = new Infinarray<string[]>(BIG_FILE_PATH);
      await arr.init();

      const res = await arr.every((val, idx) => idx > -1);
      assert.strictEqual(res, true);
    });

    test('every false idx', async () => {
      const arr = new Infinarray<string[]>(BIG_FILE_PATH);
      await arr.init();

      const res = await arr.every((val, idx) => idx < 999_998);
      assert.strictEqual(res, false);
    });

    test('every false val', async () => {
      const arr = new Infinarray<string[]>(BIG_FILE_PATH);
      await arr.init();

      const res = await arr.every((val, idx) => val[0].includes(' '));
      assert.strictEqual(res, false);
    });
  });

  suite('at', () => {
    test('get positive index', async () => {
      const arr = new Infinarray<string[]>(SMALL_FILE_PATH);
      await arr.init();
      assert.deepStrictEqual(await arr.at(0), [
        'Banded Sea Krait',
        'Turaco',
        'Hermit Crab',
      ]);

      assert.deepStrictEqual(await arr.at(249), [
        'Sturgeon',
        'Chinchillas',
        'Ostrich',
      ]);

      assert.deepStrictEqual(await arr.at(250), undefined);
    });

    test('get negative index', async () => {
      const arr = new Infinarray<string[]>(SMALL_FILE_PATH);
      await arr.init();
      assert.deepStrictEqual(await arr.at(-250), [
        'Banded Sea Krait',
        'Turaco',
        'Hermit Crab',
      ]);

      assert.deepStrictEqual(await arr.at(-1), [
        'Sturgeon',
        'Chinchillas',
        'Ostrich',
      ]);

      assert.deepStrictEqual(await arr.at(-251), undefined);
    });
  });
});
