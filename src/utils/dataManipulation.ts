import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";

/**
 * Menyesuaikan jumlah resi untuk ekspedisi dan nomor karung tertentu pada tanggal tertentu.
 * Jika jumlah saat ini kurang dari target, resi dummy akan disisipkan.
 * Jika jumlah saat ini lebih dari target, resi terbaru akan dihapus.
 *
 * @param targetCount Jumlah resi yang diinginkan.
 * @param expedition Nama ekspedisi (misalnya "ID", "JNE").
 * @param karungNumber Nomor karung.
 * @param date Tanggal untuk operasi (biasanya hari ini).
 * @returns Pesan status tentang operasi yang dilakukan.
 */
export async function adjustResiCount(
  targetCount: number,
  expedition: string,
  karungNumber: string,
  date: Date
): Promise<string> {
  const startOfToday = startOfDay(date).toISOString();
  const endOfToday = endOfDay(date).toISOString();

  // 1. Dapatkan jumlah resi saat ini
  const { count: currentCount, error: countError } = await supabase
    .from("tbl_resi")
    .select("Resi", { count: "exact" })
    .eq("nokarung", karungNumber)
    .eq("Keterangan", expedition) // Gunakan Keterangan untuk memfilter berdasarkan nama ekspedisi
    .gte("created", startOfToday)
    .lt("created", endOfToday);

  if (countError) {
    throw new Error(`Error fetching current count: ${countError.message}`);
  }

  console.log(`Current count for ${expedition} Karung ${karungNumber} on ${format(date, 'yyyy-MM-dd')}: ${currentCount}`);

  if (currentCount === null) {
    throw new Error("Could not retrieve current count.");
  }

  if (currentCount < targetCount) {
    // Sisipkan catatan baru
    const numToInsert = targetCount - currentCount;
    console.log(`Inserting ${numToInsert} records...`);
    const recordsToInsert = Array.from({ length: numToInsert }).map((_, i) => ({
      Resi: `${expedition}_DUMMY_${karungNumber}_${Date.now()}_${i}`, // Resi dummy unik
      nokarung: karungNumber,
      created: new Date().toISOString(),
      Keterangan: expedition,
      schedule: "ontime", // Jadwal default untuk data dummy
    }));

    const { error: insertError } = await supabase
      .from("tbl_resi")
      .insert(recordsToInsert);

    if (insertError) {
      throw new Error(`Error inserting records: ${insertError.message}`);
    }
    console.log(`Successfully inserted ${numToInsert} records.`);
    return `Berhasil mengatur jumlah menjadi ${targetCount} dengan menyisipkan ${numToInsert} resi.`;

  } else if (currentCount > targetCount) {
    // Hapus catatan
    const numToDelete = currentCount - targetCount;
    console.log(`Deleting ${numToDelete} records...`);

    // Ambil catatan untuk dihapus (misalnya, yang terbaru)
    const { data: recordsToDelete, error: fetchError } = await supabase
      .from("tbl_resi")
      .select("Resi")
      .eq("nokarung", karungNumber)
      .eq("Keterangan", expedition)
      .gte("created", startOfToday)
      .lt("created", endOfToday)
      .order("created", { ascending: false }) // Hapus yang terbaru
      .limit(numToDelete);

    if (fetchError) {
      throw new Error(`Error fetching records to delete: ${fetchError.message}`);
    }

    if (recordsToDelete && recordsToDelete.length > 0) {
      const resiNumbersToDelete = recordsToDelete.map(r => r.Resi);
      const { error: deleteError } = await supabase
        .from("tbl_resi")
        .delete()
        .in("Resi", resiNumbersToDelete);

      if (deleteError) {
        throw new Error(`Error deleting records: ${deleteError.message}`);
      }
      console.log(`Successfully deleted ${numToDelete} records.`);
      return `Berhasil mengatur jumlah menjadi ${targetCount} dengan menghapus ${numToDelete} resi.`;
    } else {
      console.log("No records found to delete.");
      return `Jumlah sudah ${currentCount}, tidak ada perubahan yang diperlukan.`;
    }
  } else {
    console.log("Count is already 54. No changes needed.");
    return `Jumlah sudah ${targetCount}. Tidak ada perubahan yang diperlukan.`;
  }
}