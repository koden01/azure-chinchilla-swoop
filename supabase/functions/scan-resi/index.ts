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
    console.log(`Edge Function: Received request for resi: ${resiNumber}, expedition: ${expedition}, karung: ${selectedKarung}`);

    if (!resiNumber || !expedition || !selectedKarung) {
      console.error("Edge Function: Missing required parameters (resiNumber, expedition, or selectedKarung).");
      return new Response(JSON.stringify({ error: "Missing required parameters." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // --- START: Add robust environment variable checks ---
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL) {
      console.error("Edge Function: SUPABASE_URL environment variable is not set.");
      return new Response(JSON.stringify({ success: false, message: "Server configuration error: SUPABASE_URL is missing." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Edge Function: SUPABASE_SERVICE_ROLE_KEY environment variable is not set.");
      return new Response(JSON.stringify({ success: false, message: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    // --- END: Add robust environment variable checks ---

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let actualCourierName: string | null = null;
    let validationMessage: string | null = null;
    let validationStatus: "OK" | "DUPLICATE_RESI" | "MISMATCH_EXPEDISI" | "NOT_FOUND_EXPEDISI" = "OK";

    // 1. Global Resi Duplicate Check in tbl_resi
    console.log(`Edge Function: Checking for duplicate resi ${resiNumber} in tbl_resi...`);
    const { data: existingResiScan, error: duplicateCheckError } = await supabaseAdmin
      .from("tbl_resi")
      .select("Resi, nokarung, Keterangan, created")
      .eq("Resi", resiNumber)
      .single();

    if (duplicateCheckError && duplicateCheckError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      console.error("Edge Function: Error checking duplicate resi:", duplicateCheckError.message, duplicateCheckError.details, duplicateCheckError.hint);
      throw new Error(`Database error during duplicate check: ${duplicateCheckError.message}`);
    }

    if (existingResiScan) {
      const existingScanDate = new Date(existingResiScan.created);
      validationStatus = 'DUPLICATE_RESI';
      validationMessage = `DOUBLE! Resi ini sudah discan di karung ${existingResiScan.nokarung} pada tanggal ${existingScanDate.toLocaleDateString()} dengan keterangan ${existingResiScan.Keterangan}.`;
      console.log(`Edge Function: Duplicate resi found: ${validationMessage}`);
    }

    if (validationStatus !== 'OK') {
      return new Response(JSON.stringify({ success: false, message: validationMessage, status: validationStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409, // Conflict
      });
    }

    // 2. Check tbl_expedisi for the resi number and determine actualCourierName
    console.log(`Edge Function: Checking for resi ${resiNumber} in tbl_expedisi...`);
    const { data: expedisiRecord, error: expedisiCheckError } = await supabaseAdmin
      .from("tbl_expedisi")
      .select("resino, couriername, created")
      .eq("resino", resiNumber)
      .single();

    if (expedisiCheckError && expedisiCheckError.code !== 'PGRST116') {
      console.error("Edge Function: Error checking expedisi record:", expedisiCheckError.message, expedisiCheckError.details, expedisiCheckError.hint);
      throw new Error(`Database error during expedisi check: ${expedisiCheckError.message}`);
    }

    let expedisiCreatedTimestamp: string; // Make it non-nullable, always assign a value

    // Log the raw value from tbl_expedisi before processing
    console.log(`Edge Function: Raw expedisiRecord.created: ${expedisiRecord?.created}`);

    if (expedisiRecord && typeof expedisiRecord.created === 'string' && expedisiRecord.created.trim() !== '') {
      try {
        // Attempt to parse the timestamp from tbl_expedisi.created
        // Append 'Z' to treat it as UTC to avoid local timezone parsing issues
        const dateCandidate = new Date(expedisiRecord.created + 'Z');
        if (!isNaN(dateCandidate.getTime())) {
          expedisiCreatedTimestamp = dateCandidate.toISOString();
          console.log(`Edge Function: Converted expedisi created timestamp: ${expedisiRecord.created} -> ${expedisiCreatedTimestamp}`);
        } else {
          console.warn(`Edge Function: Failed to parse expedisi created timestamp '${expedisiRecord.created}'. Resulted in invalid date. Falling back to current time.`);
          expedisiCreatedTimestamp = new Date().toISOString();
        }
      } catch (e) {
        console.error(`Edge Function: Error during date conversion for '${expedisiRecord.created}':`, e);
        expedisiCreatedTimestamp = new Date().toISOString();
      }
    } else {
      // If no expedisi record, or created is null/not a string/empty, use current time
      expedisiCreatedTimestamp = new Date().toISOString();
      console.log("Edge Function: No expedisi record, or created timestamp is invalid/empty. Using current time.");
    }

    if (expedition === 'ID') {
      if (expedisiRecord) {
        if (expedisiRecord.couriername?.trim().toUpperCase() === 'ID') {
          actualCourierName = 'ID';
        } else {
          validationStatus = 'MISMATCH_EXPEDISI';
          validationMessage = `Resi ini bukan milik ekspedisi ${expedition}, melainkan milik ekspedisi ${expedisiRecord.couriername}.`;
        }
      } else {
        actualCourierName = 'ID_REKOMENDASI';
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
      }
    }

    if (validationStatus !== 'OK') {
      console.log(`Edge Function: Validation failed: ${validationMessage}`);
      return new Response(JSON.stringify({ success: false, message: validationMessage, status: validationStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Bad Request
      });
    }

    // 3. Upsert into tbl_resi
    console.log(`Edge Function: Upserting into tbl_resi for resi: ${resiNumber}, karung: ${selectedKarung}, Keterangan: ${actualCourierName}, created: ${expedisiCreatedTimestamp}`);
    const { error: upsertError } = await supabaseAdmin
      .from("tbl_resi")
      .upsert({
        Resi: resiNumber,
        nokarung: selectedKarung,
        created: expedisiCreatedTimestamp, // Use the converted timestamp
        Keterangan: actualCourierName,
        schedule: "ontime",
      }, { onConflict: 'Resi' });

    if (upsertError) {
      console.error("Edge Function: Error upserting tbl_resi:", upsertError.message, upsertError.details, upsertError.hint);
      throw new Error(`Failed to upsert resi into tbl_resi: ${upsertError.message}`);
    }
    console.log(`Edge Function: Successfully upserted into tbl_resi for ${resiNumber}.`);

    // 4. Update tbl_expedisi flag to 'YES'
    console.log(`Edge Function: Updating tbl_expedisi flag to 'YES' for resino: ${resiNumber}...`);
    const { error: updateExpedisiError } = await supabaseAdmin
      .from("tbl_expedisi")
      .update({ flag: "YES" })
      .eq("resino", resiNumber);

    if (updateExpedisiError) {
      console.error("Edge Function: Error updating tbl_expedisi flag:", updateExpedisiError.message, updateExpedisiError.details, updateExpedisiError.hint);
      throw new Error(`Failed to update flag in tbl_expedisi: ${updateExpedisiError.message}`);
    }
    console.log(`Edge Function: Successfully updated tbl_expedisi flag for ${resiNumber}.`);

    return new Response(JSON.stringify({ success: true, message: `Resi ${resiNumber} berhasil discan.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Edge Function: Caught an unexpected error:", error.message);
    return new Response(JSON.stringify({ success: false, message: error.message || "An unexpected error occurred." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});