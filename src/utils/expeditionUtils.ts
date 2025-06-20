// src/utils/expeditionUtils.ts

/**
 * Daftar nama ekspedisi yang dikenal (dinormalisasi ke UPPERCASE).
 * Ini harus mencakup semua nama kurir yang mungkin muncul di tbl_expedisi.couriername
 * dan tbl_resi.Keterangan (kecuali 'ID_REKOMENDASI' yang akan dipetakan ke 'ID').
 */
export const KNOWN_EXPEDITIONS = [
  "ID", // Untuk ID dan ID_REKOMENDASI
  "JNE",
  "SPX",
  "INSTAN",
  "SICEPAT",
  "JNT",
  // Tambahkan ekspedisi lain jika ada
];

/**
 * Menormalisasi nama ekspedisi atau keterangan.
 * Mengubah 'ID_REKOMENDASI' menjadi 'ID' dan mengonversi ke UPPERCASE.
 *
 * @param name Nama ekspedisi atau keterangan.
 * @returns Nama yang dinormalisasi.
 */
export function normalizeExpeditionName(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmedUpper = name.trim().toUpperCase();
  if (trimmedUpper === "ID_REKOMENDASI") {
    return "ID";
  }
  return trimmedUpper;
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
    case "ID": // Jika ID juga perlu badge khusus
      return "bg-purple-100 text-purple-800";
    case "ID_REKOMENDASI": // Jika ID_REKOMENDASI juga perlu badge khusus
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}