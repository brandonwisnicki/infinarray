import assert from 'node:assert';
import test, { suite } from 'node:test';
import { Infinarray, InfinarrayView } from '../src';

const BIG_FILE_PATH = './test/data/big_file.jsonl';
const SMALL_FILE_PATH = './test/data/small_file.jsonl';
const SMALL_FILE_HEADER_PATH = './test/data/small_file_header.jsonl';
const MEDIUM_FILE_PATH = './test/data/medium_file.jsonl';
const TINY_FILE_PATH = './test/data/tiny_file.jsonl';
const EMPTY_FILE_PATH = './test/data/empty.jsonl';

suite('infinarray view', () => {
  suite('init', () => {
    test('big file', async () => {
      const arr = new Infinarray<any[]>(BIG_FILE_PATH);
      await arr.init();
      const view = new InfinarrayView(arr, (row: any[]) => row.join(','));

      assert.strictEqual(arr.length, view.length);
      assert.strictEqual(((await arr.at(0)) ?? []).join(','), await view.at(0));
    });

    test('small file', async (t) => {
      const arr = new Infinarray<any[]>(SMALL_FILE_PATH);
      await arr.init();

      const view = new InfinarrayView(arr, (row: any[]) => row.join(','));

      assert.strictEqual(arr.length, view.length);
      assert.strictEqual(((await arr.at(0)) ?? []).join(','), await view.at(0));
    });

    test('tiny file', async (t) => {
      const arr = new Infinarray<any[]>(TINY_FILE_PATH);
      await arr.init();

      const view = new InfinarrayView(arr, (row: any[]) => row.join(','));

      assert.strictEqual(arr.length, view.length);
      assert.strictEqual(((await arr.at(0)) ?? []).join(','), await view.at(0));
    });

    test('empty file', async (t) => {
      const arr = new Infinarray<any[]>(EMPTY_FILE_PATH);
      await arr.init();

      const view = new InfinarrayView(arr, (row: any[]) => row.join(','));

      assert.strictEqual(arr.length, view.length);
    });
  });
});
