import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, addDays } from "date-fns";

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
  let allRecords: any[] = [];
  let offset = 0;
  const limit = 1000; // Fetch 1000 records at a time
  let hasMore = true;
  const maxIterations = 1000; // Increased safety break: allows up to 1,000,000 records
  let currentIteration = 0;

  while (hasMore && currentIteration < maxIterations) {
    currentIteration++;
    let query = supabase.from(tableName).select(selectColumns).range(offset, offset + limit - 1);

    if (dateFilterColumn && selectedStartDate && selectedEndDate) {
      // Handle different timestamp types for 'created' column
      if (tableName === "tbl_expedisi" && dateFilterColumn === "created") {
        // For tbl_expedisi.created (timestamp without time zone), filter by date part
        // Start date is inclusive, end date is exclusive (start of next day)
        const formattedStart = format(selectedStartDate, "yyyy-MM-dd");
        const formattedEnd = format(addDays(selectedEndDate, 1), "yyyy-MM-dd"); // Go to the start of the next day
        query = query.gte(dateFilterColumn, formattedStart).lt(dateFilterColumn, formattedEnd);
      } else {
        // For tbl_resi.created (timestamp with time zone), use ISO strings for range
        query = query.gte(dateFilterColumn, startOfDay(selectedStartDate).toISOString()).lt(dateFilterColumn, endOfDay(selectedEndDate).toISOString());
      }
    }

    if (queryModifier) {
      query = queryModifier(query);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching paginated data from ${tableName}:`, error);
      throw error;
    }

    if (data && data.length > 0) {
      allRecords = allRecords.concat(data);
      offset += data.length;
      hasMore = data.length === limit; // Continue if we received exactly 'limit' records
    } else {
      hasMore = false; // Stop if no data or less than 'limit' data received
    }
  }

  if (currentIteration >= maxIterations) {
    console.warn(`[supabaseFetch] Reached maxIterations (${maxIterations}) for ${tableName}. Stopping fetch early. Total records: ${allRecords.length}`);
  }
  return allRecords;
};