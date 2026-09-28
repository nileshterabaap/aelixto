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

function generate4DigitCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10000
  return n.toString().padStart(4, '0')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  let email = ''
  let username = ''
  let password = ''
  let mode: 'signup' | 'resend' = 'signup'
  try {
    const body = await req.json()
    email = (body.email || '').toString().trim().toLowerCase()
    username = (body.username || '').toString().trim()
    password = (body.password || '').toString()
    mode = body.mode === 'resend' ? 'resend' : 'signup'
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return new Response(JSON.stringify({ error: 'Valid email is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Signup mode: create the auth user up front (email_confirm = false).
  // If the user already exists AND is unconfirmed, we treat this as a resend.
  if (mode === 'signup') {
    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!username || username.length < 3) {
      return new Response(JSON.stringify({ error: 'Username is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { username },
    })

    if (createErr) {
      const msg = (createErr.message || '').toLowerCase()
      // If user already exists, allow resend ONLY if they're still unconfirmed.
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        const { data: list } = await supabase.auth.admin.listUsers()
        const existing = list?.users?.find((u) => (u.email || '').toLowerCase() === email)
        if (existing?.email_confirmed_at) {
          // Return 200 with an error field so the client-side invoke() surfaces
          // the message instead of a generic non-2xx error.
          return new Response(
            JSON.stringify({ error: 'An account with this email already exists. Please sign in instead.' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        // Unconfirmed — update password and continue to send a new OTP
        if (existing) {
          await supabase.auth.admin.updateUserById(existing.id, { password })
        }
      } else {
        console.error('createUser failed', createErr)
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Ensure profile flag is false
    await supabase.from('profiles').update({ email_verified: false }).eq('username', username)
  }

  // Rate limit: one send per 30s per email
  const { data: existing } = await supabase
    .from('signup_otps')
    .select('last_sent_at')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    const secsSince = (Date.now() - new Date(existing.last_sent_at).getTime()) / 1000
    if (secsSince < 30) {
      return new Response(
        JSON.stringify({ error: `Please wait ${Math.ceil(30 - secsSince)}s before requesting a new code` }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  const code = generate4DigitCode()
  const codeHash = await sha256Hex(`${email}:${code}`)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: upsertErr } = await supabase.from('signup_otps').upsert({
    email,
    code_hash: codeHash,
    expires_at: expiresAt,
    attempts: 0,
    last_sent_at: new Date().toISOString(),
  }, { onConflict: 'email' })

  if (upsertErr) {
    console.error('OTP upsert failed', upsertErr)
    return new Response(JSON.stringify({ error: 'Failed to create code' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Send email via existing transactional pipeline
  const sendRes = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'signup-otp',
      recipientEmail: email,
      idempotencyKey: `signup-otp-${email}-${codeHash.slice(0, 12)}`,
      templateData: { code, username },
    },
  })

  if (sendRes.error) {
    console.error('send-transactional-email failed', sendRes.error)
    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})