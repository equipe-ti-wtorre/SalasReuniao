import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RESERVAS_TAB_ID } from '../../models/ui-config.models';
import { UiConfigService } from '../../services/ui-config.service';

export type HeaderTab = string;

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  @Input() activeTab: HeaderTab = '';
  @Output() tabChange = new EventEmitter<HeaderTab>();
  @Output() refresh = new EventEmitter<void>();

  readonly reservasTabId = RESERVAS_TAB_ID;

  constructor(readonly uiConfig: UiConfigService) {}

  onTabClick(tab: HeaderTab): void {
    this.tabChange.emit(tab);
  }
}
