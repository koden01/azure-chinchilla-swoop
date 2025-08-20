// src/utils/expeditionUtils.ts

/**
 * Daftar nama ekspedisi yang dikenal (dinormalisasi ke UPPERCASE).
 * Ini harus mencakup semua nama kurir yang mungkin muncul di tbl_expedisi.couriername
 * dan tbl_resi.Keterangan.
 */
export const KNOWN_EXPEDITIONS = [
  "ID",
  "ID_REKOMENDASI", // Sekarang diperlakukan sebagai ekspedisi terpisah
  "JNE",
  "SPX",
  "INSTAN",
  "SICEPAT",
  "JNT",
  // Tambahkan ekspedisi lain jika ada
];

/**
 * Menormalisasi nama ekspedisi atau keterangan.
 * Hanya mengonversi ke UPPERCASE. 'ID_REKOMENDASI' tidak lagi dipetakan ke 'ID'.
 *
 * @param name Nama ekspedisi atau keterangan.
 * @returns Nama yang dinormalisasi.
 */
export function normalizeExpeditionName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.trim().toUpperCase();
}

/**
 * Mengembalikan kelas Tailwind CSS untuk styling badge berdasarkan nilai Keterangan.
 *
 * @param keterangan Nilai dari kolom Keterangan (misalnya 'DATA', 'MASUK', 'BATAL').
 * @returns String kelas Tailwind CSS.
 */
export function getKeteranganBadgeClasses(keterangan: string | null | undefined): string {
  const normalizedKeterangan = (keterangan || "").toUpperCase();
  switch (normalizedKeterangan) {
    case "DATA":
      return "bg-blue-100 text-blue-800";
    case "MASUK":
      return "bg-green-100 text-green-800";
    case "BATAL":
      return "bg-orange-100 text-orange-800";
    case "ID":
      return "bg-purple-100 text-purple-800";
    case "ID_REKOMENDASI":
      return "bg-pink-100 text-pink-800"; // Warna berbeda untuk ID_REKOMENDASI
    default:
      return "bg-gray-100 text-gray-800";
  }
}