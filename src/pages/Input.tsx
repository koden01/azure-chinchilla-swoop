import React from 'react';
import { useResiInputData } from '@/hooks/useResiInputData';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const InputPage: React.FC = () => {
  const [expedition, setExpedition] = React.useState<string>('');
  const [selectedKarung, setSelectedKarung] = React.useState<string>('1');
  const [resiInput, setResiInput] = React.useState<string>('');

  const { 
    expeditionOptions = [],
    karungOptions = [],
    currentCount
  } = useResiInputData(expedition, false);

  return (
    <div className="p-4 space-y-4">
      <Select onValueChange={setExpedition} value={expedition}>
        <SelectTrigger>
          <SelectValue placeholder="Pilih Ekspedisi" />
        </SelectTrigger>
        <SelectContent>
          {expeditionOptions.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={setSelectedKarung} value={selectedKarung}>
        <SelectTrigger>
          <SelectValue placeholder="Pilih Karung" />
        </SelectTrigger>
        <SelectContent>
          {karungOptions.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div>
        <p>Jumlah Resi: {currentCount?.(selectedKarung) || 0}</p>
      </div>
    </div>
  );
};

export default InputPage;