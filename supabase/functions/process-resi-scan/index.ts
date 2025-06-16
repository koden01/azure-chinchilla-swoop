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

  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Edge Function: Request received.`);

  try {
    const { resiNumber, expedition, selectedKarung, formattedDate } = await req.json();
    console.log(`[${new Date().toISOString()}] Edge Function: Parsed payload - Resi: ${resiNumber}, Expedition: ${expedition}, Karung: ${selectedKarung}, Date: ${formattedDate}`);

    if (!resiNumber || !expedition || !selectedKarung || !formattedDate) {
      console.error(`[${new Date().toISOString()}] Edge Function: Missing parameters. Resi: ${resiNumber}, Expedition: ${expedition}, Karung: ${selectedKarung}, Date: ${formattedDate}`);
      return new Response(JSON.stringify({ success: false, message: "Parameter input tidak lengkap. Mohon lengkapi semua kolom." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(`[${new Date().toISOString()}] Edge Function: Missing Supabase environment variables.`);
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

    const rpcCallStartTime = Date.now();
    // Call the new RPC function to validate and check for duplicates
    const { data: validationResult, error: rpcError } = await supabaseClient.rpc("validate_and_check_duplicate_resi", {
      p_resi_number: resiNumber,
      p_expedition: expedition,
      p_selected_karung: selectedKarung,
      p_scan_date: formattedDate, // Pass formattedDate as date
    }).single(); // Use .single() as the RPC returns a single row
    console.log(`[${new Date().toISOString()}] Edge Function: RPC 'validate_and_check_duplicate_resi' took ${Date.now() - rpcCallStartTime}ms.`);


    if (rpcError) {
      console.error(`[${new Date().toISOString()}] Edge Function: Error calling validate_and_check_duplicate_resi RPC:`, rpcError);
      return new Response(JSON.stringify({ success: false, message: `Kesalahan database saat validasi resi: ${rpcError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Handle results from the RPC
    if (validationResult.status !== 'OK') {
      let responseStatus = 400; // Default to bad request for validation errors
      let responseType = undefined;

      if (validationResult.status === 'DUPLICATE_RESI') {
        responseType = "duplicate";
      } else if (validationResult.status === 'NOT_FOUND_EXPEDISI') {
        // Could be 404 or 400 depending on desired strictness
        responseStatus = 400;
      } else if (validationResult.status === 'MISMATCH_EXPEDISI') {
        responseStatus = 400;
      }
      console.log(`[${new Date().toISOString()}] Edge Function: Validation failed - Status: ${validationResult.status}, Message: ${validationResult.message}`);
      return new Response(JSON.stringify({ success: false, message: validationResult.message, type: responseType }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: responseStatus,
      });
    }

    const insertStartTime = Date.now();
    // If validationResult.status is 'OK', proceed with insertion
    const insertPayload: any = {
      Resi: resiNumber,
      nokarung: selectedKarung,
      created: new Date().toISOString(), // Use current timestamp for insertion
      Keterangan: validationResult.actual_couriername, // Use courier name from RPC result
      // schedule will be set by the trigger 'trg_update_schedule_if_null'
    };

    const { error: insertError } = await supabaseClient
      .from("tbl_resi")
      .insert(insertPayload);
    console.log(`[${new Date().toISOString()}] Edge Function: Insert 'tbl_resi' took ${Date.now() - insertStartTime}ms.`);


    if (insertError) {
      console.error(`[${new Date().toISOString()}] Edge Function: Error inserting resi:`, insertError);
      return new Response(JSON.stringify({ success: false, message: `Gagal menyimpan resi: ${insertError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log(`[${new Date().toISOString()}] Edge Function: Successfully processed resi ${resiNumber}. Total time: ${Date.now() - startTime}ms.`);
    return new Response(JSON.stringify({ success: true, message: `Resi ${resiNumber} berhasil discan.`, actual_couriername: validationResult.actual_couriername }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Edge Function: Unhandled error in process-resi-scan:`, error);
    return new Response(JSON.stringify({ success: false, message: `Terjadi kesalahan internal server: ${error.message || "Silakan coba lagi."}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});