import { useState, useEffect } from 'react';

/**
 * Hook untuk mendebounce nilai.
 * Nilai yang didebounce akan diperbarui setelah 'delay' milidetik berlalu sejak nilai terakhir berubah.
 *
 * @param value Nilai yang akan didebounce.
 * @param delay Waktu tunda dalam milidetik.
 * @returns Nilai yang didebounce.
 */
export function useDebounce<T>(value: T, delay: number): T {
  // State to store debounced value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Update debounced value after the specified delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function to clear the timeout if value changes (or component unmounts)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Only re-call effect if value or delay changes

  return debouncedValue;
}