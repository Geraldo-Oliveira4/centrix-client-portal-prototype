'use client';

import { useState } from 'react';
import { LoadingState } from '@arboria-tech/arboria-ui';
import { QuotationFileList } from '@/components/quotation-file-list';
import {
  addMyQuotationDocument,
  useMyQuotationDocuments,
} from '@/hooks/use-portal-quotations';

interface DocumentsSectionProps {
  quotationId: string;
}

export function DocumentsSection({ quotationId }: DocumentsSectionProps) {
  const { documents, isLoading, mutate } = useMyQuotationDocuments(quotationId);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    for (const file of files) {
      await addMyQuotationDocument(quotationId, file);
    }
    setIsUploading(false);
    mutate();
  };

  if (isLoading) {
    return <LoadingState spinner message="Carregando documentos..." />;
  }

  return (
    <QuotationFileList
      attachments={documents}
      isUploading={isUploading}
      onUpload={handleUpload}
      headerLabel="Arquivos da cotação"
    />
  );
}
