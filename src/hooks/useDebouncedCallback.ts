import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook untuk mendebounce pemanggilan fungsi.
 * Fungsi callback akan dieksekusi setelah 'delay' milidetik berlalu sejak pemanggilan terakhir.
 *
 * @param callback Fungsi yang akan didebounce.
 * @param delay Waktu tunda dalam milidetik.
 * @returns Fungsi yang didebounce.
 */
function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const callbackRef = useRef(callback);

  // Perbarui callbackRef jika callback berubah
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Kembalikan fungsi yang didebounce
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T; // Cast to T to maintain original function signature
}

export { useDebouncedCallback };