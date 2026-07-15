"use client";

import { useMemo, useState } from "react";
import type { ContactInquiry } from "../../../lib/inquiry-store";
import { RetryLeadButton } from "../RetryLeadButton";

type ViewMode = "daily" | "weekly" | "monthly";
type AppointmentTypeFilter = "all" | "new" | "used" | "trade" | "not-sure";

const appointmentTypeOptions: Array<{
  label: string;
  value: AppointmentTypeFilter;
}> = [
  { label: "All appointment types", value: "all" },
  { label: "New vehicle", value: "new" },
  { label: "Used vehicle", value: "used" },
  { label: "Trade-in question", value: "trade" },
  { label: "Not sure yet", value: "not-sure" },
];

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const vancouverTimeZone = "America/Vancouver";

export function AdminAppointmentCalendar({
  appointments,
}: {
  appointments: ContactInquiry[];
}) {
  const initialDate = appointments[0]?.appointmentDate || vancouverTodayKey();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(parseDateKey(initialDate)),
  );
  const [view, setView] = useState<ViewMode>("daily");
  const [typeFilter, setTypeFilter] = useState<AppointmentTypeFilter>("all");
  const [items, setItems] = useState(appointments);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(
    appointments[0]?.id ?? "",
  );
  const [deleteState, setDeleteState] = useState<"idle" | "deleting" | "error">(
    "idle",
  );

  const filteredAppointments = useMemo(
    () =>
      items
        .filter((appointment) => matchesAppointmentType(appointment, typeFilter))
        .sort(compareAppointments),
    [items, typeFilter],
  );
  const selectedAppointment =
    filteredAppointments.find(
      (appointment) => appointment.id === selectedAppointmentId,
    ) ?? filteredAppointments[0] ?? null;
  const selectedDayAppointments = filteredAppointments.filter(
    (appointment) => appointment.appointmentDate === selectedDate,
  );
  const weekDays = getWeekDays(parseDateKey(selectedDate));
  const monthCells = getMonthCells(visibleMonth);
  const monthLabel = formatMonth(visibleMonth);

  function selectDate(nextDate: string, nextView: ViewMode = view) {
    setSelectedDate(nextDate);
    setVisibleMonth(startOfMonth(parseDateKey(nextDate)));
    setView(nextView);
    const firstAppointment = filteredAppointments.find(
      (appointment) => appointment.appointmentDate === nextDate,
    );
    if (firstAppointment) {
      setSelectedAppointmentId(firstAppointment.id);
    }
  }

  async function deleteAppointment(id: string) {
    const appointment = items.find((item) => item.id === id);
    const confirmed = window.confirm(
      `Delete appointment for ${appointment?.name || "this lead"}? This removes the saved inquiry from Deals with Dennis.`,
    );
    if (!confirmed) return;

    setDeleteState("deleting");
    const response = await fetch(`/api/admin/inquiries/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setDeleteState("error");
      return;
    }

    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedAppointmentId("");
    setDeleteState("idle");
  }

  return (
    <section className="appointment-workspace">
      <aside className="appointment-sidebar" aria-label="Appointment calendar">
        <div className="mini-calendar-head">
          <button
            aria-label="Previous month"
            onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
            type="button"
          >
            ‹
          </button>
          <strong>{monthLabel}</strong>
          <button
            aria-label="Next month"
            onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
            type="button"
          >
            ›
          </button>
        </div>

        <div className="mini-calendar-grid">
          {dayNames.map((day) => (
            <span className="mini-calendar-day-name" key={day}>
              {day[0]}
            </span>
          ))}
          {monthCells.map((cell) => {
            const cellKey = dateKey(cell);
            const dayAppointments = filteredAppointments.filter(
              (appointment) => appointment.appointmentDate === cellKey,
            );
            const isCurrentMonth = cell.getMonth() === visibleMonth.getMonth();
            return (
              <button
                className={[
                  "mini-calendar-day",
                  cellKey === selectedDate ? "active" : "",
                  isCurrentMonth ? "" : "muted",
                  dayAppointments.length ? "has-appointments" : "",
                ].filter(Boolean).join(" ")}
                key={cellKey}
                onClick={() => selectDate(cellKey, "daily")}
                type="button"
              >
                <span>{cell.getDate()}</span>
                {dayAppointments.length ? <i>{dayAppointments.length}</i> : null}
              </button>
            );
          })}
        </div>

        <div className="appointment-filter-panel">
          <label>
            <span>Appointment Type</span>
            <select
              onChange={(event) =>
                setTypeFilter(event.target.value as AppointmentTypeFilter)
              }
              value={typeFilter}
            >
              {appointmentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </aside>

      <div className="appointment-main">
        <div className="appointment-toolbar">
          <div className="appointment-tabs" role="tablist">
            {(["daily", "weekly", "monthly"] as ViewMode[]).map((mode) => (
              <button
                className={view === mode ? "active" : ""}
                key={mode}
                onClick={() => setView(mode)}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="appointment-period-controls">
            <button onClick={() => shiftPeriod(-1, view)} type="button">
              ‹
            </button>
            <strong>{periodLabel(view, selectedDate, visibleMonth)}</strong>
            <button onClick={() => shiftPeriod(1, view)} type="button">
              ›
            </button>
          </div>
          <p>
            <strong>{filteredAppointments.length}</strong> appointment
            {filteredAppointments.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="appointment-board">
          {view === "daily" ? (
            <DailyPlanner
              appointments={selectedDayAppointments}
              deleteAppointment={deleteAppointment}
              deleteState={deleteState}
              selectedAppointment={selectedAppointment}
              selectedDate={selectedDate}
              selectedAppointmentId={selectedAppointmentId}
              setSelectedAppointmentId={setSelectedAppointmentId}
            />
          ) : null}
          {view === "weekly" ? (
            <WeeklyView
              appointments={filteredAppointments}
              days={weekDays}
              selectDate={selectDate}
              selectedAppointmentId={selectedAppointmentId}
              setSelectedAppointmentId={setSelectedAppointmentId}
            />
          ) : null}
          {view === "monthly" ? (
            <MonthlyView
              appointments={filteredAppointments}
              monthCells={monthCells}
              selectDate={selectDate}
              selectedAppointmentId={selectedAppointmentId}
              setSelectedAppointmentId={setSelectedAppointmentId}
              visibleMonth={visibleMonth}
            />
          ) : null}
        </div>
      </div>
    </section>
  );

  function shiftPeriod(direction: -1 | 1, mode: ViewMode) {
    if (mode === "monthly") {
      const nextMonth = addMonths(visibleMonth, direction);
      setVisibleMonth(nextMonth);
      setSelectedDate(dateKey(nextMonth));
      return;
    }

    const nextDate = addDays(parseDateKey(selectedDate), mode === "weekly" ? direction * 7 : direction);
    selectDate(dateKey(nextDate));
  }
}

function DailyPlanner({
  appointments,
  deleteAppointment,
  deleteState,
  selectedAppointment,
  selectedAppointmentId,
  selectedDate,
  setSelectedAppointmentId,
}: {
  appointments: ContactInquiry[];
  deleteAppointment: (id: string) => void;
  deleteState: "idle" | "deleting" | "error";
  selectedAppointment: ContactInquiry | null;
  selectedAppointmentId: string;
  selectedDate: string;
  setSelectedAppointmentId: (id: string) => void;
}) {
  const slots = daySlots(selectedDate);

  return (
    <div className="appointment-daily-layout">
      <div className="daily-planner">
        <div className="daily-planner-head">
          <div>
            <span>{isToday(selectedDate) ? "Today" : dayName(selectedDate)}</span>
            <h2>{formatDateLong(selectedDate)}</h2>
          </div>
          <strong>
            {appointments.length} appointment{appointments.length === 1 ? "" : "s"}
          </strong>
        </div>
        <div className="daily-slot-list">
          {slots.map((slot) => {
            const slotAppointments = appointments.filter(
              (appointment) => normalizedTime(appointment.appointmentTime) === slot,
            );
            return (
              <div className="daily-slot-row" key={slot}>
                <time>{formatTime(slot)}</time>
                <div className="daily-slot-events">
                  {slotAppointments.length ? (
                    slotAppointments.map((appointment) => (
                      <AppointmentChip
                        appointment={appointment}
                        isSelected={appointment.id === selectedAppointmentId}
                        key={appointment.id}
                        onClick={() => setSelectedAppointmentId(appointment.id)}
                      />
                    ))
                  ) : (
                    <span className="empty-slot">Available</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AppointmentDetailPanel
        appointment={selectedAppointment}
        deleteAppointment={deleteAppointment}
        deleteState={deleteState}
      />
    </div>
  );
}

function WeeklyView({
  appointments,
  days,
  selectDate,
  selectedAppointmentId,
  setSelectedAppointmentId,
}: {
  appointments: ContactInquiry[];
  days: Date[];
  selectDate: (date: string, view: ViewMode) => void;
  selectedAppointmentId: string;
  setSelectedAppointmentId: (id: string) => void;
}) {
  return (
    <div className="weekly-grid">
      {days.map((day) => {
        const key = dateKey(day);
        const dayAppointments = appointments.filter(
          (appointment) => appointment.appointmentDate === key,
        );

        return (
          <section className="weekly-day" key={key}>
            <button onClick={() => selectDate(key, "daily")} type="button">
              <span>{dayNames[day.getDay()]}</span>
              <strong>{day.getDate()}</strong>
            </button>
            <div>
              {dayAppointments.length ? (
                dayAppointments.map((appointment) => (
                  <AppointmentChip
                    appointment={appointment}
                    isCompact
                    isSelected={appointment.id === selectedAppointmentId}
                    key={appointment.id}
                    onClick={() => setSelectedAppointmentId(appointment.id)}
                  />
                ))
              ) : (
                <span className="empty-slot">No appointments</span>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MonthlyView({
  appointments,
  monthCells,
  selectDate,
  selectedAppointmentId,
  setSelectedAppointmentId,
  visibleMonth,
}: {
  appointments: ContactInquiry[];
  monthCells: Date[];
  selectDate: (date: string, view: ViewMode) => void;
  selectedAppointmentId: string;
  setSelectedAppointmentId: (id: string) => void;
  visibleMonth: Date;
}) {
  return (
    <div className="monthly-calendar">
      {dayNames.map((day) => (
        <strong className="monthly-day-name" key={day}>
          {day}
        </strong>
      ))}
      {monthCells.map((cell) => {
        const key = dateKey(cell);
        const dayAppointments = appointments.filter(
          (appointment) => appointment.appointmentDate === key,
        );
        const inMonth = cell.getMonth() === visibleMonth.getMonth();

        return (
          <section
            className={`monthly-cell ${inMonth ? "" : "muted"}`}
            key={key}
          >
            <button onClick={() => selectDate(key, "daily")} type="button">
              {cell.getDate()}
            </button>
            <div>
              {dayAppointments.slice(0, 3).map((appointment) => (
                <AppointmentChip
                  appointment={appointment}
                  isCompact
                  isSelected={appointment.id === selectedAppointmentId}
                  key={appointment.id}
                  onClick={() => setSelectedAppointmentId(appointment.id)}
                />
              ))}
              {dayAppointments.length > 3 ? (
                <button
                  className="monthly-more"
                  onClick={() => selectDate(key, "daily")}
                  type="button"
                >
                  +{dayAppointments.length - 3} more
                </button>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AppointmentDetailPanel({
  appointment,
  deleteAppointment,
  deleteState,
}: {
  appointment: ContactInquiry | null;
  deleteAppointment: (id: string) => void;
  deleteState: "idle" | "deleting" | "error";
}) {
  if (!appointment) {
    return (
      <aside className="appointment-detail-panel">
        <p className="admin-empty">Select an appointment to manage it.</p>
      </aside>
    );
  }

  return (
    <aside className="appointment-detail-panel">
      <div className="appointment-detail-head">
        <span className={`appointment-type ${appointmentTypeClass(appointment)}`}>
          {labelVehicleType(appointment.vehicleType)}
        </span>
        <h2>{appointment.name || "No name"}</h2>
        <p>
          {formatDateLong(appointment.appointmentDate)} ·{" "}
          {formatTime(appointment.appointmentTime)}
        </p>
      </div>

      <dl className="appointment-detail-list">
        <div>
          <dt>Phone</dt>
          <dd>{appointment.phone || "N/A"}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{appointment.email || "N/A"}</dd>
        </div>
        <div>
          <dt>Preferred Contact</dt>
          <dd>{labelContactMethod(appointment.preferredContactMethod)}</dd>
        </div>
        <div>
          <dt>CRM Status</dt>
          <dd>
            {labelClientsInHandsStatus(appointment.clientsInHandsStatus)}
            {appointment.clientsInHandsError ? ` - ${appointment.clientsInHandsError}` : ""}
          </dd>
        </div>
        <div>
          <dt>Vehicle</dt>
          <dd>
            {labelVehicleType(appointment.vehicleType)}
            {appointment.vehicleStockNumber ? ` · Stock ${appointment.vehicleStockNumber}` : ""}
          </dd>
        </div>
        <div>
          <dt>Notes</dt>
          <dd>{appointment.appointmentNotes || appointment.message || "No notes provided."}</dd>
        </div>
      </dl>

      <div className="appointment-manage-actions">
        {appointment.clientsInHandsStatus !== "sent" ? (
          <RetryLeadButton inquiryId={appointment.id} />
        ) : null}
        <button
          className="button danger"
          disabled={deleteState === "deleting"}
          onClick={() => deleteAppointment(appointment.id)}
          type="button"
        >
          {deleteState === "deleting" ? "Deleting..." : "Delete Appointment"}
        </button>
        {deleteState === "error" ? (
          <p className="form-error">Delete failed. Please try again.</p>
        ) : null}
      </div>
    </aside>
  );
}

function AppointmentChip({
  appointment,
  isCompact = false,
  isSelected,
  onClick,
}: {
  appointment: ContactInquiry;
  isCompact?: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "appointment-chip",
        appointmentTypeClass(appointment),
        isCompact ? "compact" : "",
        isSelected ? "selected" : "",
      ].filter(Boolean).join(" ")}
      onClick={onClick}
      type="button"
    >
      <strong>{appointment.name || "No name"}</strong>
      <span>
        {formatTime(appointment.appointmentTime)} ·{" "}
        {labelVehicleType(appointment.vehicleType)}
      </span>
      {appointment.clientsInHandsStatus === "sent" ? <i>CRM</i> : null}
    </button>
  );
}

function compareAppointments(a: ContactInquiry, b: ContactInquiry) {
  return `${a.appointmentDate} ${a.appointmentTime}`.localeCompare(
    `${b.appointmentDate} ${b.appointmentTime}`,
  );
}

function matchesAppointmentType(
  appointment: ContactInquiry,
  filter: AppointmentTypeFilter,
) {
  if (filter === "all") return true;
  if (filter === "not-sure") return !["new", "used", "trade"].includes(appointment.vehicleType);
  return appointment.vehicleType === filter;
}

function appointmentTypeClass(appointment: ContactInquiry) {
  if (appointment.vehicleType === "new") return "type-new";
  if (appointment.vehicleType === "used") return "type-used";
  if (appointment.vehicleType === "trade") return "type-trade";
  return "type-open";
}

function labelVehicleType(value: string) {
  if (value === "new") return "New vehicle";
  if (value === "used") return "Used vehicle";
  if (value === "trade") return "Trade-in question";
  return "Not sure yet";
}

function labelContactMethod(value: string) {
  if (value === "email") return "Email";
  if (value === "sms") return "Text message";
  return "Phone call";
}

function labelClientsInHandsStatus(value: string) {
  if (value === "sent") return "Pushed";
  if (value === "failed") return "Failed";
  if (value === "skipped") return "Not configured";
  return "Pending";
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day || 1);
}

function dateKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizedTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "09:00";
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(value: Date, months: number) {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

function getWeekDays(value: Date) {
  const start = addDays(value, -value.getDay());
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function getMonthCells(month: Date) {
  const first = startOfMonth(month);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function daySlots(date: string) {
  const day = parseDateKey(date).getDay();
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

function formatTime(value: string) {
  const [hour, minute] = normalizedTime(value).split(":").map(Number);
  const date = new Date(Date.UTC(2026, 0, 1, hour, minute, 0, 0));

  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatDateLong(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "full",
    timeZone: vancouverTimeZone,
  }).format(dateKeyNoon(value));
}

function dayName(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: vancouverTimeZone,
    weekday: "long",
  }).format(dateKeyNoon(value));
}

function isToday(value: string) {
  return value === vancouverTodayKey();
}

function periodLabel(view: ViewMode, selectedDate: string, visibleMonth: Date) {
  if (view === "monthly") return formatMonth(visibleMonth);
  if (view === "weekly") {
    const days = getWeekDays(parseDateKey(selectedDate));
    return `${formatShortDate(dateKey(days[0]))} - ${formatShortDate(dateKey(days[6]))}`;
  }
  return formatDateLong(selectedDate);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "short",
    timeZone: vancouverTimeZone,
  }).format(dateKeyNoon(value));
}

function dateKeyNoon(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day || 1, 12, 0, 0, 0));
}

function vancouverTodayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: vancouverTimeZone,
    year: "numeric",
  }).formatToParts(new Date());

  return [
    parts.find((part) => part.type === "year")?.value ?? "",
    parts.find((part) => part.type === "month")?.value ?? "",
    parts.find((part) => part.type === "day")?.value ?? "",
  ].join("-");
}
