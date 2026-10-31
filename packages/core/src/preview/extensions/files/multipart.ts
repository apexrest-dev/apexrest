import type { UploadedFile } from '../../extensions.ts';

/** Fields and files of a request body (url-encoded or multipart/form-data). */
export interface ParsedBody {
  form: URLSearchParams;
  files: UploadedFile[];
}

function header(head: string, name: string): string | undefined {
  return new RegExp(`^${name}:\\s*(.*)$`, 'imu').exec(head)?.[1]?.trim();
}

function parameter(value: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|;)\\s*${name}\\*?=\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|([^;]*))`, 'iu').exec(
    value,
  );
  if (!match) return undefined;
  const raw = match[1] !== undefined ? match[1].replace(/\\(.)/gu, '$1') : (match[2] ?? '').trim();
  // RFC 5987 filename*=UTF-8''name
  const extended = /^utf-8''(.*)$/iu.exec(raw);
  return extended ? decodeURIComponent(extended[1]!) : raw;
}

/** Parses multipart/form-data as browsers send it (FormData from apex.server and apex.page.submit). */
export function parseMultipart(body: Buffer, contentType: string): ParsedBody {
  const boundary = parameter(contentType, 'boundary');
  const form = new URLSearchParams();
  const files: UploadedFile[] = [];
  if (!boundary) return { form, files };
  const delimiter = Buffer.from(`--${boundary}`);
  let position = body.indexOf(delimiter);
  while (position >= 0) {
    let start = position + delimiter.length;
    if (body[start] === 0x2d && body[start + 1] === 0x2d) break; // closing --boundary--
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;
    const next = body.indexOf(delimiter, start);
    if (next < 0) break;
    let end = next;
    if (body[end - 2] === 0x0d && body[end - 1] === 0x0a) end -= 2;
    const part = body.subarray(start, end);
    const split = part.indexOf('\r\n\r\n');
    if (split >= 0) {
      const head = part.subarray(0, split).toString('utf8');
      const content = part.subarray(split + 4);
      const disposition = header(head, 'content-disposition') ?? '';
      const name = parameter(disposition, 'name') ?? '';
      const filename = parameter(disposition, 'filename');
      if (filename !== undefined) {
        // an empty file input still sends a part without a file name
        if (filename !== '' || content.length)
          files.push({
            field: name,
            filename: filename.replace(/^.*[\\/]/u, ''),
            mimeType: header(head, 'content-type') ?? 'application/octet-stream',
            data: Buffer.from(content),
          });
      } else form.append(name, content.toString('utf8'));
    }
    position = next;
  }
  return { form, files };
}

export function parseBody(body: Buffer, contentType: string | undefined): ParsedBody {
  if (/^multipart\/form-data/iu.test(contentType ?? '')) return parseMultipart(body, contentType!);
  return { form: new URLSearchParams(body.toString('utf8')), files: [] };
}
