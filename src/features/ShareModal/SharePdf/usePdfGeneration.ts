import { useCallback, useState } from 'react';

import { deferredToMilestone } from '@/libs/deferred';

interface PdfGenerationParams {
  content: string;
  sessionId: string;
  title: string;
  topicId?: string;
}

interface PdfGenerationState {
  downloadPdf: () => Promise<void>;
  error: string | null;
  generatePdf: (params: PdfGenerationParams) => Promise<void>;
  loading: boolean;
  pdfData: string | null;
}

export const usePdfGeneration = (): PdfGenerationState => {
  const [pdfData, setPdfData] = useState<string | null>(null);
  const filename = 'chat-export.pdf';
  const [error, setError] = useState<string | null>(null);

  /**
   * @deferred(M3) exporter.exportPdf → server-side PDF rendering. The backend
   * tRPC router was removed for the MVP TS-backend cut; server-side PDF export is
   * a Node-backend op deferred to M3. The hook shape is preserved so the SharePdf
   * UI compiles; generating surfaces a "not available" error until re-wired.
   * See MVP_ROADMAP.md (Track B).
   */
  const generatePdf = useCallback(async (_params: PdfGenerationParams) => {
    try {
      setError(null);
      setPdfData(null);
      deferredToMilestone('M3', 'exporter.exportPdf → server-side PDF export');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF export is not available in this build');
    }
  }, []);

  const downloadPdf = useCallback(async () => {
    if (!pdfData) return;

    try {
      // Convert base64 to blob
      const byteCharacters = atob(pdfData);
      const byteNumbers = Array.from({ length: byteCharacters.length }, (_, i) =>
        byteCharacters.charCodeAt(i),
      );
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      throw error;
    }
  }, [pdfData, filename]);

  return {
    downloadPdf,
    error,
    generatePdf,
    loading: false,
    pdfData,
  };
};
