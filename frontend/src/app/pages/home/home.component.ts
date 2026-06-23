import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Observable, firstValueFrom, timeout } from 'rxjs';
import { BookingFormComponent } from '../../components/booking-form/booking-form.component';
import { BookingsListComponent } from '../../components/bookings-list/bookings-list.component';
import { HeaderComponent } from '../../components/header/header.component';
import { RoomCardComponent } from '../../components/room-card/room-card.component';
import { RoomDetailsComponent } from '../../components/room-details/room-details.component';
import { TimelineComponent } from '../../components/timeline/timeline.component';
import { HeaderTab } from '../../components/header/header.component';
import { BookingSubmitPayload, BookingView, RoomView, TimeSlotView } from '../../models/ui.models';
import { RESERVAS_TAB_ID } from '../../models/ui-config.models';
import { BookingDto, RoomDto, RoomsApiService } from '../../services/rooms-api.service';
import { RoomScheduleService } from '../../services/room-schedule.service';
import { ToastService } from '../../services/toast.service';
import { UiConfigService } from '../../services/ui-config.service';
import { resolveTabLogoUrl, sortRoomsByTabOrder } from '../../utils/ui-config-resolver';

/** Corpo de erro retornado pela API (ex.: 409 Conflict). */
interface ApiErrorBody {
  code?: string;
  message?: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    RoomCardComponent,
    RoomDetailsComponent,
    TimelineComponent,
    BookingsListComponent,
    BookingFormComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  selectedDate = '';
  activeTab: HeaderTab = '';

  readonly reservasTabId = RESERVAS_TAB_ID;

  selectedRoom: RoomView | null = null;
  selectedSlot: TimeSlotView | null = null;
  showBookingForm = false;

  rooms: RoomView[] = [];
  bookings: BookingView[] = [];
  slots: TimeSlotView[] = [];

  isLoadingRooms = false;
  isLoadingBookings = false;
  isLoadingSlots = false;
  isBooking = false;
  private isRefreshingDashboard = false;
  private queuedRefresh = false;

  constructor(
    private readonly api: RoomsApiService,
    private readonly roomSchedule: RoomScheduleService,
    private readonly uiConfig: UiConfigService,
    private readonly cdr: ChangeDetectorRef,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.selectedDate = this.roomSchedule.todayBrazil();
    setTimeout(() => {
      void this.onRefresh();
    }, 0);
  }

  get bookableSlots(): TimeSlotView[] {
    return this.roomSchedule.getBookableSlots(this.slots, new Date(), this.selectedDate);
  }

  get roomsForCurrentTab(): RoomView[] {
    if (!this.uiConfig.isLocationTab(this.activeTab) || !this.uiConfig.config) return [];
    const filtered = this.rooms.filter(
      (room) => this.uiConfig.resolveTabForRoom(room.email) === this.activeTab,
    );
    return sortRoomsByTabOrder(filtered, this.activeTab, this.uiConfig.config);
  }

  get bookingsForCurrentTab(): BookingView[] {
    if (this.activeTab === this.reservasTabId) return this.bookings;
    if (!this.uiConfig.isLocationTab(this.activeTab)) return this.bookings;
    return this.bookings.filter(
      (booking) => this.uiConfig.resolveTabForRoom(booking.roomEmail) === this.activeTab,
    );
  }

  get activeTabLogo(): string | null {
    const tab = this.uiConfig.getTabs().find((entry) => entry.id === this.activeTab);
    if (!tab) return null;
    return resolveTabLogoUrl(tab, this.api.getApiBaseUrl());
  }

  get activeTabLabel(): string {
    return this.uiConfig.getTabs().find((entry) => entry.id === this.activeTab)?.label ?? '';
  }

  isLocationTab(tab: string): boolean {
    return this.uiConfig.isLocationTab(tab);
  }

  onTabChange(tab: HeaderTab): void {
    this.activeTab = tab;
    this.selectedRoom = null;
    this.selectedSlot = null;
    this.showBookingForm = false;
    this.slots = [];
  }

  async onDateChange(date: string): Promise<void> {
    this.selectedDate = date;
    this.selectedSlot = null;
    this.showBookingForm = false;
    await this.loadDashboardData();
    if (this.selectedRoom) {
      await this.syncSelectedRoomSlots();
    }
  }

  async onRefresh(): Promise<void> {
    if (this.isRefreshingDashboard) {
      this.queuedRefresh = true;
      return;
    }

    this.isRefreshingDashboard = true;
    try {
      await this.loadDashboardData();
    } finally {
      this.isRefreshingDashboard = false;
      if (this.queuedRefresh) {
        this.queuedRefresh = false;
        void this.onRefresh();
      }
    }
  }

