import { TestBed } from '@angular/core/testing';
import { BookingView, TimeSlotView } from '../models/ui.models';
import { RoomScheduleService } from './room-schedule.service';
import { ScheduleItemDto } from './rooms-api.service';

describe('RoomScheduleService', () => {
  let service: RoomScheduleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RoomScheduleService);
  });

  describe('isSlotPast', () => {
    const date = '2026-06-03';

    it('marca bloco terminado no mesmo dia', () => {
      const slots = service.buildTimeSlots(date, []);
      const past = slots.find((s) => s.startMinute === 10 * 60)!;
      const now = new Date('2026-06-03T11:00:00-03:00');
      expect(service.isSlotPast(past, date, now)).toBe(true);
    });

    it('não marca bloco ainda em curso ou futuro no mesmo dia', () => {
      const slots = service.buildTimeSlots(date, []);
      const current = slots.find((s) => s.startMinute === 11 * 60)!;
      const now = new Date('2026-06-03T11:00:00-03:00');
      expect(service.isSlotPast(current, date, now)).toBe(false);
    });

    it('marca todos os blocos em dia anterior', () => {
      const slots = service.buildTimeSlots('2026-06-02', []);
      const slot = slots.find((s) => s.startMinute === 15 * 60)!;
      expect(service.isSlotPast(slot, '2026-06-02', new Date('2026-06-03T10:00:00-03:00'))).toBe(true);
    });

    it('não marca manhã como passada quando o dia exibido é futuro em relação a hoje (Brasília)', () => {
      const slots = service.buildTimeSlots('2026-06-04', []);
      const morning = slots.find((s) => s.startMinute === 6 * 60)!;
      expect(service.isSlotPast(morning, '2026-06-04', new Date('2026-06-03T22:00:00-03:00'))).toBe(false);
    });
  });

  describe('formatPersonDisplayName', () => {
    it('converte e-mail em nome legível', () => {
      expect(service.formatPersonDisplayName('andre.patricio@allianzparque.com.br')).toBe('Andre Patricio');
    });

    it('mantém texto que já é nome', () => {
      expect(service.formatPersonDisplayName('Maria Silva')).toBe('Maria Silva');
    });
  });

  describe('formatIsoTime', () => {
    it('converte UTC para horário de Brasília', () => {
      expect(service.formatIsoTime('2026-05-16T01:30:00Z')).toBe('22:30');
    });

    it('mantém horário quando ISO já está em -03:00', () => {
      expect(service.formatIsoTime('2026-05-15T22:30:00-03:00')).toBe('22:30');
    });

    it('retorna placeholder para ISO inválido', () => {
      expect(service.formatIsoTime('invalid')).toBe('--:--');
    });
  });

  describe('formatIsoDateTime', () => {
    it('formata data e hora em Brasília a partir de UTC', () => {
      expect(service.formatIsoDateTime('2026-05-16T01:30:00Z')).toBe('15/05/2026 22:30');
    });

    it('formata data e hora quando ISO está em -03:00', () => {
      expect(service.formatIsoDateTime('2026-05-15T22:30:00-03:00')).toBe('15/05/2026 22:30');
    });
  });

  describe('getUpcomingMeetings', () => {
    const now = new Date('2026-05-15T12:00:00-03:00');

    const bookingUtc: BookingView = {
      eventId: 'evt-1',
      roomEmail: 'sala@test.com',
      roomName: 'Sala Teste',
      title: 'Reunião',
      startTime: '2026-05-16T01:30:00Z',
      endTime: '2026-05-16T02:30:00Z',
      organizer: 'Maria Silva',
    };

    const scheduleBrt: ScheduleItemDto = {
      start: '2026-05-15T22:30:00-03:00',
      end: '2026-05-15T23:30:00-03:00',
      status: 'busy',
      subject: 'Reunião de projeto',
    };

    it('funde o mesmo instante com formatos ISO diferentes', () => {
      const meetings = service.getUpcomingMeetings(now, [scheduleBrt], [bookingUtc]);

      expect(meetings).toHaveLength(1);
      expect(meetings[0].time).toBe('22:30');
    });

    it('prefere título descritivo e organizador ao fundir duplicatas', () => {
      const meetings = service.getUpcomingMeetings(now, [scheduleBrt], [bookingUtc]);

      expect(meetings[0].title).toBe('Reunião de projeto');
      expect(meetings[0].organizer).toBe('Maria Silva');
    });

    it('não inclui reuniões já iniciadas ou no passado', () => {
      const pastBooking: BookingView = {
        ...bookingUtc,
        startTime: '2026-05-15T08:00:00-03:00',
        endTime: '2026-05-15T09:00:00-03:00',
      };

      const meetings = service.getUpcomingMeetings(now, [], [pastBooking]);

      expect(meetings).toHaveLength(0);
    });
  });

  describe('resolveBookableSlotClick', () => {
    const date = '2026-06-03';

    it('devolve o slot parcial ao clicar no bloco atual da grelha', () => {
      const slots = service.buildTimeSlots(date, []);
      const now = new Date('2026-06-03T11:07:00-03:00');
      const bookable = service.getBookableSlots(slots, now, date);
      const partial = bookable.find((s) => s.startMinute === 11 * 60 + 7);
      const gridSlot = slots.find((s) => s.startMinute === 11 * 60)!;

      expect(partial).toBeDefined();
      expect(service.resolveBookableSlotClick(gridSlot, bookable)).toBe(partial);
    });

    it('devolve o slot da grelha quando não há parcial no bloco', () => {
      const slots = service.buildTimeSlots(date, []);
      const bookable = service.getBookableSlots(slots, new Date('2026-06-03T14:00:00-03:00'), date);
      const gridSlot = slots.find((s) => s.startMinute === 15 * 60)!;

      expect(service.resolveBookableSlotClick(gridSlot, bookable).startTime).toBe(gridSlot.startTime);
    });
  });

  describe('buildAvailableEndTimeOptions', () => {
    const date = '2026-06-03';

    function slotAt(hour: number, minute: number): TimeSlotView | undefined {
      const startMinute = hour * 60 + minute;
      return service.buildTimeSlots(date, []).find((s) => s.startMinute === startMinute);
    }

    function markOccupied(slots: TimeSlotView[], hour: number, minute: number): TimeSlotView[] {
      const startMinute = hour * 60 + minute;
      return slots.map((s) =>
        s.startMinute === startMinute ? { ...s, status: 'occupied' as const } : s,
      );
    }

    it('oferece vários horários de fim em blocos livres consecutivos a partir de 11:00', () => {
      const slots = service.buildTimeSlots(date, []);
      const startTime = slotAt(11, 0)!.startTime;
      const anchor = { startTime, startMinute: 11 * 60 };

      const options = service.buildAvailableEndTimeOptions(startTime, slots, anchor);

      expect(options.length).toBeGreaterThanOrEqual(3);
      expect(options[0].value).toBe(slotAt(11, 0)!.endTime);
      expect(options[1].value).toBe(slotAt(11, 30)!.endTime);
      expect(options[2].value).toBe(slotAt(12, 0)!.endTime);
      expect(options[0].label).toContain('11:30');
      expect(options[0].label).toContain('30 min');
      expect(options[2].label).toContain('12:30');
      expect(options[2].label).toContain('1 h 30');
    });

    it('para no último bloco livre quando o seguinte está ocupado', () => {
      const base = service.buildTimeSlots(date, []);
      const slots = markOccupied(base, 12, 0);
      const startTime = slotAt(11, 0)!.startTime;
      const anchor = { startTime, startMinute: 11 * 60 };

      const options = service.buildAvailableEndTimeOptions(startTime, slots, anchor);

      expect(options).toHaveLength(2);
      expect(options[0].value).toBe(slotAt(11, 0)!.endTime);
      expect(options[1].value).toBe(slotAt(11, 30)!.endTime);
    });

    it('suporta início parcial no bloco atual e estende aos blocos seguintes livres', () => {
      const slots = service.buildTimeSlots(date, []);
      const block = slotAt(11, 0)!;
      const startTime = '2026-06-03T11:07:00-03:00';
      const anchor = { startTime, startMinute: 11 * 60 + 7 };

      const options = service.buildAvailableEndTimeOptions(startTime, slots, anchor);

      expect(options.length).toBeGreaterThanOrEqual(2);
      expect(options[0].value).toBe(block.endTime);
      expect(options[0].label).toContain('11:30');
      expect(options[1].value).toBe(slotAt(11, 30)!.endTime);
    });

    it('retorna vazio sem horário de início ou slots', () => {
      expect(service.buildAvailableEndTimeOptions('', [])).toEqual([]);
      expect(service.buildAvailableEndTimeOptions('2026-06-03T11:00:00-03:00', [])).toEqual([]);
    });
  });
});
