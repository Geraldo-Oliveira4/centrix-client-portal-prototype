import { toast } from 'react-toastify';
import { uploadFileToS3 } from '@/lib/upload-file';
import type { CreateQuotationResponse, Quotation } from '@/types/quotation';

type FileUploadStatus = 'uploading' | 'done' | 'error';

interface UseQuotationUploadFlowOptions<TPayload> {
  createFn: (payload: TPayload) => Promise<CreateQuotationResponse | null>;
  triggerExtractionFn: (quotationId: string) => Promise<boolean>;
  onFileStatusChange?: (filename: string, status: FileUploadStatus) => void;
  onProgress?: (percent: number) => void;
}

// Shared "upload documents" algorithm behind both /cotacao/nova-cotacao
// (internal) and /portal/nova-cotacao (client self-service): create the
// quotation with source=upload, upload every file to its presigned URL in
// parallel, then trigger extraction unless a .msg was included (that one is
// picked up automatically via the S3 event -> parse_email_msg -> SQS).
//
// uploadFileToS3 already toasts and swallows its own per-file failures, so
// this does not add another try/catch around the upload step — callers that
// want per-file status (the internal page's fileStatuses badges) pass
// onFileStatusChange; callers that don't (the portal page) can omit it.
export function useQuotationUploadFlow<TPayload>({
  createFn,
  triggerExtractionFn,
  onFileStatusChange,
  onProgress,
}: UseQuotationUploadFlowOptions<TPayload>) {
  const uploadAndCreate = async (
    files: File[],
    payload: TPayload,
  ): Promise<Quotation | null> => {
    const result = await createFn(payload);
    if (!result?.quotation) return null;

    const { quotation, upload_urls } = result;
    if (!upload_urls?.length) {
      toast.error('URLs de upload não recebidas.');
      return null;
    }

    const uploadResults = await Promise.all(
      upload_urls.map(async (info) => {
        const file = files.find((f) => f.name === info.filename);
        if (!file) return true;
        const isMsg = file.name.toLowerCase().endsWith('.msg');
        onFileStatusChange?.(info.filename, 'uploading');
        const ok = await uploadFileToS3(info.upload_url, file, isMsg ? onProgress : undefined);
        onFileStatusChange?.(info.filename, ok ? 'done' : 'error');
        return ok;
      }),
    );

    // A failed S3 PUT means the file never landed — triggering extraction against
    // it would just fail silently server-side (extraction_status=FAILED with no
    // user-visible signal). Skip the trigger and tell the user explicitly instead.
    const allUploadsOk = uploadResults.every(Boolean);
    const hasMsgFile = files.some((f) => f.name.toLowerCase().endsWith('.msg'));
    if (!hasMsgFile) {
      if (allUploadsOk) {
        await triggerExtractionFn(quotation.id);
      } else {
        toast.error(
          'Alguns arquivos não foram enviados — a extração automática não foi iniciada. ' +
            'Tente reenviar o(s) arquivo(s) com erro ou preencha os campos manualmente.',
        );
      }
    }

    return quotation;
  };

  return { uploadAndCreate };
}