  onRoomSelect(roomId: string): void {
    const room = this.rooms.find((item) => item.id === roomId);
    if (!room) return;
    this.selectedRoom = room;
    this.selectedSlot = null;
    this.slots = [];
    this.cdr.detectChanges();
    void this.syncSelectedRoomSlots();
  }

  onBackToRooms(): void {
    this.selectedRoom = null;
    this.selectedSlot = null;
  }

  onSlotSelect(slot: TimeSlotView): void {
    this.selectedSlot = this.roomSchedule.resolveBookableSlotClick(slot, this.bookableSlots);
    this.showBookingForm = true;
  }

  onCloseBookingForm(): void {
    this.showBookingForm = false;
    this.selectedSlot = null;
  }

  async onSubmitBooking(payload: BookingSubmitPayload): Promise<void> {
    if (!this.selectedRoom || !this.selectedSlot) return;
    if (this.isBooking) return;
    this.isBooking = true;
    const localidade = this.selectedRoom.location;
    try {
      await this.awaitWithTimeout(
        this.api.bookRoom(
          localidade,
          this.selectedRoom.email,
          payload.title,
          payload.startTime,
          payload.endTime,
          payload.requesterEmail,
          payload.participants,
          payload.allowRequesterConflict,
          payload.allowParticipantConflict,
        ),
      );
      const updatedBookings = await this.loadAllBookings(this.selectedDate);
      await this.loadAllRooms(this.selectedDate);
      await this.loadSelectedRoomSlots(localidade, this.selectedRoom, this.selectedDate, updatedBookings);
      this.showBookingForm = false;
      this.selectedSlot = null;
      this.selectedRoom = null;
      this.toast.success('Reserva criada com sucesso.');
    } catch (error) {
      const status = (error as { status?: number })?.status;
      const apiCode = (error as { error?: ApiErrorBody })?.error?.code;
      let fallback =
        status === 409
          ? 'Este horário não está mais disponível. Tente outro horário ou atualize a página.'
          : 'Erro inesperado ao reservar sala.';
      if (apiCode === 'PARTICIPANT_CONFLICT') {
        fallback =
          'A agenda de outro participante está ocupada neste horário. Escolha outro horário ou remova participantes em conflito.';
      } else if (apiCode === 'REQUESTER_CONFLICT') {
        fallback =
          'O solicitante já possui compromisso neste horário. Confirme novamente se deseja agendar.';
      } else if (apiCode === 'ROOM_CONFLICT') {
        fallback = 'A sala selecionada não está disponível neste horário. Escolha outro horário na grade.';
      }
      const message = this.toErrorMessage(error, fallback);
      this.toast.error(message);
      if (status === 409 && this.selectedRoom) {
        await this.syncSelectedRoomSlots();
      }
    } finally {
      this.isBooking = false;
    }
  }

  private async loadDashboardData(): Promise<void> {
    let firstError = '';

    try {
      await this.uiConfig.load();
      if (!this.activeTab || (!this.uiConfig.isLocationTab(this.activeTab) && this.activeTab !== this.reservasTabId)) {
        this.activeTab = this.uiConfig.getTabs()[0]?.id ?? this.reservasTabId;
      }
    } catch (error) {
      firstError = this.toErrorMessage(error, 'Erro inesperado ao carregar configuração de abas.');
    }

    try {
      await this.loadAllBookings(this.selectedDate);
    } catch (error) {
      firstError = this.toErrorMessage(error, 'Erro inesperado ao carregar reservas.');
    }

    try {
      await this.loadAllRooms(this.selectedDate);
    } catch (error) {
      if (!firstError) {
        firstError = this.toErrorMessage(error, 'Erro inesperado ao carregar salas.');
      }
    }

    if (this.selectedRoom) {
      await this.syncSelectedRoomSlots();
    }

    if (firstError) {
      this.toast.error(firstError);
    }

    this.cdr.detectChanges();
  }

  /** Carrega salas de todas as localidades da API e mescla em this.rooms */
  private async loadAllRooms(date: string): Promise<void> {
    this.isLoadingRooms = true;
    try {
      const allRooms: RoomView[] = [];
      for (const loc of this.uiConfig.getApiLocations()) {
        await this.loadRoomsWithStatus(loc, date, allRooms);
      }
      this.rooms = allRooms;
      if (this.selectedRoom) {
        this.selectedRoom = allRooms.find((room) => room.id === this.selectedRoom?.id) ?? null;
      }
    } finally {
      this.isLoadingRooms = false;
    }
  }

  /** Carrega reservas de todas as localidades e mescla em this.bookings */
  private async loadAllBookings(date: string): Promise<BookingView[]> {
    this.isLoadingBookings = true;
    try {
      const allBookings: BookingView[] = [];
      for (const loc of this.uiConfig.getApiLocations()) {
        const list = await this.loadBookings(loc, date);
        allBookings.push(...list);
      }
      this.bookings = allBookings;
      return allBookings;
    } finally {
      this.isLoadingBookings = false;
    }
  }

