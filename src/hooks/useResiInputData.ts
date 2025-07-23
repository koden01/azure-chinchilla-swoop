import React from 'react';
import { isSameDay } from 'date-fns';
import { ResiExpedisiData } from '@/types/data';

interface UseResiInputDataProps {
  expedition: string;
  today: Date;
  allResiForExpedition: ResiExpedisiData[] | undefined;
}

export const useResiInputData = ({ 
  expedition, 
  today, 
  allResiForExpedition 
}: UseResiInputDataProps) => {
  const currentCount = React.useCallback((selectedKarung: string) => {
    if (!allResiForExpedition || !selectedKarung) return 0;
    
    return allResiForExpedition.filter(item => 
      isSameDay(new Date(item.created), today) &&
      item.nokarung === selectedKarung &&
      (expedition === 'ID' 
        ? (item.Keterangan === 'ID' || item.Keterangan === 'ID_REKOMENDASI')
        : item.Keterangan === expedition) &&
      (item.schedule === 'ontime' || item.schedule === 'late' || item.schedule === 'idrek')
    ).length;
  }, [allResiForExpedition, expedition, today]);

  return { currentCount };
};