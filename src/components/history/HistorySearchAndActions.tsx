import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

interface HistorySearchAndActionsProps {
  globalFilter: string;
  setGlobalFilter: (filter: string) => void;
  handleCopyTableData: () => Promise<void>;
  filteredRowCount: number;
}

const HistorySearchAndActions: React.FC<HistorySearchAndActionsProps> = ({
  globalFilter,
  setGlobalFilter,
  handleCopyTableData,
  filteredRowCount,
}) => {
  return (
    <div className="bg-white p-4 rounded-md shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Filter & Search</h3>
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-grow w-full">
          <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 mb-1">
            Cari
          </label>
          <Input
            id="search-input"
            type="text"
            placeholder="Cari no. resi, keterangan, atau lainnya..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full"
          />
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap w-full md:w-auto"
          onClick={handleCopyTableData}
          disabled={filteredRowCount === 0}
        >
          <Copy className="mr-2 h-4 w-4" /> Copy Table Data ({filteredRowCount} records)
        </Button>
      </div>
    </div>
  );
};

export default HistorySearchAndActions;