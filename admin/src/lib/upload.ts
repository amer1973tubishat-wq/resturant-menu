import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { env } from './env';

/** Only these ever reach disk, and only after magic-byte confirmation. */
const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
]);

export type UploadResult = {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  url: string;
  thumbUrl: string;
  mediumUrl: string;
};

export class UploadError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

/**
 * The extension and the browser-supplied Content-Type are both attacker
 * controlled, so neither is trusted: the real type comes from the file's
 * magic bytes. A polyglot that lies about being a PNG is rejected here.
 */
export async function processUpload(file: File): Promise<UploadResult> {
  if (file.size > env.MAX_UPLOAD_BYTES) {
    throw new UploadError(`File exceeds ${Math.round(env.MAX_UPLOAD_BYTES / 1024 / 1024)}MB`, 'TOO_LARGE');
  }
  if (file.size === 0) throw new UploadError('File is empty', 'EMPTY');

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = await fileTypeFromBuffer(buffer);

  if (!sniffed || !ALLOWED.has(sniffed.mime)) {
    throw new UploadError(
      `Unsupported file type${sniffed ? ` (${sniffed.mime})` : ''}. Allowed: JPEG, PNG, WebP, AVIF, GIF`,
      'BAD_TYPE',
    );
  }

  // An SVG would sniff as XML/text and is already rejected above — worth
  // stating plainly, since SVG is a script-execution vector.
  let meta: Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new UploadError('File is not a readable image', 'CORRUPT');
  }
  if (!meta.width || !meta.height) throw new UploadError('Could not read image dimensions', 'CORRUPT');

  // Random name: the client's filename never influences the path we write to.
  const id = crypto.randomBytes(16).toString('hex');
  const dir = env.UPLOAD_DIR;
  await fs.mkdir(dir, { recursive: true });

  const full = `${id}.webp`;
  const medium = `${id}-md.webp`;
  const thumb = `${id}-sm.webp`;

  // rotate() applies EXIF orientation and drops the rest of the metadata,
  // which also strips GPS coordinates from phone photos.
  const base = sharp(buffer, { failOn: 'error' }).rotate();

  await base.clone().resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 }).toFile(path.join(dir, full));
  await base.clone().resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 }).toFile(path.join(dir, medium));
  await base.clone().resize(240, 240, { fit: 'cover', position: 'centre' })
    .webp({ quality: 72 }).toFile(path.join(dir, thumb));

  const stat = await fs.stat(path.join(dir, full));

  return {
    filename: full,
    originalName: sanitiseName(file.name),
    mimeType: 'image/webp',
    size: stat.size,
    width: meta.width,
    height: meta.height,
    url: `/uploads/${full}`,
    mediumUrl: `/uploads/${medium}`,
    thumbUrl: `/uploads/${thumb}`,
  };
}

/** Kept only for display in the media library — never used as a path. */
function sanitiseName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, '').slice(0, 120) || 'image';
}

export async function deleteUploadFiles(filename: string): Promise<void> {
  const id = filename.replace(/\.webp$/, '');
  // Refuse anything that is not the random id we generated, so a crafted
  // Media row can never point the unlink at another directory.
  if (!/^[0-9a-f]{32}$/.test(id)) throw new UploadError('Refusing to delete unexpected filename', 'BAD_NAME');
  await Promise.all(
    [`${id}.webp`, `${id}-md.webp`, `${id}-sm.webp`].map((f) =>
      fs.unlink(path.join(env.UPLOAD_DIR, f)).catch(() => {}),
    ),
  );
}
