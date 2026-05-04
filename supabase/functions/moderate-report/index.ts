// Moderation action endpoint. Triggered by signed one-click links in moderator
// emails. Verifies HMAC signature, performs the requested action (delete/keep),
// notifies the reporter via in-app notification, and shows an HTML result page.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SECRET = Deno.env.get('REPORT_ACTION_SECRET') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function htmlPage(title: string, body: string, color = '#111') {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f9fafb;margin:0;padding:40px 20px;color:${color};display:flex;align-items:center;justify-content:center;min-height:100vh;}
    .card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;max-width:480px;width:100%;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.04);}
    h1{margin:0 0 12px;font-size:22px;}
    p{color:#4b5563;line-height:1.5;font-size:15px;}
    a{color:#2563eb;}
  </style></head><body><div class="card"><h1>${title}</h1>${body}</div></body></html>`
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const reportId = url.searchParams.get('r')
    const action = url.searchParams.get('a') // 'delete' | 'keep'
    const sig = url.searchParams.get('s')

    if (!reportId || !action || !sig) {
      return new Response(htmlPage('Invalid link', '<p>Missing parameters.</p>', '#dc2626'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const expected = await hmac(`${reportId}:${action}`)
    if (expected !== sig) {
      return new Response(htmlPage('Invalid signature', '<p>This link is invalid or tampered with.</p>', '#dc2626'), {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // Fetch report
    const { data: report, error: reportErr } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle()

    if (reportErr || !report) {
      return new Response(htmlPage('Report not found', '<p>This report no longer exists.</p>', '#dc2626'), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    if (report.resolved_at) {
      return new Response(
        htmlPage(
          'Already resolved',
          `<p>This report was already resolved as <strong>${report.resolution}</strong>.</p>`
        ),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }

    // Snapshot of post (for the reporter notification, even if deleted)
    let postSnapshot: any = null
    if (report.target_post_id) {
      const { data: post } = await supabase
        .from('posts')
        .select('id, title, content, thumbnail_url, preview_image_url, media_url, platform, user_id')
        .eq('id', report.target_post_id)
        .maybeSingle()
      postSnapshot = post
    }

    const isDelete = action === 'delete'
    const resolution = isDelete ? 'removed' : 'kept'

    if (isDelete && report.target_post_id) {
      // Cascade-friendly delete (likes/saves/comments/reposts have no FK so we
      // just remove the post — engagement rows will become orphans which the
      // app already tolerates).
      await supabase.from('posts').delete().eq('id', report.target_post_id)
    }

    // Mark report resolved
    await supabase
      .from('reports')
      .update({
        status: isDelete ? 'actioned' : 'dismissed',
        resolved_at: new Date().toISOString(),
        resolution,
      })
      .eq('id', reportId)

    // Notify the reporter (in-app, Instagram-style)
    const notifMetadata: Record<string, any> = {
      kind: 'report_outcome',
      action: resolution,
      reason: report.reason,
      report_id: reportId,
      post_snapshot: postSnapshot
        ? {
            id: postSnapshot.id,
            title: postSnapshot.title,
            content: postSnapshot.content,
            thumbnail_url: postSnapshot.thumbnail_url || postSnapshot.preview_image_url,
            platform: postSnapshot.platform,
          }
        : null,
    }

    await supabase.from('notifications').insert({
      recipient_id: report.reporter_id,
      actor_id: report.reporter_id, // self — system action; UI treats kind=report_outcome specially
      type: 'report_outcome',
      post_id: isDelete ? null : report.target_post_id,
      metadata: notifMetadata,
    })

    const msg = isDelete
      ? '<p>The post has been <strong>deleted</strong> and the reporter has been notified.</p>'
      : '<p>The post will be <strong>kept</strong>. The reporter has been notified that no action was needed.</p>'

    return new Response(htmlPage(isDelete ? 'Post removed ✓' : 'Post kept ✓', msg, isDelete ? '#dc2626' : '#16a34a'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (e) {
    console.error('moderate-report error', e)
    return new Response(htmlPage('Error', `<p>${(e as Error).message}</p>`, '#dc2626'), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
})

// Helper exported for use by the report-trigger edge function
export async function signAction(reportId: string, action: 'delete' | 'keep'): Promise<string> {
  return hmac(`${reportId}:${action}`)
}