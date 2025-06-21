import React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface HistoryDatePickerProps {
  startDate: Date | undefined;
  setStartDate: (date: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (date: Date | undefined) => void;
}

const HistoryDatePicker: React.FC<HistoryDatePickerProps> = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) => {
  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = React.useState(false);
  const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = React.useState(false);

  return (
    <div className="bg-gradient-to-r from-green-500 to-blue-600 p-6 rounded-lg shadow-md">
      <h2 className="text-white text-xl font-semibold mb-4 flex items-center">
        <CalendarDays className="mr-2 h-6 w-6" /> Filter Tanggal
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="start-date-picker" className="block text-left text-sm font-medium text-white mb-1">
            Tanggal Mulai
          </label>
          <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                id="start-date-picker"
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal bg-white text-gray-800",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => {
                  setStartDate(date);
                  setIsStartDatePopoverOpen(false);
                }}
                // initialFocus // Dihapus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label htmlFor="end-date-picker" className="block text-left text-sm font-medium text-white mb-1">
            Tanggal Selesai
          </label>
          <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                id="end-date-picker"
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal bg-white text-gray-800",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => {
                  setEndDate(date);
                  setIsEndDatePopoverOpen(false);
                }}
                // initialFocus // Dihapus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};

export default HistoryDatePicker;