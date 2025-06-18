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
    const { resiNumber, expedition, selectedKarung } = await req.json();

    if (!resiNumber || !expedition || !selectedKarung) {
      return new Response(JSON.stringify({ error: "Missing required parameters." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Create a Supabase client with the service role key for full access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let actualCourierName: string | null = null;
    let validationMessage: string | null = null;
    let validationStatus: "OK" | "DUPLICATE_RESI" | "MISMATCH_EXPEDISI" | "NOT_FOUND_EXPEDISI" = "OK";

    // 1. Global Resi Duplicate Check in tbl_resi
    const { data: existingResiScan, error: duplicateCheckError } = await supabaseAdmin
      .from("tbl_resi")
      .select("Resi, nokarung, Keterangan, created")
      .eq("Resi", resiNumber)
      .single();

    if (duplicateCheckError && duplicateCheckError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      console.error("Error checking duplicate resi:", duplicateCheckError);
      throw new Error(`Database error during duplicate check: ${duplicateCheckError.message}`);
    }

    if (existingResiScan) {
      const existingScanDate = new Date(existingResiScan.created);
      validationStatus = 'DUPLICATE_RESI';
      validationMessage = `DOUBLE! Resi ini sudah discan di karung ${existingResiScan.nokarung} pada tanggal ${existingScanDate.toLocaleDateString()} dengan keterangan ${existingResiScan.Keterangan}.`;
    }

    if (validationStatus !== 'OK') {
      return new Response(JSON.stringify({ success: false, message: validationMessage, status: validationStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409, // Conflict
      });
    }

    // 2. Check tbl_expedisi for the resi number and determine actualCourierName
    const { data: expedisiRecord, error: expedisiCheckError } = await supabaseAdmin
      .from("tbl_expedisi")
      .select("resino, couriername, created")
      .eq("resino", resiNumber)
      .single();

    if (expedisiCheckError && expedisiCheckError.code !== 'PGRST116') {
      console.error("Error checking expedisi record:", expedisiCheckError);
      throw new Error(`Database error during expedisi check: ${expedisiCheckError.message}`);
    }

    let expedisiCreatedTimestamp: string | null = null;

    if (expedition === 'ID') {
      if (expedisiRecord) {
        if (expedisiRecord.couriername?.trim().toUpperCase() === 'ID') {
          actualCourierName = 'ID';
          expedisiCreatedTimestamp = expedisiRecord.created;
        } else {
          validationStatus = 'MISMATCH_EXPEDISI';
          validationMessage = `Resi ini bukan milik ekspedisi ${expedition}, melainkan milik ekspedisi ${expedisiRecord.couriername}.`;
        }
      } else {
        actualCourierName = 'ID_REKOMENDASI';
        expedisiCreatedTimestamp = new Date().toISOString(); // Default to now if not found in tbl_expedisi
      }
    } else { // For non-ID expeditions
      if (!expedisiRecord) {
        validationStatus = 'NOT_FOUND_EXPEDISI';
        validationMessage = 'Data tidak ada di database ekspedisi.';
      } else if (expedisiRecord.couriername?.trim().toUpperCase() !== expedition.toUpperCase()) {
        validationStatus = 'MISMATCH_EXPEDISI';
        validationMessage = `Resi ini bukan milik ekspedisi ${expedition}, melainkan milik ekspedisi ${expedisiRecord.couriername}.`;
      } else {
        actualCourierName = expedisiRecord.couriername;
        expedisiCreatedTimestamp = expedisiRecord.created;
      }
    }

    if (validationStatus !== 'OK') {
      return new Response(JSON.stringify({ success: false, message: validationMessage, status: validationStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Bad Request
      });
    }

    // 3. Upsert into tbl_resi
    const { error: upsertError } = await supabaseAdmin
      .from("tbl_resi")
      .upsert({
        Resi: resiNumber,
        nokarung: selectedKarung,
        created: expedisiCreatedTimestamp || new Date().toISOString(), // Use expedisi created or current time
        Keterangan: actualCourierName,
        schedule: "ontime",
      }, { onConflict: 'Resi' });

    if (upsertError) {
      console.error("Error upserting tbl_resi:", upsertError);
      throw new Error(`Failed to upsert resi into tbl_resi: ${upsertError.message}`);
    }

    // 4. Update tbl_expedisi flag to 'YES'
    const { error: updateExpedisiError } = await supabaseAdmin
      .from("tbl_expedisi")
      .update({ flag: "YES" })
      .eq("resino", resiNumber);

    if (updateExpedisiError) {
      console.error("Error updating tbl_expedisi flag:", updateExpedisiError);
      throw new Error(`Failed to update flag in tbl_expedisi: ${updateExpedisiError.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: `Resi ${resiNumber} berhasil discan.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Edge Function Error:", error.message);
    return new Response(JSON.stringify({ success: false, message: error.message || "An unexpected error occurred." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});