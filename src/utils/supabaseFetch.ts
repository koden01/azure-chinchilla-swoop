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
  let allRecords: any[] = [];
  let offset = 0;
  const limit = 1000; // Fetch 1000 records at a time
  let hasMore = true;

  while (hasMore) {
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

    if (queryModifier) { // Apply custom modifier if provided
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
      hasMore = data.length === limit; // If less than limit, no more data
    } else {
      hasMore = false;
    }
  }
  return allRecords;
};