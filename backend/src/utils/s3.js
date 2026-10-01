import crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectTaggingCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/* Report files (scans, photos, PDFs) attached to medical records live in
   a private S3 bucket. The phone never gets AWS credentials: it asks the
   API for a short-lived signed link that can upload exactly one file to
   exactly one key, and later for one that can read it back.

   Keys: users/<ownerUserId>/records/<random>.<ext> — the IAM policy only
   allows users/*, and every read/attach checks the key is under the
   caller's (or shared owner's) own folder.

   Abandoned uploads: a file is uploaded tagged status=pending, and only
   becomes status=attached once a record is saved with it. The bucket's
   lifecycle rule deletes anything still pending after a day, so a report
   picked and then never saved doesn't sit in the bucket for ever.

   Credentials come from the environment (AWS_ACCESS_KEY_ID /
   AWS_SECRET_ACCESS_KEY) or, on EC2, the instance role — the SDK finds
   either by itself. */

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const ATTACHMENT_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};
const UPLOAD_TTL_S = 5 * 60;
const VIEW_TTL_S = 5 * 60;

let client = null;
const bucket = () => process.env.S3_BUCKET;

export const s3Configured = () => Boolean(process.env.S3_BUCKET && process.env.AWS_REGION);

function s3() {
  client ||= new S3Client({ region: process.env.AWS_REGION });
  return client;
}

export const userRecordsPrefix = userId => `users/${userId}/records/`;

/* A signed PUT for one new file. The signature covers Content-Type and
   the pending tag, so the phone must send exactly `headers` — an upload
   claiming another type (say text/html), or without the tag, is refused
   by S3. (Left to the SDK's defaults, both would sit unsigned in the
   query string: the type unenforced and the tag ignored by S3.) Size
   can't be pinned this way, so it's checked when a record is saved. */
export async function presignUpload(userId, contentType) {
  const key = `${userRecordsPrefix(userId)}${crypto.randomUUID()}.${ATTACHMENT_TYPES[contentType]}`;
  const command = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, Tagging: 'status=pending' });
  const uploadUrl = await getSignedUrl(s3(), command, {
    expiresIn: UPLOAD_TTL_S,
    signableHeaders: new Set(['content-type']),
    unhoistableHeaders: new Set(['x-amz-tagging']),
  });
  return { key, uploadUrl, headers: { 'Content-Type': contentType, 'x-amz-tagging': 'status=pending' } };
}

/* What's actually stored at `key` — { size, type } — or null when nothing
   was uploaded there. The IAM policy deliberately has no s3:ListBucket, and
   without it S3 answers 403 rather than 404 for a key that doesn't exist. */
export async function headObject(key) {
  try {
    const res = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: res.ContentLength, type: res.ContentType };
  } catch (err) {
    if ([403, 404].includes(err?.$metadata?.httpStatusCode) || err?.name === 'NotFound') return null;
    throw err;
  }
}

/** Marks an upload as belonging to a saved record, so the cleanup rule leaves it alone. */
export async function markAttached(key) {
  await s3().send(new PutObjectTaggingCommand({ Bucket: bucket(), Key: key, Tagging: { TagSet: [{ Key: 'status', Value: 'attached' }] } }));
}

/** A signed GET that opens the file in the viewer (inline) under its original name. */
export async function presignView(key, name, type) {
  const safeName = String(name || 'report').replace(/["\\\r\n]/g, '');
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentType: type || undefined,
    ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`,
  });
  return getSignedUrl(s3(), command, { expiresIn: VIEW_TTL_S });
}

/** The file's bytes, for the server's own use (reading a report with AI) — never sent to the phone this way. */
export async function getObjectBytes(key) {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return Buffer.from(await res.Body.transformToByteArray());
}

export async function deleteObject(key) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
