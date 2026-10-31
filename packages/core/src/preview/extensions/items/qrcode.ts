/**
 * Minimal QR Code encoder (byte mode, ISO/IEC 18004) for the QR Code item, whose SVG APEX renders
 * on the server. Follows the structure of Project Nayuki's reference implementation.
 */

type Ecc = 'L' | 'M' | 'Q' | 'H';

const ECC_INDEX: Record<Ecc, number> = { L: 0, M: 1, Q: 2, H: 3 };
const FORMAT_BITS: Record<Ecc, number> = { L: 1, M: 0, Q: 3, H: 2 };

// prettier-ignore
const ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

// prettier-ignore
const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const bit = (value: number, index: number) => ((value >>> index) & 1) !== 0;

function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version: number, ecc: Ecc): number {
  const index = ECC_INDEX[ecc];
  return (
    Math.floor(rawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[index]![version]! * NUM_ERROR_CORRECTION_BLOCKS[index]![version]!
  );
}

function multiply(x: number, y: number): number {
  let z = 0;
  for (let index = 7; index >= 0; index -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> index) & 1) * x;
  }
  return z & 0xff;
}

function divisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = multiply(result[j]!, root);
      if (j + 1 < result.length) result[j]! ^= result[j + 1]!;
    }
    root = multiply(root, 0x02);
  }
  return result;
}

function remainder(data: number[], generator: number[]): number[] {
  const result = generator.map(() => 0);
  for (const value of data) {
    const factor = value ^ result.shift()!;
    result.push(0);
    generator.forEach((coefficient, index) => {
      result[index]! ^= multiply(coefficient, factor);
    });
  }
  return result;
}

function interleave(data: number[], version: number, ecc: Ecc): number[] {
  const index = ECC_INDEX[ecc];
  const blocks = NUM_ERROR_CORRECTION_BLOCKS[index]![version]!;
  const eccLength = ECC_CODEWORDS_PER_BLOCK[index]![version]!;
  const raw = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blocks - (raw % blocks);
  const shortLength = Math.floor(raw / blocks);
  const generator = divisor(eccLength);
  const parts: number[][] = [];
  for (let block = 0, offset = 0; block < blocks; block += 1) {
    const chunk = data.slice(offset, offset + shortLength - eccLength + (block < shortBlocks ? 0 : 1));
    offset += chunk.length;
    const check = remainder(chunk, generator);
    if (block < shortBlocks) chunk.push(0);
    parts.push([...chunk, ...check]);
  }
  const result: number[] = [];
  for (let position = 0; position < parts[0]!.length; position += 1)
    parts.forEach((part, block) => {
      if (position !== shortLength - eccLength || block >= shortBlocks) result.push(part[position]!);
    });
  return result;
}

class Matrix {
  readonly size: number;
  readonly modules: boolean[][];
  readonly fixed: boolean[][];

  constructor(readonly version: number) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  set(x: number, y: number, dark: boolean): void {
    this.modules[y]![x] = dark;
    this.fixed[y]![x] = true;
  }

