import * as recordsApi from './recordsApi';

/* Uploading a report file (PDF or photo) for a medical record.

   The file goes straight from the phone to S3 through a 5-minute signed
   link from the API — never through the API server, and the phone never
   holds AWS credentials. The link only accepts this one file, with
   exactly the headers the server returned (backend/src/utils/s3.js).
   The record is then saved with the returned { key, name }, and the
   server checks the file really landed before accepting it. */

export const MAX_ATTACHMENT_MB = 15;

const TYPE_BY_EXT = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };

// some pickers report image/jpg, or nothing — fall back to the file extension
export function attachmentType(file) {
  const t = String(file?.type || '').toLowerCase();
  if (t === 'image/jpg') return 'image/jpeg';
  if (Object.values(TYPE_BY_EXT).includes(t)) return t;
  const ext = String(file?.name || '').split('.').pop().toLowerCase();
  return TYPE_BY_EXT[ext] || null;
}

export const sizeLabel = bytes => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function put(url, headers, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = e => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}). Please try again.`)));
    xhr.onerror = () => reject(new Error('Upload failed — check your internet connection and try again.'));
    xhr.ontimeout = xhr.onerror;
    xhr.send(blob);
  });
}

/** file: a document-picker result ({ uri, name, type, size }). Resolves { key, name, type, size }. */
export async function uploadAttachment(file, token, onProgress) {
  const type = attachmentType(file);
  if (!type) throw new Error('Please choose a PDF or a photo (JPG, PNG, WEBP or HEIC).');
  if (file.size && file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
    throw new Error(`This file is ${sizeLabel(file.size)}. Reports can be up to ${MAX_ATTACHMENT_MB} MB.`);
  }

  const { upload } = await recordsApi.getUploadUrl({ type, size: file.size || undefined }, token);
  // React Native's fetch reads the picker's content:// uri straight into a blob
  const blob = await (await fetch(file.uri)).blob();
  onProgress?.(0);
  await put(upload.uploadUrl, upload.headers, blob, onProgress);
  return { key: upload.key, name: file.name || `report.${type.split('/')[1]}`, type, size: blob.size || file.size || 0 };
}
