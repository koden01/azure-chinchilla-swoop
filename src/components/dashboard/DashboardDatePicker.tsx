"use client";

import React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DashboardDatePickerProps {
  selectedDate: Date | undefined;
  setSelectedDate: (date: Date | undefined) => void;
}

const DashboardDatePicker: React.FC<DashboardDatePickerProps> = ({
  selectedDate,
  setSelectedDate,
}) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);

  return (
    <div className="bg-gradient-to-r from-green-500 to-blue-600 p-6 rounded-lg shadow-md mb-6">
      <h2 className="text-white text-xl font-semibold mb-4 flex items-center">
        <CalendarIcon className="mr-2 h-6 w-6" /> Pilih Tanggal Dashboard
      </h2>
      <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date-picker"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal bg-white text-gray-800",
              !selectedDate && "text-muted-foreground"
            )}
            onClick={() => setIsDatePickerOpen(true)}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              setIsDatePickerOpen(false); // Close popover on date selection
            }}
            // initialFocus // Removed initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DashboardDatePicker;