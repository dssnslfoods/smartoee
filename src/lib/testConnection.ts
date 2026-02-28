import { supabase } from './supabase'

export interface ConnectionStatus {
    connected: boolean
    authOk: boolean
    dbOk: boolean
    rlsOk: boolean
    latencyMs: number
    error?: string
}

export async function testSupabaseConnection(): Promise<ConnectionStatus> {
    const start = Date.now()

    try {
        // Test 1: Auth service alive?
        const { error: authError } = await supabase.auth.getSession()

        // Test 2: Database reachable?
        const { error: dbError } = await supabase
            .from('companies')
            .select('id')
            .limit(1)

        // Test 3: RLS working? (ถ้าไม่มี session ต้องได้ 0 rows หรือ error)
        const { error: rlsError } = await supabase
            .from('user_profiles')
            .select('id')
            .limit(1)

        // rlsOk is true if there's no technical failure (0 rows returned implies RLS blocked it without erroring)
        const rlsOk = !rlsError

        return {
            connected: true,
            authOk: !authError,
            dbOk: !dbError,
            rlsOk,
            latencyMs: Date.now() - start,
            error: dbError?.message ?? authError?.message ?? rlsError?.message,
        }
    } catch (err) {
        return {
            connected: false,
            authOk: false,
            dbOk: false,
            rlsOk: false,
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : 'Unknown error',
        }
    }
}
