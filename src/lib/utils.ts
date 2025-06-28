import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isValid, parseISO } from "date-fns"; // Import format, isValid, and parseISO

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parses a date string into a Date object.
 * Returns a valid Date object or null if parsing fails.
 */
export function safeParseDate(dateString: string | null | undefined): Date | null {
  if (!dateString) {
    return null;
  }
  const parsedDate = new Date(dateString); // Try native Date constructor first
  if (isValid(parsedDate)) {
    return parsedDate;
  }
  // If native parsing fails, try parseISO for ISO 8601 strings
  const isoParsedDate = parseISO(dateString);
  if (isValid(isoParsedDate)) {
    return isoParsedDate;
  }
  return null;
}

/**
 * Safely formats a Date object or date string.
 * Returns formatted string or fallback if date is invalid.
 */
export function safeFormatDate(
  date: Date | string | null | undefined,
  formatString: string,
  fallback: string = "-"
): string {
  const parsedDate = typeof date === 'string' ? safeParseDate(date) : date;
  if (parsedDate && isValid(parsedDate)) {
    return format(parsedDate, formatString);
  }
  return fallback;
}