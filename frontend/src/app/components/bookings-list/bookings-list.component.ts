import { DatePipe } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { BookingView } from '../../models/ui.models';
import { RoomScheduleService } from '../../services/room-schedule.service';

@Component({
  selector: 'app-bookings-list',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './bookings-list.component.html',
  styleUrl: './bookings-list.component.scss',
})
export class BookingsListComponent {
  private readonly schedule = inject(RoomScheduleService);

  @Input({ required: true }) bookings: BookingView[] = [];
  @Input() hideHeader = false;

  organizerLabel(booking: BookingView): string {
    const raw = booking.organizer?.trim();
    if (!raw) return '';
    return this.schedule.formatPersonDisplayName(raw) ?? raw;
  }
}
