type PreferredContactMethod = "email" | "phone" | "sms";

export type WebsiteLeadPayload = {
  appointmentDate?: string | null;
  appointmentNotes?: string | null;
  appointmentTime?: string | null;
  email?: string | null;
  id: string;
  message?: string | null;
  name: string;
  phone?: string | null;
  preferredContactMethod?: PreferredContactMethod | null;
  source?: string | null;
  sourceUrl?: string | null;
  stage?: string | null;
  vehicle?: {
    condition?: "New" | "Used" | null;
    make?: string | null;
    model?: string | null;
    stockNumber?: string | null;
    trim?: string | null;
    vin?: string | null;
    year?: number | string | null;
  } | null;
};

export async function pushLeadToClientsInHands(lead: WebsiteLeadPayload) {
  const webhookUrl = process.env.CLIENTS_IN_HANDS_LEAD_WEBHOOK_URL;
  const secret = process.env.CLIENTS_IN_HANDS_WEBHOOK_SECRET;

  if (!webhookUrl || !secret) {
    return {
      mode: "skipped",
      reason: "Clients in Hands webhook env vars not set.",
    };
  }

  const response = await fetch(webhookUrl, {
    body: JSON.stringify(lead),
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const body = await response.json().catch(() => null) as
    | { dealId?: string; error?: string }
    | null;

  if (!response.ok) {
    return {
      mode: "failed",
      reason: body?.error ?? `Webhook failed with ${response.status}`,
    };
  }

  return {
    dealId: body?.dealId ?? null,
    mode: "sent",
  };
}