  alignmentPositions(): number[] {
    if (this.version === 1) return [];
    const count = Math.floor(this.version / 7) + 2;
    const step = Math.floor((this.version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
    const result = [6];
    for (let position = this.size - 7; result.length < count; position -= step) result.splice(1, 0, position);
    return result;
  }

  functionPatterns(): void {
    for (let index = 0; index < this.size; index += 1) {
      this.set(6, index, index % 2 === 0);
      this.set(index, 6, index % 2 === 0);
    }
    for (const [cx, cy] of [
      [3, 3],
      [this.size - 4, 3],
      [3, this.size - 4],
    ] as const) {
      for (let dy = -4; dy <= 4; dy += 1)
        for (let dx = -4; dx <= 4; dx += 1) {
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < this.size && y >= 0 && y < this.size)
            this.set(x, y, distance !== 2 && distance !== 4);
        }
    }
    const positions = this.alignmentPositions();
    const count = positions.length;
    for (let i = 0; i < count; i += 1)
      for (let j = 0; j < count; j += 1) {
        if ((i === 0 && j === 0) || (i === 0 && j === count - 1) || (i === count - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy += 1)
          for (let dx = -2; dx <= 2; dx += 1)
            this.set(positions[i]! + dx, positions[j]! + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    this.format('M', 0);
    if (this.version >= 7) {
      let rem = this.version;
      for (let index = 0; index < 12; index += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (this.version << 12) | rem;
      for (let index = 0; index < 18; index += 1) {
        const dark = bit(bits, index);
        const a = this.size - 11 + (index % 3);
        const b = Math.floor(index / 3);
        this.set(a, b, dark);
        this.set(b, a, dark);
      }
    }
  }

  format(ecc: Ecc, mask: number): void {
    const data = (FORMAT_BITS[ecc] << 3) | mask;
    let rem = data;
    for (let index = 0; index < 10; index += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let index = 0; index <= 5; index += 1) this.set(8, index, bit(bits, index));
    this.set(8, 7, bit(bits, 6));
    this.set(8, 8, bit(bits, 7));
    this.set(7, 8, bit(bits, 8));
    for (let index = 9; index < 15; index += 1) this.set(14 - index, 8, bit(bits, index));
    for (let index = 0; index < 8; index += 1) this.set(this.size - 1 - index, 8, bit(bits, index));
    for (let index = 8; index < 15; index += 1) this.set(8, this.size - 15 + index, bit(bits, index));
    this.set(8, this.size - 8, true);
  }

  codewords(data: number[]): void {
    let index = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < this.size; vertical += 1)
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vertical : vertical;
          if (!this.fixed[y]![x] && index < data.length * 8) {
            this.modules[y]![x] = bit(data[index >>> 3]!, 7 - (index & 7));
            index += 1;
          }
        }
    }
  }

  mask(mask: number): void {
    for (let y = 0; y < this.size; y += 1)
      for (let x = 0; x < this.size; x += 1) {
        const invert = [
          (x + y) % 2 === 0,
          y % 2 === 0,
          x % 3 === 0,
          (x + y) % 3 === 0,
          (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
          ((x * y) % 2) + ((x * y) % 3) === 0,
          (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
          (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
        ][mask]!;
        if (!this.fixed[y]![x] && invert) this.modules[y]![x] = !this.modules[y]![x];
      }
  }

  /** Rules 1, 2 and 4 of the mask penalty (runs, 2x2 blocks, dark balance). */
  penalty(): number {
    let score = 0;
    const runs = (line: boolean[]) => {
      let run = 1;
      for (let index = 1; index <= line.length; index += 1) {
        if (index < line.length && line[index] === line[index - 1]) run += 1;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
    };
    for (let index = 0; index < this.size; index += 1) {
      runs(this.modules[index]!);
      runs(this.modules.map((row) => row[index]!));
    }
    let dark = 0;
    for (let y = 0; y < this.size; y += 1)
      for (let x = 0; x < this.size; x += 1) {
        if (this.modules[y]![x]) dark += 1;
        if (
          x < this.size - 1 &&
          y < this.size - 1 &&
          this.modules[y]![x] === this.modules[y]![x + 1] &&
          this.modules[y]![x] === this.modules[y + 1]![x] &&
          this.modules[y]![x] === this.modules[y + 1]![x + 1]
        )
          score += 3;
      }
    const total = this.size * this.size;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }
}

/** Module matrix (true = dark) for `text` encoded as UTF-8 bytes. */
export function qrMatrix(text: string, ecc: Ecc = 'M'): boolean[][] {
  const bytes = [...Buffer.from(text, 'utf8')];
  let version = 1;
  for (; version <= 40; version += 1) {
    const countBits = version <= 9 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(version, ecc) * 8) break;
  }
  if (version > 40) throw new Error('QR code data is too long');
  const capacity = dataCodewords(version, ecc) * 8;
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let index = length - 1; index >= 0; index -= 1) bits.push((value >>> index) & 1);
  };
  push(0x4, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const value of bytes) push(value, 8);
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8)
    data.push(bits.slice(index, index + 8).reduce((value, next) => (value << 1) | next, 0));

  const codewords = interleave(data, version, ecc);
  let best: Matrix | undefined;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const matrix = new Matrix(version);
    matrix.functionPatterns();
    matrix.codewords(codewords);
    matrix.mask(mask);
    matrix.format(ecc, mask);
    const score = matrix.penalty();
    if (score < bestScore) {
      best = matrix;
      bestScore = score;
    }
  }
  return best!.modules;
}

/** SVG markup like the one APEX returns for `a-qrcode` (one path, quiet zone of 4 modules). */
export function qrSvg(
  text: string,
  options: { size?: number; foreground?: string; background?: string } = {},
): string {
  const modules = qrMatrix(text);
  const border = 4;
  const dimension = modules.length + border * 2;
  const path: string[] = [];
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path.push(`M${x + border},${y + border}h1v1h-1z`);
    }),
  );
  const size = options.size ?? 160;
  const attr = (value: string) => value.replace(/[^#\w(),.% -]/gu, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" width="${size}" height="${size}" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${attr(options.background ?? '#ffffff')}"/><path fill="${attr(options.foreground ?? '#000000')}" d="${path.join('')}"/></svg>`;
}
