import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useResiScanner } from "@/hooks/useResiScanner";
import { useResiInputData, UseResiInputDataReturn } from "@/hooks/useResiInputData"; // Import UseResiInputDataReturn
import { normalizeExpeditionName } from "@/utils/expeditionUtils";
import { showSuccess, showError } from "@/utils/toast";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

export default function InputPage() {
  const today = new Date();
  const formattedDate = format(today, "yyyy-MM-dd");
  const fiveDaysAgo = subDays(today, 4);
  const formattedFiveDaysAgo = format(fiveDaysAgo, "yyyy-MM-dd");

  // Destructure all properties from useResiInputData
  const {
    expedition,
    setExpedition,
    selectedKarung,
    setSelectedKarung,
    uniqueExpeditionNames,
    karungSummary,
    allResiForExpedition,
    allExpedisiDataUnfiltered,
    totalExpeditionItems,
    remainingExpeditionItems,
    idExpeditionScanCount,
    isLoadingExpeditionData,
    isLoadingKarungSummary,
    isLoadingAllResiForExpedition,
    isLoadingAllExpedisiDataUnfiltered,
    isLoadingTotalExpeditionItems,
    isLoadingRemainingExpeditionItems,
    isLoadingIdExpeditionScanCount,
  }: UseResiInputDataReturn = useResiInputData({ formattedDate, formattedFiveDaysAgo });

  const {
    resiNumber,
    setResiNumber,
    resiInputRef,
    isProcessing,
    optimisticTotalExpeditionItems,
    optimisticRemainingExpeditionItems,
    optimisticIdExpeditionScanCount,
  } = useResiScanner({
    expedition,
    selectedKarung,
    formattedDate,
    allExpedisiDataUnfiltered,
    allResiForExpedition,
    initialTotalExpeditionItems: totalExpeditionItems,
    initialRemainingExpeditionItems: remainingExpeditionItems,
    initialIdExpeditionScanCount: idExpeditionScanCount,
  });

  const isLoading = isLoadingExpeditionData || isLoadingKarungSummary || isLoadingAllResiForExpedition || isLoadingAllExpedisiDataUnfiltered || isLoadingTotalExpeditionItems || isLoadingRemainingExpeditionItems || isLoadingIdExpeditionScanCount;

  const debouncedSetResiNumber = useDebouncedCallback((value: string) => {
    setResiNumber(value);
  }, 100); // Debounce for 100ms to prevent excessive re-renders during manual typing

  React.useEffect(() => {
    if (resiInputRef.current) {
      resiInputRef.current.focus();
    }
  }, [expedition, selectedKarung]);

  const handleExpeditionChange = (value: string) => {
    setExpedition(value);
    setSelectedKarung(""); // Reset karung when expedition changes
  };

  const handleKarungChange = (value: string) => {
    setSelectedKarung(value);
  };

  const filteredResiForDisplay = React.useMemo(() => {
    if (!allResiForExpedition) return [];
    return allResiForExpedition
      .filter(item => item.nokarung === selectedKarung)
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  }, [allResiForExpedition, selectedKarung]);

  const totalScannedInSelectedKarung = filteredResiForDisplay.length;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Input Resi</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Pilih Expedisi</CardTitle>
          </CardHeader>
          <CardContent>
            <Select onValueChange={handleExpeditionChange} value={expedition}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih Expedisi" />
              </SelectTrigger>
              <SelectContent>
                {uniqueExpeditionNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pilih No Karung</CardTitle>
          </CardHeader>
          <CardContent>
            <Select onValueChange={handleKarungChange} value={selectedKarung} disabled={!expedition}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih No Karung" />
              </SelectTrigger>
              <SelectContent>
                {karungSummary.map((item) => (
                  <SelectItem key={item.karungNumber} value={item.karungNumber}> {/* Corrected to karungNumber */}
                    {item.karungNumber} ({item.quantity}) {/* Corrected to karungNumber */}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Hari Ini ({format(today, "dd MMMM yyyy")})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>Total Resi Expedisi: {isLoading ? "Memuat..." : optimisticTotalExpeditionItems}</p>
            <p>Sisa Belum Kirim: {isLoading ? "Memuat..." : optimisticRemainingExpeditionItems}</p>
            {expedition === 'ID' && (
              <p>Total Scan ID Rekomendasi: {isLoading ? "Memuat..." : optimisticIdExpeditionScanCount}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Scan Resi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="scan-resi">Nomor Resi</Label>
              <Input
                id="scan-resi"
                type="text"
                placeholder="Scan nomor resi"
                value={resiNumber}
                onChange={(e) => debouncedSetResiNumber(e.target.value)}
                ref={resiInputRef}
                disabled={isProcessing || !expedition || !selectedKarung}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resi Terakhir di Karung {selectedKarung || '-'}</CardTitle>
          <p className="text-sm text-gray-500">Total: {totalScannedInSelectedKarung}</p>
        </CardHeader>
        <CardContent>
          {isLoadingAllResiForExpedition ? (
            <p>Memuat data resi...</p>
          ) : filteredResiForDisplay.length === 0 ? (
            <p>Belum ada resi yang di-scan untuk karung ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Resi</TableHead>
                    <TableHead>No. Karung</TableHead>
                    <TableHead>Waktu Scan</TableHead>
                    <TableHead>Expedisi</TableHead>
                    <TableHead>Schedule</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResiForDisplay.map((item, index) => (
                    <TableRow key={item.Resi}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{item.Resi}</TableCell>
                      <TableCell>{item.nokarung}</TableCell>
                      <TableCell>{item.created ? format(new Date(item.created), "HH:mm:ss") : "-"}</TableCell>
                      <TableCell>{item.Keterangan || "-"}</TableCell>
                      <TableCell>{item.schedule || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}