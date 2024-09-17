import { Infinarray, InfinarrayView } from 'infinarray';

const main = async () => {
  const arr = new Infinarray<any[]>('./test/temp/test.jsonl', {
    readonly: false,
    maxPushedValuesBufferSize: 4096,
  });
  await arr.init();
  const view = new InfinarrayView(arr, (r) => r[0]);
  const view2 = new InfinarrayView(arr, (r) => r[1]);
  console.log('starting');
  const buf: any[][] = [];
  for (let i = 0; i < 10000; i++) {
    await arr.push(['hello', i]);
    await view.at(i);
    await view2.at((i * 2) % view2.length);
  }
  // await arr.push(...buf);
  await arr.flushPushedValues();
  await arr.flushPushedValues();
  await arr.flushPushedValues();
};

main();
