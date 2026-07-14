"use client";

import { FormEvent, useEffect, useState } from "react";
import { readErrorMessage } from "../utils/read-error-message";

type SubmitState = "idle" | "sending" | "sent" | "error";
type PreferredContactMethod = "email" | "phone" | "sms";

export function ContactForm({
  initialMessage = "",
  initialVehicle = {},
  initialVehicleType = "",
}: {
  initialMessage?: string;
  initialVehicle?: {
    make?: string;
    model?: string;
    stockNumber?: string;
    trim?: string;
    vin?: string;
    year?: number;
  };
  initialVehicleType?: string;
}) {
  const [state, setState] = useState<SubmitState>("idle");
  const [vehicleType, setVehicleType] = useState(initialVehicleType);
  const [message, setMessage] = useState(initialMessage);
  const [preferredContactMethod, setPreferredContactMethod] =
    useState<PreferredContactMethod>("phone");
  const [wantsAppointment, setWantsAppointment] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState(todayInputValue());
  const [errorMessage, setErrorMessage] = useState("");

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
    setErrorMessage("");

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    let response: Response;

    try {
      response = await fetch("/api/contact", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    } catch (error) {
      setErrorMessage(
        `Inquiry failed before reaching the server: ${getErrorMessage(error)}`,
      );
      setState("error");
      return;
    }

    if (response.ok) {
      form.reset();
      setVehicleType("");
      setMessage("");
      setPreferredContactMethod("phone");
      setWantsAppointment(false);
      setState("sent");
      return;
    }

    setErrorMessage(await readErrorMessage(response, "Inquiry submission failed."));
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
        <input name="phone" type="tel" />
      </label>
      <label>
        <span>Email</span>
        <input name="email" type="email" />
      </label>
      <label>
        <span>Preferred contact</span>
        <select
          name="preferredContactMethod"
          onChange={(event) =>
            setPreferredContactMethod(event.target.value as PreferredContactMethod)
          }
          value={preferredContactMethod}
        >
          <option value="phone">Phone call</option>
          <option value="email">Email</option>
          <option value="sms">Text message</option>
        </select>
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
      <div className="appointment-toggle">
        <button
          className={wantsAppointment ? "button primary" : "button secondary"}
          onClick={() => setWantsAppointment((current) => !current)}
          type="button"
        >
          {wantsAppointment ? "Appointment selected" : "Book appointment"}
        </button>
        <p>
          Appointments are one hour. Available times follow dealership hours.
        </p>
      </div>
      {wantsAppointment ? (
        <div className="appointment-fields">
          <label>
            <span>Date</span>
            <input
              min={todayInputValue()}
              name="appointmentDate"
              onChange={(event) => setAppointmentDate(event.target.value)}
              required={wantsAppointment}
              type="date"
              value={appointmentDate}
            />
          </label>
          <label>
            <span>Time</span>
            <select name="appointmentTime" required={wantsAppointment}>
              {appointmentSlots(appointmentDate).map((slot) => (
                <option key={slot} value={slot}>
                  {formatSlot(slot)}
                </option>
              ))}
            </select>
          </label>
          <label className="wide-field">
            <span>Appointment notes</span>
            <input
              name="appointmentNotes"
              placeholder="Test drive, trade appraisal, or vehicle walk-around"
              type="text"
            />
          </label>
        </div>
      ) : null}
      <input name="vehicleYear" type="hidden" value={initialVehicle.year ?? ""} />
      <input name="vehicleMake" type="hidden" value={initialVehicle.make ?? ""} />
      <input name="vehicleModel" type="hidden" value={initialVehicle.model ?? ""} />
      <input name="vehicleTrim" type="hidden" value={initialVehicle.trim ?? ""} />
      <input name="vehicleStockNumber" type="hidden" value={initialVehicle.stockNumber ?? ""} />
      <input name="vehicleVin" type="hidden" value={initialVehicle.vin ?? ""} />
      <button className="button primary" disabled={state === "sending"}>
        {state === "sending" ? "Sending..." : "Submit Inquiry"}
      </button>
      <p className="form-note">
        By submitting, you agree to be contacted about this inquiry. If you
        choose text message, Dennis will confirm manually.
      </p>
      {state === "sent" ? (
        <p className="form-success">
          Thanks. Your inquiry was received
          {wantsAppointment ? " and your appointment request was recorded." : "."}
        </p>
      ) : null}
      {state === "error" ? (
        <p className="form-error">
          {errorMessage || "Something went wrong. Please try again."}
        </p>
      ) : null}
    </form>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function appointmentSlots(dateValue: string) {
  const date = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
  const day = date.getDay();
  const [openHour, closeHour] =
    day === 0 ? [11, 17] : day === 5 || day === 6 ? [9, 18] : [9, 19];
  const slots: string[] = [];

  for (let hour = openHour; hour <= closeHour - 1; hour += 1) {
    slots.push(`${String(hour).padStart(2, "0")}:00`);
    if (hour < closeHour - 1) {
      slots.push(`${String(hour).padStart(2, "0")}:30`);
    }
  }

  return slots;
}

function formatSlot(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
