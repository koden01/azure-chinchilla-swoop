import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";

/**
 * Fetches all data from a Supabase table with pagination, handling the 1000-row limit.
 *
 * @param tableName The name of the table to fetch data from.
 * @param dateFilterColumn Optional: The column name to filter by date (e.g., 'created').
 * @param selectedStartDate Optional: The start date for the date filter.
 * @param selectedEndDate Optional: The end date for the date filter.
 * @param selectColumns Optional: Specific columns to select (default: '*').
 * @param queryModifier Optional: A function to apply additional filters or orders to the query.
 * @returns An array of all records from the table.
 */
export const fetchAllDataPaginated = async (
  tableName: string,
  dateFilterColumn?: string,
  selectedStartDate?: Date,
  selectedEndDate?: Date,
  selectColumns: string = "*",
  queryModifier?: (query: any) => any
) => {
  // const timerName = `fetchAllDataPaginated_${tableName}`; // Removed console.time for performance
  // console.time(timerName); // Removed console.time for performance
  let allRecords: any[] = [];
  let offset = 0;
  const limit = 1000; // Fetch 1000 records at a time
  let hasMore = true;
  const maxIterations = 10; // Safety break: max 10 iterations (10,000 records) for debugging
  let currentIteration = 0;

  while (hasMore && currentIteration < maxIterations) {
    currentIteration++;
    // console.log(`[${timerName}] Iteration ${currentIteration}: Fetching range ${offset} to ${offset + limit - 1}`); // Removed log

    let query = supabase.from(tableName).select(selectColumns).range(offset, offset + limit - 1);

    if (dateFilterColumn && selectedStartDate && selectedEndDate) {
      // Handle different timestamp types for 'created' column
      if (tableName === "tbl_expedisi" && dateFilterColumn === "created") {
        // For tbl_expedisi.created (timestamp without time zone), filter by date part
        query = query.gte(dateFilterColumn, format(selectedStartDate, "yyyy-MM-dd")).lt(dateFilterColumn, format(selectedEndDate, "yyyy-MM-dd"));
      } else {
        // For tbl_resi.created (timestamp with time zone), use ISO strings for range
        query = query.gte(dateFilterColumn, startOfDay(selectedStartDate).toISOString()).lt(dateFilterColumn, endOfDay(selectedEndDate).toISOString());
      }
    }

    if (queryModifier) {
      query = queryModifier(query);
    }

    // console.log(`[${timerName}] BEFORE await query for offset ${offset}...`); // Removed log
    const { data, error } = await query;
    // console.log(`[${timerName}] AFTER await query for offset ${offset}. Data length: ${data?.length || 0}, Error: ${error?.message || 'none'}`); // Removed log

    if (error) {
      console.error(`Error fetching paginated data from ${tableName} at offset ${offset}:`, error);
      // console.timeEnd(timerName); // Removed console.timeEnd for performance
      throw error;
    }

    if (data && data.length > 0) {
      // console.log(`[${timerName}] Fetched ${data.length} records in this iteration.`); // Removed log
      allRecords = allRecords.concat(data);
      offset += data.length;
      hasMore = data.length === limit;
    } else {
      // console.log(`[${timerName}] No more data or empty response in this iteration (data.length: ${data?.length || 0}).`); // Removed log
      hasMore = false;
    }
  }

  if (currentIteration >= maxIterations) {
    console.warn(`Reached maxIterations (${maxIterations}) for ${tableName}. Stopping fetch early.`);
  }

  // console.log(`[${timerName}] Total records fetched: ${allRecords.length}`); // Removed log
  // console.timeEnd(timerName); // Removed console.timeEnd for performance
  return allRecords;
};