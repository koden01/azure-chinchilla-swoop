import React from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ResiInputData {
  expeditionOptions: string[];
  karungOptions: string[];
  currentCount: (karung: string) => number;
}

const useResiInputData = (expedition: string, includeIdRek: boolean): ResiInputData => {
  // Implementation here
  return {
    expeditionOptions: ['JNE', 'JNT', 'SICEPAT', 'ID'],
    karungOptions: ['1', '2', '3', '4'],
    currentCount: () => 0
  };
};

const InputPage = () => {
  const [expedition, setExpedition] = React.useState('');
  const [selectedKarung, setSelectedKarung] = React.useState('1');
  const [resiInput, setResiInput] = React.useState('');

  const { 
    expeditionOptions,
    karungOptions,
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
        <p>Jumlah Resi: {currentCount(selectedKarung)}</p>
      </div>
    </div>
  );
};

export default InputPage;