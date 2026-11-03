import { createHash } from 'node:crypto';
import type http from 'node:http';
import type { Duplex } from 'node:stream';

/**
 * A minimal RFC 6455 WebSocket server endpoint for the local preview: the opening handshake,
 * unfragmented and fragmented text frames, ping/pong and close. The preview only pushes small
 * JSON messages to browsers on the loopback interface, so there are no extensions or subprotocols.
 */

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
/** Client messages are tiny (pings, page changes); anything larger closes the connection. */
const MAX_MESSAGE = 64 * 1024;

const OP_CONTINUATION = 0x0;
const OP_TEXT = 0x1;
const OP_BINARY = 0x2;
const OP_CLOSE = 0x8;
const OP_PING = 0x9;
const OP_PONG = 0xa;

export const acceptKey = (key: string) =>
  createHash('sha1')
    .update(key + GUID)
    .digest('base64');

/** One unmasked server frame (servers never mask). */
export function encodeFrame(opcode: number, payload: Buffer = Buffer.alloc(0)): Buffer {
  const length = payload.length;
  const header = length < 126 ? Buffer.alloc(2) : length < 65_536 ? Buffer.alloc(4) : Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  if (length < 126) header[1] = length;
  else if (length < 65_536) {
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

export interface Frame {
  fin: boolean;
  opcode: number;
  payload: Buffer;
}

/** Splits a byte stream into frames; returns undefined on a protocol error. */
export class FrameReader {
  #buffer: Buffer = Buffer.alloc(0);

  push(chunk: Buffer): Frame[] | undefined {
    this.#buffer = this.#buffer.length ? Buffer.concat([this.#buffer, chunk]) : chunk;
    const frames: Frame[] = [];
    for (;;) {
      const buffer = this.#buffer;
      if (buffer.length < 2) return frames;
      const fin = (buffer[0]! & 0x80) !== 0;
      const opcode = buffer[0]! & 0x0f;
      const masked = (buffer[1]! & 0x80) !== 0;
      let length = buffer[1]! & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < 4) return frames;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) return frames;
        const big = buffer.readBigUInt64BE(2);
        if (big > BigInt(MAX_MESSAGE)) return undefined;
        length = Number(big);
        offset = 10;
      }
      // Clients must mask every frame (RFC 6455 5.1).
      if (!masked || length > MAX_MESSAGE) return undefined;
      if (buffer.length < offset + 4 + length) return frames;
      const mask = buffer.subarray(offset, offset + 4);
      const payload = Buffer.from(buffer.subarray(offset + 4, offset + 4 + length));
      for (let index = 0; index < payload.length; index += 1) payload[index]! ^= mask[index % 4]!;
      frames.push({ fin, opcode, payload });
      this.#buffer = buffer.subarray(offset + 4 + length);
    }
  }
}

export interface WebSocketConnection {
  send(message: unknown): void;
  close(code?: number): void;
  readonly open: boolean;
}

export interface WebSocketHandlers {
  message?: (text: string) => void;
  close?: () => void;
}

/** Rejects an upgrade request with a plain HTTP status. */
export function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

/**
 * Completes the opening handshake on an `upgrade` request and returns the connection, or
 * undefined after rejecting a request that is not a valid version 13 WebSocket upgrade.
 */
export function acceptWebSocket(
  request: http.IncomingMessage,
  socket: Duplex,
  head: Buffer,
  handlers: WebSocketHandlers,
): WebSocketConnection | undefined {
  const key = request.headers['sec-websocket-key'];
  if (
    request.method !== 'GET' ||
    !/\bwebsocket\b/iu.test(request.headers.upgrade ?? '') ||
    typeof key !== 'string' ||
    request.headers['sec-websocket-version'] !== '13'
  ) {
    rejectUpgrade(socket, 400, 'Bad Request');
    return undefined;
  }
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey(key)}`,
      '',
      '',
    ].join('\r\n'),
  );
  let open = true;
  const reader = new FrameReader();
  let fragments: Buffer[] = [];
  const finish = () => {
    if (!open) return;
    open = false;
    handlers.close?.();
  };
  const connection: WebSocketConnection = {
    get open() {
      return open && !socket.destroyed;
    },
    send(message) {
      if (!connection.open) return;
      socket.write(encodeFrame(OP_TEXT, Buffer.from(JSON.stringify(message), 'utf8')));
    },
    close(code = 1000) {
      if (!connection.open) return;
      const payload = Buffer.alloc(2);
      payload.writeUInt16BE(code);
      socket.end(encodeFrame(OP_CLOSE, payload));
      finish();
    },
  };
  const receive = (chunk: Buffer) => {
    const frames = reader.push(chunk);
    if (!frames) return connection.close(1002);
    for (const frame of frames) {
      if (frame.opcode === OP_CLOSE) return connection.close();
      if (frame.opcode === OP_PING) {
        socket.write(encodeFrame(OP_PONG, frame.payload));
        continue;
      }
      if (frame.opcode === OP_PONG) continue;
      if (frame.opcode === OP_BINARY) return connection.close(1003);
      if (![OP_TEXT, OP_CONTINUATION].includes(frame.opcode)) return connection.close(1002);
      fragments.push(frame.payload);
      if (fragments.reduce((total, part) => total + part.length, 0) > MAX_MESSAGE)
        return connection.close(1009);
      if (!frame.fin) continue;
      const text = Buffer.concat(fragments).toString('utf8');
      fragments = [];
      handlers.message?.(text);
    }
  };
  socket.on('data', receive);
  socket.on('close', finish);
  socket.on('error', finish);
  if (head.length) receive(head);
  return connection;
}
