// Kratos Email Courier Webhook
// Kratos POSTs email delivery requests here

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface KratosCourierPayload {
  body: string;
  recipient: string;
  subject: string;
  template_type?: string;
}

export async function POST(request: NextRequest) {
  let payload: KratosCourierPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!payload.recipient || !payload.subject || !payload.body) {
    return NextResponse.json(
      { error: 'missing required fields: recipient, subject, body' },
      { status: 400 },
    );
  }

  try {
    console.info('[Kratos Courier] Email delivery request:', {
      to: payload.recipient,
      subject: payload.subject,
      template: payload.template_type,
    });

    return NextResponse.json({ status: 'sent' });
  } catch (error) {
    console.error('[Kratos Courier] Failed:', error);
    return NextResponse.json({ error: 'email delivery failed' }, { status: 502 });
  }
}