  private async loadBookings(localidade: string, date: string): Promise<BookingView[]> {
    const { start, end } = this.roomSchedule.buildDayRange(date);
    const response = await this.awaitWithTimeout(this.api.listBookings(localidade, start, end));
    return response.bookings.map((booking) => this.toBooking(booking));
  }

  private async loadRoomsWithStatus(localidade: string, date: string, outRooms?: RoomView[]): Promise<void> {
    const roomsResponse = await this.awaitWithTimeout(this.api.getRooms(localidade));
    const mappedRooms = roomsResponse.rooms.map((room) => this.toRoom(localidade, room));
    if (mappedRooms.length === 0) return;

    const { start, end } = this.roomSchedule.buildDayRange(date);
    const scheduleResponse = await this.awaitWithTimeout(
      this.api.checkSchedule(
        localidade,
        mappedRooms.map((room) => room.email),
        start,
        end,
      ),
    );

    const byRoom = new Map(scheduleResponse.schedule.map((entry) => [entry.roomEmail, entry]));
    const roomsWithStatus = mappedRooms.map((room) => {
      const roomSchedule = byRoom.get(room.email);
      const roomBookings = this.bookings.filter(
        (booking) => booking.roomEmail.toLowerCase() === room.email.toLowerCase(),
      );
      const occupancyPercent = this.roomSchedule.getOccupancyPercent(date, roomSchedule, roomBookings);
      return {
        ...room,
        status: occupancyPercent >= 100 ? 'occupied' : 'available',
        occupancyPercent,
      } as RoomView;
    });

    if (outRooms) {
      outRooms.push(...roomsWithStatus);
    } else {
      this.rooms = roomsWithStatus;
      if (this.selectedRoom) {
        this.selectedRoom = roomsWithStatus.find((room) => room.id === this.selectedRoom?.id) ?? null;
      }
    }
  }

  private async loadSelectedRoomSlots(
    localidade: string,
    room: RoomView,
    date: string,
    currentBookings: BookingView[],
  ): Promise<void> {
    this.isLoadingSlots = true;
    this.slots = [];
    this.cdr.detectChanges();
    try {
      const { start, end } = this.roomSchedule.buildDayRange(date);
      const response = await this.awaitWithTimeout(this.api.checkSchedule(localidade, [room.email], start, end));
      const firstSchedule = response.schedule[0];
      const roomBookings = currentBookings.filter((booking) => booking.roomEmail === room.email);
      const updatedSlots = this.roomSchedule.buildTimeSlots(date, firstSchedule?.scheduleItems ?? [], roomBookings);
      this.slots = updatedSlots;
      if (this.selectedSlot) {
        this.selectedSlot =
          updatedSlots.find(
            (slot) => slot.startTime === this.selectedSlot?.startTime && slot.endTime === this.selectedSlot?.endTime,
          ) ?? null;
      }
      this.cdr.detectChanges();
    } finally {
      this.isLoadingSlots = false;
      this.cdr.detectChanges();
    }
  }

  async syncSelectedRoomSlots(): Promise<void> {
    if (!this.selectedRoom) {
      this.slots = [];
      return;
    }
    try {
      await this.loadSelectedRoomSlots(this.selectedRoom.location, this.selectedRoom, this.selectedDate, this.bookings);
    } catch (error) {
      const msg = this.toErrorMessage(error, 'Erro inesperado ao consultar agenda da sala.');
      this.toast.error(msg);
    }
  }

  private toRoom(localidade: string, room: RoomDto): RoomView {
    return {
      id: room.email,
      name: room.name,
      email: room.email,
      capacity: room.capacity ?? 0,
      location: localidade,
      status: 'available',
      occupancyPercent: 0,
    };
  }

  private toBooking(booking: BookingDto): BookingView {
    return {
      eventId: booking.eventId,
      roomEmail: booking.roomEmail,
      roomName: booking.roomName,
      title: booking.title,
      startTime: booking.start,
      endTime: booking.end,
      organizer: booking.organizer,
      requiresCheckIn: booking.requiresCheckIn,
      checkedIn: booking.checkedIn,
      source: booking.source,
    };
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    const err = error as { error?: ApiErrorBody | string; message?: string } | null;
    if (!err) return fallback;
    const body = err.error;
    if (body != null) {
      const msg = typeof body === 'string' ? body : (body as ApiErrorBody).message;
      if (msg?.trim()) return msg.trim();
    }
    if (err.message?.trim()) return err.message.trim();
    return fallback;
  }

  private awaitWithTimeout<T>(source: Observable<T>): Promise<T> {
    return firstValueFrom(source.pipe(timeout({ first: 20000 })));
  }
}
