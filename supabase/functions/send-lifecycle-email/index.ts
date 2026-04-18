import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, type, data } = await req.json()

    let subject = ""
    let html = ""

    switch (type) {
      case 'welcome':
        subject = "Welcome to Digit Differs!"
        html = `<h1>Welcome aboard!</h1><p>You've successfully created your account. Start trading on demo or upgrade to unlock real accounts.</p>`
        break;
      case 'activated':
        subject = "Subscription Activated!"
        html = `<h1>Level Up!</h1><p>Your ${data.plan} subscription has been activated. You now have full access to Real Account trading.</p>`
        break;
      case 'expiring':
        subject = "Subscription Expiring Soon"
        html = `<h1>Heads up!</h1><p>Your subscription expires in 3 days. Renew now to avoid interruption in your trading.</p>`
        break;
      case 'deactivated':
        subject = "Subscription Expired"
        html = `<h1>Expired</h1><p>Your subscription has expired. Switch to a new plan to resume Real account trading.</p>`
        break;
      default:
        throw new Error("Invalid email type")
    }

    // RESILIENCY: If API key is missing, log and exit gracefully so app doesn't break
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not found. Skipping email send.");
      return new Response(JSON.stringify({ message: "Email skipped - no provider key" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Digit Differs <notifications@resend.dev>', // Using verified resend.dev for testing safety
        to: [email],
        subject: subject,
        html: html,
      }),
    })

    const result = await res.json()

    // If email failed, we still return 200 so we don't block the caller
    if (!res.ok) {
      console.error("Email Provider Error:", result);
      return new Response(JSON.stringify({ error: "Email provider error, but action succeeded", detail: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
