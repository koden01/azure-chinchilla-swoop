import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface HistoryData {
  no: number;
  nomorResi: string;
  keterangan: string;
  noKarung: number;
  tanggalInput: string;
}

const dummyHistoryData: HistoryData[] = Array.from({ length: 20 }, (_, i) => ({
  no: i + 1,
  nomorResi: `SPXID20231123${1000 + i}`,
  keterangan: i % 3 === 0 ? "DATA" : i % 3 === 1 ? "MASUK" : "OK",
  noKarung: Math.floor(Math.random() * 5) + 1,
  tanggalInput: "12/06/2023",
}));

const HistoryPage = () => {
  const [startDate, setStartDate] = React.useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = React.useState<Date | undefined>(new Date());
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-64px)]">
      {/* History Data Input Section */}
      <div className="bg-gradient-to-r from-green-500 to-blue-600 p-6 rounded-lg shadow-md">
        <h2 className="text-white text-xl font-semibold mb-4">History Data Input</h2>
        <div className="bg-white p-4 rounded-md shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Filter & Search</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal Mulai
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
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
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal Selesai
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
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
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="md:col-span-2 flex items-end space-x-2">
              <div className="flex-grow">
                <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 mb-1">
                  Cari
                </label>
                <Input
                  id="search-input"
                  type="text"
                  placeholder="Cari no. resi, keterangan, atau lainnya..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap">
                Export Data (20 records)
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Data History Table Section */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Data History ({dummyHistoryData.length} records)</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">No</TableHead>
                <TableHead>Nomor Resi</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>No Karung</TableHead>
                <TableHead>Tanggal Input</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dummyHistoryData.map((data) => (
                <TableRow key={data.no}>
                  <TableCell className="font-medium">{data.no}</TableCell>
                  <TableCell>{data.nomorResi}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: data.keterangan === "DATA" ? "#e0f7fa" : data.keterangan === "MASUK" ? "#e8f5e9" : "#fff3e0",
                        color: data.keterangan === "DATA" ? "#00796b" : data.keterangan === "MASUK" ? "#2e7d32" : "#e65100",
                      }}
                    >
                      {data.keterangan}
                    </span>
                  </TableCell>
                  <TableCell>{data.noKarung}</TableCell>
                  <TableCell>{data.tanggalInput}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                2
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default HistoryPage;