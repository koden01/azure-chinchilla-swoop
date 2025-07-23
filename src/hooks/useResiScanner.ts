import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { ResiExpedisiData } from '@/types/resi';
import { addPendingOperation } from '@/integrations/indexeddb/pendingOperations';

export const useResiScanner = (expedition: string, selectedKarung: string) => {
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);

  const scanMutation = useMutation({
    mutationFn: async (resiNumber: string) => {
      // ... existing mutation logic
    },
    onSuccess: (_, resiNumber) => {
      showSuccess(`Resi ${resiNumber} berhasil dipindai!`);
      queryClient.invalidateQueries({ 
        queryKey: ['allResiForExpedition', expedition] 
      });
    },
    onError: (error: Error, resiNumber: string) => {
      showError(`Gagal memindai resi ${resiNumber}: ${error.message}`);
    }
  });

  const handleScan = useCallback((resiNumber: string) => {
    setIsScanning(true);
    scanMutation.mutate(resiNumber, {
      onSettled: () => setIsScanning(false)
    });
  }, [scanMutation]);

  return {
    handleScan,
    isScanning
  };
};