import axios from 'axios';
import { toast } from 'react-toastify';

/**
 * Upload a file directly to S3 using a presigned URL.
 *
 * NOTE: This must use raw axios — never base_api — because presigned URLs
 * reject any Authorization header.
 *
 * By default swallows the error, toasts, and returns false. Pass
 * `{ silent: true }` to skip the toast and rethrow instead — for callers
 * that build their own error UI from the axios error (e.g. parsing S3's
 * XML error body).
 */
export const uploadFileToS3 = async (
  presignedUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
  options?: { silent?: boolean },
): Promise<boolean> => {
  try {
    await axios.put(presignedUrl, file, {
      headers: { 'Content-Type': 'application/octet-stream' },
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          const percent = Math.round((event.loaded * 100) / event.total);
          onProgress(percent);
        }
      },
    });
    return true;
  } catch (err) {
    if (options?.silent) throw err;
    toast.error('Erro ao enviar arquivo para o servidor.');
    return false;
  }
};
