import { Transform } from 'stream';

/*
  Attribution: Adapted from https://github.com/max-mapper/binary-split
*/

const nextSplitPatternIdx = (
  buf: Buffer,
  offset: number,
  bytesToMatch: Buffer
) => {
  if (offset >= buf.length) return -1;
  let i;
  for (i = offset; i < buf.length; i++) {
    if (buf[i] === bytesToMatch[0]) {
      if (bytesToMatch.length > 1) {
        let fullMatch = true;
        let j = i;
        // eslint-disable-next-line id-length
        for (let k = 0; j < i + bytesToMatch.length; j++, k++) {
          if (buf[j] !== bytesToMatch[k]) {
            fullMatch = false;
            break;
          }
        }
        if (fullMatch) return j - bytesToMatch.length;
      } else {
        break;
      }
    }
  }

  const idx = i + bytesToMatch.length - 1;
  return idx;
};

export const getLines = (splitString = '\n', skipFirstLine = false) => {
  const splitBuffer = Buffer.from(splitString);

  let buffered: Uint8Array | undefined;
  let numberBytes = 0;
  let currIdx = 0;

  let firstLineSkipped = !skipFirstLine;

  return new Transform({
    readableObjectMode: true,
    transform(chunk: Buffer, _, cb) {
      let buffer = chunk;
      let offset = 0;
      let lastSplitIdx = 0;
      if (buffered) {
        buffer = Buffer.concat([buffered, chunk]);
        offset = buffered.length;
        buffered = undefined;
      }

      while (true) {
        const splitCharIdx = nextSplitPatternIdx(
          buffer,
          offset - splitBuffer.length + 1,
          splitBuffer
        );

        if (splitCharIdx !== -1 && splitCharIdx < buffer.length) {
          if (lastSplitIdx !== splitCharIdx) {
            const line = buffer.subarray(lastSplitIdx, splitCharIdx);
            if (firstLineSkipped) {
              this.push({
                idx: currIdx++,
                byteIdx: numberBytes,
                line: line.toString('utf8'),
              });
            } else {
              firstLineSkipped = true;
            }
            numberBytes += line.length + 1;
          }
          offset = splitCharIdx + splitBuffer.length;
          lastSplitIdx = offset;
        } else {
          buffered = buffer.subarray(lastSplitIdx);
          break;
        }
      }

      cb();
    },

    flush(cb) {
      if (buffered && buffered.length > 0) {
        if (firstLineSkipped) {
          this.push({
            idx: currIdx++,
            byteIdx: numberBytes,
            line: Buffer.from(buffered).toString('utf8'),
          });
        } else {
          firstLineSkipped = true;
        }
        numberBytes += buffered.length + 1;
      }
      cb();
    },
  });
};
