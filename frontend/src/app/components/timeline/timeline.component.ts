import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TimeSlotView } from '../../models/ui.models';
import { RoomScheduleService } from '../../services/room-schedule.service';

export interface DisplaySlot extends TimeSlotView {
  span: number;
  displayTime: string;
}

export interface PeriodGroup {
  label: string;
  slots: DisplaySlot[];
}

@Component({
  selector: 'app-timeline',
  standalone: true,
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss',
})
export class TimelineComponent implements OnInit, OnDestroy {
  @Input({ required: true }) slots: TimeSlotView[] = [];
  /** Se definido, só estes slots (e o estado occupied) determinam clique; a grelha usa sempre `slots`. */
  @Input() bookableSlots: TimeSlotView[] | null = null;
  /** Dia exibido (yyyy-mm-dd, fuso Brasília). Usado para marcar horários já passados. */
  @Input() scheduleDate: string | null = null;
  @Input() selectedSlot: TimeSlotView | null = null;
  @Input() filterOnlyAvailable = false;
  @Output() slotSelect = new EventEmitter<TimeSlotView>();

  columns = 6;
  private pastRefreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private readonly schedule: RoomScheduleService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.updateColumns(window.innerWidth);
      this.pastRefreshTimer = setInterval(() => this.cdr.markForCheck(), 60_000);
    }
  }

  ngOnDestroy(): void {
    if (this.pastRefreshTimer) {
      clearInterval(this.pastRefreshTimer);
      this.pastRefreshTimer = null;
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (isPlatformBrowser(this.platformId)) {
      this.updateColumns(event.target.innerWidth);
    }
  }

  private updateColumns(width: number) {
    if (width <= 480) {
      this.columns = 2;
    } else if (width <= 768) {
      this.columns = 3;
    } else {
      this.columns = 6;
    }
  }

  /** Agrupa slots por período: Madrugada 00:00-06:00, Manhã 06:00-12:00, Tarde 12:00-18:00, Noite 18:00-24:00 */
  get slotsByPeriod(): PeriodGroup[] {
    const madrugada: TimeSlotView[] = [];
    const manha: TimeSlotView[] = [];
    const tarde: TimeSlotView[] = [];
    const noite: TimeSlotView[] = [];
    for (const slot of this.slots) {
      if (this.filterOnlyAvailable && slot.status === 'occupied') continue;
      if (slot.startMinute < 360) madrugada.push(slot);
      else if (slot.startMinute < 720) manha.push(slot);
      else if (slot.startMinute < 1080) tarde.push(slot);
      else noite.push(slot);
    }
    const result: PeriodGroup[] = [];
    if (madrugada.length) result.push({ label: 'Madrugada (00:00 - 06:00)', slots: this.groupSlots(madrugada) });
    if (manha.length) result.push({ label: 'Manhã (06:00 - 12:00)', slots: this.groupSlots(manha) });
    if (tarde.length) result.push({ label: 'Tarde (12:00 - 18:00)', slots: this.groupSlots(tarde) });
    if (noite.length) result.push({ label: 'Noite (18:00 - 23:59)', slots: this.groupSlots(noite) });
    return result;
  }

  private groupSlots(slots: TimeSlotView[]): DisplaySlot[] {
    if (!slots.length) return [];

    const displaySlots: DisplaySlot[] = [];
    let currentGroup: DisplaySlot | null = null;
    let columnInRow = 0;

    const flushGroup = (): void => {
      if (!currentGroup) return;
      this.finalizeGroupDisplayTime(currentGroup);
      const remaining = this.columns - columnInRow;
      if (currentGroup.span > remaining) {
        currentGroup.span = remaining;
      }
      displaySlots.push(currentGroup);
      columnInRow += currentGroup.span;
      if (columnInRow >= this.columns) {
        columnInRow = 0;
      }
      currentGroup = null;
    };

    for (const slot of slots) {
      if (!currentGroup) {
        if (columnInRow >= this.columns) {
          columnInRow = 0;
        }
        currentGroup = { ...slot, span: 1, displayTime: slot.time };
        continue;
      }

      const isContiguous = currentGroup.endMinute === slot.startMinute;
      const isBothOccupied = currentGroup.status === 'occupied' && slot.status === 'occupied';
      const isSameBooker = currentGroup.bookedBy === slot.bookedBy && !!currentGroup.bookedBy;
      const remainingInRow = this.columns - columnInRow;
      const canExpandInRow = currentGroup.span < remainingInRow;

      if (isContiguous && isBothOccupied && isSameBooker && canExpandInRow) {
        currentGroup.endMinute = slot.endMinute;
        currentGroup.endTime = slot.endTime;
        currentGroup.span += 1;
      } else {
        flushGroup();
        if (columnInRow >= this.columns) {
          columnInRow = 0;
        }
        currentGroup = { ...slot, span: 1, displayTime: slot.time };
      }
    }

    flushGroup();
    return displaySlots;
  }

  private finalizeGroupDisplayTime(group: DisplaySlot): void {
    if (group.span > 1) {
       group.displayTime = `${group.time} - ${this.formatMinutes(group.endMinute)}`;
    }
  }

  private formatMinutes(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  isPastSlot(slot: TimeSlotView): boolean {
    return this.schedule.isSlotPast(slot, this.effectiveScheduleDate);
  }

  getSlotClass(slot: TimeSlotView): string {
    const classes = ['time-slot'];
    if (this.isPastSlot(slot)) {
      classes.push('past');
    } else if (slot.status === 'occupied') {
      classes.push('unavailable');
    } else {
      classes.push('available');
    }
    if (this.selectedSlot && this.isSameSlotSelection(slot, this.selectedSlot)) {
      classes.push('selected');
    }
    return classes.join(' ');
  }

  private get effectiveScheduleDate(): string {
    if (this.scheduleDate?.trim()) return this.scheduleDate.trim();
    const fromSlot = this.slots[0]?.startTime?.slice(0, 10);
    return fromSlot || this.schedule.todayBrazil();
  }

  private isSameSlotSelection(gridSlot: TimeSlotView, selected: TimeSlotView): boolean {
    if (gridSlot.startTime === selected.startTime) return true;
    const gridBlock = Math.floor(gridSlot.startMinute / 30) * 30;
    const selectedBlock = Math.floor(selected.startMinute / 30) * 30;
    return gridBlock === selectedBlock;
  }

  isSlotDisabled(slot: TimeSlotView): boolean {
    if (this.isPastSlot(slot)) return true;
    if (slot.status === 'occupied') return true;
    if (!this.bookableSlots?.length) return false;
    return !this.isBookable(slot);
  }

  onSlotClick(slot: TimeSlotView): void {
    if (this.isSlotDisabled(slot)) return;
    this.slotSelect.emit(slot);
  }

  private isBookable(slot: TimeSlotView): boolean {
    if (!this.bookableSlots?.length) return true;
    const blockStart = Math.floor(slot.startMinute / 30) * 30;
    return this.bookableSlots.some((bookable) => {
      const bookableBlock = Math.floor(bookable.startMinute / 30) * 30;
      if (bookableBlock !== blockStart) return false;
      return bookable.startTime === slot.startTime || bookable.startMinute !== bookableBlock;
    });
  }

  getSlotDurationLabel(slot: TimeSlotView): string {
    const minutes = slot.endMinute - slot.startMinute;
    if (minutes <= 0 || minutes === 30) {
      return '30 min';
    }
    return `${minutes} min`;
  }
}
