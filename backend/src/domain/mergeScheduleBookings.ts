import { Booking, ScheduleItem } from "./entities/Room";
import { isBusyScheduleStatus, overlapsInterval } from "./scheduleOverlap";

export function buildSyntheticScheduleEventId(roomEmail: string, start: string, end: string): string {
  return `schedule:${roomEmail.trim().toLowerCase()}:${start}|${end}`;
}

export function isSyntheticScheduleEventId(eventId: string): boolean {
  return eventId.startsWith("schedule:");
}

function bookingOverlapsItem(booking: Pick<Booking, "start" | "end">, item: ScheduleItem): boolean {
  return overlapsInterval(item.start, item.end, booking.start, booking.end);
}

/** Inclui itens busy do getSchedule que não têm evento correspondente no calendarView da sala. */
export function mergeScheduleItemsIntoBookings(
  calendarBookings: Booking[],
  scheduleItems: ScheduleItem[],
  roomEmail: string,
  roomName: string,
): Booking[] {
  const result: Booking[] = calendarBookings.map((booking) => ({
    ...booking,
    source: booking.source ?? "calendar",
  }));

  for (const item of scheduleItems) {
    if (!isBusyScheduleStatus(item.status)) continue;
    const overlapsCalendar = calendarBookings.some((booking) => bookingOverlapsItem(booking, item));
    if (overlapsCalendar) continue;

    result.push({
      eventId: buildSyntheticScheduleEventId(roomEmail, item.start, item.end),
      roomEmail,
      roomName,
      title: item.subject?.trim() || "Reunião",
      start: item.start,
      end: item.end,
      source: "schedule",
    });
  }

  return result;
}
