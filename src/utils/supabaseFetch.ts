import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, addDays } from "date-fns"; // Import addDays

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
  const maxIterations = 10; // Safety break: max 10 iterations (10,000 records) for debugging
  let currentIteration = 0;

  while (hasMore && currentIteration < maxIterations) {
    currentIteration++;
    let query = supabase.from(tableName).select(selectColumns).range(offset, offset + limit - 1);

    if (dateFilterColumn && selectedStartDate && selectedEndDate) {
      // Handle different timestamp types for 'created' column
      if (tableName === "tbl_expedisi" && dateFilterColumn === "created") {
        // For tbl_expedisi.created (timestamp without time zone), filter by date part
        // Use addDays to correctly include the entire selectedEndDate
        query = query
          .gte(dateFilterColumn, format(selectedStartDate, "yyyy-MM-dd"))
          .lt(dateFilterColumn, format(addDays(selectedEndDate, 1), "yyyy-MM-dd")); // FIX: Add 1 day to end date
      } else {
        // For tbl_resi.created (timestamp with time zone), use ISO strings for range
        query = query
          .gte(dateFilterColumn, startOfDay(selectedStartDate).toISOString())
          .lt(dateFilterColumn, endOfDay(selectedEndDate).toISOString());
      }
    }

    if (queryModifier) {
      query = queryModifier(query);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching paginated data from ${tableName} at offset ${offset}:`, error);
      throw error;
    }

    if (data && data.length > 0) {
      allRecords = allRecords.concat(data);
      offset += data.length;
      hasMore = data.length === limit;
    } else {
      hasMore = false;
    }
  }

  if (currentIteration >= maxIterations) {
    console.warn(`Reached maxIterations (${maxIterations}) for ${tableName}. Stopping fetch early.`);
  }

  return allRecords;
};