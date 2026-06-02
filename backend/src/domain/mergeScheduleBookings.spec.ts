import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildSyntheticScheduleEventId,
  isSyntheticScheduleEventId,
  mergeScheduleItemsIntoBookings,
} from "./mergeScheduleBookings";
import { Booking, ScheduleItem } from "./entities/Room";

const roomEmail = "sala@wtorre.com.br";
const roomName = "Sala Teste";

const calendarBooking: Booking = {
  eventId: "AAMk-real",
  roomEmail,
  roomName,
  title: "Reunião no calendário",
  start: "2026-06-02T14:00:00-03:00",
  end: "2026-06-02T15:00:00-03:00",
  source: "calendar",
};

test("mergeScheduleItemsIntoBookings: adiciona item busy sem overlap no calendarView", () => {
  const scheduleOnly: ScheduleItem = {
    start: "2026-06-02T16:00:00-03:00",
    end: "2026-06-02T17:00:00-03:00",
    status: "busy",
    subject: "Outlook sem mailbox",
  };

  const merged = mergeScheduleItemsIntoBookings([], [scheduleOnly], roomEmail, roomName);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.source, "schedule");
  assert.equal(merged[0]?.title, "Outlook sem mailbox");
  assert.equal(
    merged[0]?.eventId,
    buildSyntheticScheduleEventId(roomEmail, scheduleOnly.start, scheduleOnly.end),
  );
});

test("mergeScheduleItemsIntoBookings: não duplica quando schedule sobrepõe calendar", () => {
  const overlapping: ScheduleItem = {
    start: calendarBooking.start,
    end: calendarBooking.end,
    status: "busy",
    subject: "Mesmo horário",
  };

  const merged = mergeScheduleItemsIntoBookings([calendarBooking], [overlapping], roomEmail, roomName);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.eventId, "AAMk-real");
  assert.equal(merged[0]?.source, "calendar");
});

test("mergeScheduleItemsIntoBookings: ignora itens free", () => {
  const free: ScheduleItem = {
    start: "2026-06-02T10:00:00-03:00",
    end: "2026-06-02T11:00:00-03:00",
    status: "free",
  };

  const merged = mergeScheduleItemsIntoBookings([], [free], roomEmail, roomName);
  assert.equal(merged.length, 0);
});

test("isSyntheticScheduleEventId identifica ids gerados", () => {
  const id = buildSyntheticScheduleEventId(roomEmail, "2026-06-02T10:00:00-03:00", "2026-06-02T11:00:00-03:00");
  assert.ok(isSyntheticScheduleEventId(id));
  assert.ok(!isSyntheticScheduleEventId("AAMkAGI2"));
});
