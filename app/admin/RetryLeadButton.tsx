"use client";

import { useState } from "react";

type RetryState = "idle" | "pushing" | "pushed" | "failed";

export function RetryLeadButton({ inquiryId }: { inquiryId: string }) {
  const [state, setState] = useState<RetryState>("idle");
  const [message, setMessage] = useState("");

  async function retryLead() {
    setState("pushing");
    setMessage("");

    const response = await fetch(`/api/admin/inquiries/${inquiryId}/retry`, {
      method: "POST",
    });
    const body = await response.json().catch(() => null) as
      | { error?: string }
      | null;

    if (!response.ok) {
      setMessage(body?.error ?? "Retry failed.");
      setState("failed");
      return;
    }

    setState("pushed");
    setMessage("Pushed to Clients in Hands.");
  }

  return (
    <div className="retry-lead-action">
      <button
        className="button secondary"
        disabled={state === "pushing"}
        onClick={retryLead}
        type="button"
      >
        {state === "pushing" ? "Pushing..." : "Retry CRM Push"}
      </button>
      {message ? (
        <p className={state === "failed" ? "form-error" : "form-success"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
