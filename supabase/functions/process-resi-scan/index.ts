import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resiNumber, expedition, selectedKarung, formattedDate } = await req.json();

    if (!resiNumber || !expedition || !selectedKarung || !formattedDate) {
      return new Response(JSON.stringify({ success: false, message: "Parameter input tidak lengkap. Mohon lengkapi semua kolom." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    console.log("Edge Function: SUPABASE_URL retrieved:", supabaseUrl ? "Yes" : "No");
    console.log("Edge Function: SUPABASE_ANON_KEY retrieved:", supabaseAnonKey ? "Yes" : "No");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Edge Function: Missing Supabase environment variables.");
      return new Response(JSON.stringify({ success: false, message: "Kesalahan konfigurasi server: Kunci Supabase tidak ditemukan." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Calculate start and end of the day for the formattedDate
    const selectedDate = new Date(formattedDate);
    const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999);

    // 1. Check tbl_expedisi
    const { data: expedisiData, error: expError } = await supabaseClient
      .from("tbl_expedisi")
      .select("resino, couriername, created")
      .eq("resino", resiNumber)
      .single();

    if (expError && expError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      console.error("Error fetching expedisi data:", expError);
      return new Response(JSON.stringify({ success: false, message: `Kesalahan database saat mengambil data ekspedisi: ${expError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    let actualCourierNameFromExpedisi: string | null = expedisiData?.couriername || null;

    if (expedition === "ID") {
      if (expedisiData && expedisiData.couriername !== "ID") {
        return new Response(JSON.stringify({ success: false, message: `Resi ini bukan untuk ekspedisi ID, melainkan untuk ${expedisiData.couriername}.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    } else {
      if (!expedisiData) {
        return new Response(JSON.stringify({ success: false, message: "Resi tidak ditemukan dalam database ekspedisi." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      if (expedisiData.couriername !== expedition) {
        return new Response(JSON.stringify({ success: false, message: `Resi ini bukan milik ekspedisi ${expedition}. Ini milik ${expedisiData.couriername}.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    }

    // 2. Check tbl_resi for duplicates using RPC
    const { data: duplicateResi, error: dupError } = await supabaseClient.rpc("get_filtered_resi_for_expedition_and_date", {
      p_couriername: expedition,
      p_start_date: startOfDay.toISOString(), // Pass start of day
      p_end_date: endOfDay.toISOString(),     // Pass end of day
      p_resi: resiNumber,
      p_nokarung: selectedKarung,
    });

    if (dupError) {
      console.error("Error fetching duplicate resi:", dupError);
      return new Response(JSON.stringify({ success: false, message: `Kesalahan database saat memeriksa duplikat resi: ${dupError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (duplicateResi && duplicateResi.length > 0) {
      const existingKarung = duplicateResi[0].nokarung;
      const existingCreated = duplicateResi[0].created;
      
      // Format the date for the message (only date, no time)
      const dateObj = new Date(existingCreated);
      const formattedDateString = dateObj.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      return new Response(JSON.stringify({ success: false, message: `Resi duplikat! Resi ini sudah discan di karung ${existingKarung} pada tanggal ${formattedDateString}.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 3. Insert into tbl_resi
    let insertPayload: any = {
      Resi: resiNumber,
      nokarung: selectedKarung,
      created: new Date().toISOString(), // Use current timestamp for insertion
    };

    if (expedition === "ID") {
      if (actualCourierNameFromExpedisi === null) {
        insertPayload.Keterangan = "ID_REKOMENDASI";
        insertPayload.schedule = "idrek"; // Explicitly set schedule for ID_REKOMENDASI
      } else {
        insertPayload.Keterangan = actualCourierNameFromExpedisi;
        // schedule will be set by trigger for non-ID_REKOMENDASI cases
      }
    } else {
      insertPayload.Keterangan = expedition;
      // schedule will be set by trigger
    }

    const { error: insertError } = await supabaseClient
      .from("tbl_resi")
      .insert(insertPayload);

    if (insertError) {
      console.error("Error inserting resi:", insertError);
      return new Response(JSON.stringify({ success: false, message: `Gagal menyimpan resi: ${insertError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ success: true, message: `Resi ${resiNumber} berhasil discan.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Unhandled error in process-resi-scan:", error);
    return new Response(JSON.stringify({ success: false, message: `Terjadi kesalahan internal server: ${error.message || "Silakan coba lagi."}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});