import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('v_shift_summary').select('*');
  console.log("Error:", error);
  console.log("Data length:", data?.length);
  if (data?.length > 0) {
    console.log("First item:", data[0]);
    console.log("All dates:", data.map(d => d.shift_date));
  }
}

check();
