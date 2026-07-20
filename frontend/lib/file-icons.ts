import {
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';

// Shared file-type helpers for the quotation attachment/document viewers
// (analyst attachments-section and portal documents-section). Single source of
// truth so the two file lists never drift.

const FILE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  jpg: FileImage,
  jpeg: FileImage,
  png: FileImage,
};

export const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png']);
export const ACCEPTED_UPLOAD_TYPES = '.pdf,.docx,.xls,.xlsx,.png,.jpg,.jpeg';

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function getFileIcon(filename: string): React.ElementType {
  return FILE_ICONS[getFileExtension(filename)] ?? File;
}
