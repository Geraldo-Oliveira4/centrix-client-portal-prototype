import axios, { type AxiosInstance } from 'axios';
import { toast } from 'react-toastify';

// Shared "create" action: POST payload to url, toast + return null on failure.
// Used to build createQuotation/createMyQuotation, which are otherwise
// identical aside from the axios client and endpoint. On a 400 the backend
// error is specific (e.g. which file/field failed validation) — surface it
// instead of the generic fallback so the user knows what to fix.
export function createAction<TPayload, TResponse>(
  client: AxiosInstance,
  url: string,
  errorMessage: string,
) {
  return async (payload: TPayload): Promise<TResponse | null> => {
    try {
      const response = await client.post<TResponse>(url, payload);
      return response.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        const data = err.response.data as { error?: string };
        toast.error(data.error ?? errorMessage);
        return null;
      }
      toast.error(errorMessage);
      return null;
    }
  };
}

// Shared "trigger extraction" action: POST with no body to
// `${baseUrl}/{quotationId}/trigger-extraction`, toast + return false on
// failure. Used to build triggerQuotationExtraction/triggerMyQuotationExtraction.
export function triggerExtractionAction(client: AxiosInstance, baseUrl: string) {
  return async (quotationId: string): Promise<boolean> => {
    try {
      await client.post(`${baseUrl}/${quotationId}/trigger-extraction`);
      return true;
    } catch {
      toast.error('Erro ao iniciar extração.');
      return false;
    }
  };
}
