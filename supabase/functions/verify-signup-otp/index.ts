import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const MAX_ATTEMPTS = 5

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let email = ''
  let code = ''
  try {
    const body = await req.json()
    email = (body.email || '').toString().trim().toLowerCase()
    code = (body.code || '').toString().trim()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!email || !/^\d{4}$/.test(code)) {
    return new Response(JSON.stringify({ error: 'Email and 4-digit code required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: row, error: fetchErr } = await supabase
    .from('signup_otps')
    .select('code_hash, expires_at, attempts')
    .eq('email', email)
    .maybeSingle()

  if (fetchErr || !row) {
    return new Response(JSON.stringify({ error: 'No code found. Please request a new one.' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabase.from('signup_otps').delete().eq('email', email)
    return new Response(JSON.stringify({ error: 'Code expired. Please request a new one.' }), {
      status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await supabase.from('signup_otps').delete().eq('email', email)
    return new Response(JSON.stringify({ error: 'Too many attempts. Request a new code.' }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const submittedHash = await sha256Hex(`${email}:${code}`)
  if (submittedHash !== row.code_hash) {
    await supabase
      .from('signup_otps')
      .update({ attempts: row.attempts + 1 })
      .eq('email', email)
    return new Response(
      JSON.stringify({ error: 'Incorrect code', remaining: MAX_ATTEMPTS - (row.attempts + 1) }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Success: mark profile verified, delete OTP
  // Find the auth user by email to update their profile reliably
  const { data: usersList } = await supabase.auth.admin.listUsers()
  const authUser = usersList?.users?.find((u) => (u.email || '').toLowerCase() === email)

  if (authUser) {
    await supabase
      .from('profiles')
      .update({ email_verified: true })
      .eq('user_id', authUser.id)
  }

  await supabase.from('signup_otps').delete().eq('email', email)

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})