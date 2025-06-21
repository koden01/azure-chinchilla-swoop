import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";

/**
 * Fetches all data from a Supabase table with pagination, handling the 1000-row limit.
 *
 * @param tableName The name of the table to fetch data from.
 * @param dateFilterColumn Optional: The column name to filter by date (e.g., 'created').
 * @param selectedStartDate Optional: The start date for the date filter (should be a Date object, preferably UTC-adjusted for 'timestamp with time zone' columns).
 * @param selectedEndDate Optional: The end date for the date filter (should be a Date object, preferably UTC-adjusted for 'timestamp with time zone' columns).
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
      // Check if the column is 'created' in 'tbl_expedisi' (timestamp without time zone)
      // or if it's any other timestamp column (like 'created' in 'tbl_resi' which is timestamp with time zone)
      if (tableName === "tbl_expedisi" && dateFilterColumn === "created") {
        // For tbl_expedisi.created (timestamp without time zone), filter by date part
        query = query.gte(dateFilterColumn, format(selectedStartDate, "yyyy-MM-dd")).lt(dateFilterColumn, format(selectedEndDate, "yyyy-MM-dd"));
      } else {
        // For timestamp with time zone columns (like tbl_resi.created), use ISO strings directly.
        // selectedStartDate and selectedEndDate are expected to be already adjusted to UTC start/end of day.
        query = query.gte(dateFilterColumn, selectedStartDate.toISOString()).lte(dateFilterColumn, selectedEndDate.toISOString());
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
      hasMore = data.length === limit;
    } else {
      hasMore = false;
    }
  }
  return allRecords;
};