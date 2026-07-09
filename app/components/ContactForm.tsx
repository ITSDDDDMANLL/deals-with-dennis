"use client";

import { FormEvent, useEffect, useState } from "react";

type SubmitState = "idle" | "sending" | "sent" | "error";

export function ContactForm({
  initialMessage = "",
  initialVehicleType = "",
}: {
  initialMessage?: string;
  initialVehicleType?: string;
}) {
  const [state, setState] = useState<SubmitState>("idle");
  const [vehicleType, setVehicleType] = useState(initialVehicleType);
  const [message, setMessage] = useState(initialMessage);

  useEffect(() => {
    setVehicleType(initialVehicleType);
    setMessage(initialMessage);
  }, [initialMessage, initialVehicleType]);

  useEffect(() => {
    if (initialMessage || initialVehicleType) {
      return;
    }

    const savedPrefill = window.sessionStorage.getItem("deals-contact-prefill");

    if (savedPrefill) {
      try {
        const parsed = JSON.parse(savedPrefill) as {
          message?: string;
          vehicleType?: string;
        };
        setVehicleType(parsed.vehicleType ?? "");
        setMessage(parsed.message ?? "");
        window.sessionStorage.removeItem("deals-contact-prefill");
      } catch {
        window.sessionStorage.removeItem("deals-contact-prefill");
      }
    }

    function handleVehicleContact(event: Event) {
      const detail = (event as CustomEvent<{
        message?: string;
        vehicleType?: string;
      }>).detail;

      setVehicleType(detail?.vehicleType ?? "");
      setMessage(detail?.message ?? "");
    }

    window.addEventListener("deals-contact-vehicle", handleVehicleContact);

    return () => {
      window.removeEventListener("deals-contact-vehicle", handleVehicleContact);
    };
  }, [initialMessage, initialVehicleType]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    const response = await fetch("/api/contact", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (response.ok) {
      form.reset();
      setVehicleType("");
      setMessage("");
      setState("sent");
      return;
    }

    setState("error");
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <label>
        <span>Your name</span>
        <input name="name" required type="text" />
      </label>
      <label>
        <span>Phone number</span>
        <input name="phone" required type="tel" />
      </label>
      <label>
        <span>Vehicle interest</span>
        <select
          name="vehicleType"
          onChange={(event) => setVehicleType(event.target.value)}
          value={vehicleType}
        >
          <option value="">Not sure yet</option>
          <option value="new">New vehicle</option>
          <option value="used">Used vehicle</option>
          <option value="trade">Trade-in question</option>
        </select>
      </label>
      <label>
        <span>Message</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          name="message"
          placeholder="Budget, preferred model, trade-in details, or a good time to call"
          rows={5}
        />
      </label>
      <button className="button primary" disabled={state === "sending"}>
        {state === "sending" ? "Sending..." : "Submit Inquiry"}
      </button>
      <p className="form-note">
        By submitting, you agree to be contacted by phone or text about this
        inquiry.
      </p>
      {state === "sent" ? (
        <p className="form-success">Thanks. Your inquiry was received.</p>
      ) : null}
      {state === "error" ? (
        <p className="form-error">Something went wrong. Please try again.</p>
      ) : null}
    </form>
  );
}
