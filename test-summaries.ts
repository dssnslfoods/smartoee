import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

let envStr = fs.readFileSync('.env', 'utf-8');
let SUPABASE_URL = "";
let SUPABASE_SERVICE_ROLE_KEY = "";
for (let line of envStr.split('\n')) {
    if (line.startsWith('VITE_SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1].trim();
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) SUPABASE_SERVICE_ROLE_KEY = line.split('=')[1].trim();
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: vss, error: vssErr } = await supabase.from('v_shift_summary').select('*').eq('shift_date', '2026-03-01');
    console.log("v_shift_summary err:", vssErr);
    console.log("v_shift_summary:", vss);

    if (vss && vss.length > 0) {
        const { data: os } = await supabase.from('oee_snapshots').select('*').eq('shift_calendar_id', vss[0].shift_calendar_id);
        console.log("oee snapshots:", os);
    }
}

check();
