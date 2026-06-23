import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminRoomView,
  BUILTIN_LOGO_OPTIONS,
  UiConfig,
  UiTabConfig,
} from '../../models/ui-config.models';
import { RoomsApiService } from '../../services/rooms-api.service';
import { UiConfigService } from '../../services/ui-config.service';
import { extractEmailDomain, resolveTabLogoUrl } from '../../utils/ui-config-resolver';

const ADMIN_KEY_STORAGE = 'salas-admin-key';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  adminKey = '';
  pinInput = '';
  pinError = '';
  isAuthenticated = false;

  config: UiConfig | null = null;
  rooms: AdminRoomView[] = [];
  domainInputs: Record<string, string> = {};
  isLoading = false;
  isSaving = false;
  saveMessage = '';
  saveError = '';
  logoUploadingTabId = '';
  logoError = '';

  readonly apiLocalidadeOptions = ['Allianz', 'WTorre'];
  readonly builtinLogoOptions = BUILTIN_LOGO_OPTIONS;

  constructor(
    private readonly api: RoomsApiService,
    private readonly uiConfig: UiConfigService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const stored = sessionStorage.getItem(ADMIN_KEY_STORAGE)?.trim();
    if (stored) {
      this.adminKey = stored;
      void this.bootstrapAdmin().catch(() => {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        this.adminKey = '';
        this.cdr.markForCheck();
      });
    }
  }

  async onPinSubmit(): Promise<void> {
    this.pinError = '';
    const key = this.pinInput.trim();
    if (!key) {
      this.pinError = 'Informe a chave de administração.';
      return;
    }
    this.adminKey = key;
    try {
      await this.bootstrapAdmin();
      sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
      this.isAuthenticated = true;
    } catch {
      this.adminKey = '';
      sessionStorage.removeItem(ADMIN_KEY_STORAGE);
      this.pinError = 'Chave inválida ou administração não configurada no servidor.';
    } finally {
      this.cdr.markForCheck();
    }
  }

  logout(): void {
    this.isAuthenticated = false;
    this.adminKey = '';
    this.pinInput = '';
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
  }

  private async bootstrapAdmin(): Promise<void> {
    this.isLoading = true;
    try {
      const [configResponse, roomsResponse] = await Promise.all([
        firstValueFrom(this.api.getUiConfig()),
        firstValueFrom(this.api.getAdminRooms(this.adminKey)),
      ]);
      this.config = this.normalizeConfig(configResponse.config);
      this.rooms = roomsResponse.rooms;
      this.syncDomainInputs();
      this.syncRoomOrders();
      this.isAuthenticated = true;
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  private normalizeConfig(config: UiConfig): UiConfig {
    return {
      ...config,
      roomOrderByTab: config.roomOrderByTab ?? {},
      tabs: config.tabs.map((tab) => ({
        ...tab,
        logoFile: tab.logoFile ?? null,
      })),
    };
  }

  private syncDomainInputs(): void {
    if (!this.config) return;
    const inputs: Record<string, string> = {};
    for (const tab of this.config.tabs) {
      inputs[tab.id] = '';
    }
    this.domainInputs = inputs;
  }

  addDomain(tab: UiTabConfig): void {
    if (!this.config) return;
    const domain = (this.domainInputs[tab.id] ?? '').trim().toLowerCase();
    if (!domain || domain.includes(' ')) return;
    if (!tab.domains.includes(domain)) {
      tab.domains = [...tab.domains, domain];
      if (!this.config.domainToApiLocalidade[domain]) {
        this.config.domainToApiLocalidade[domain] = 'Allianz';
      }
    }
    this.domainInputs[tab.id] = '';
  }

  removeDomain(tab: UiTabConfig, domain: string): void {
    tab.domains = tab.domains.filter((entry) => entry !== domain);
  }

  getDomainMappings(): { domain: string; apiLocalidade: string }[] {
    if (!this.config) return [];
    return Object.entries(this.config.domainToApiLocalidade)
      .map(([domain, apiLocalidade]) => ({ domain, apiLocalidade }))
      .sort((a, b) => a.domain.localeCompare(b.domain));
  }

  getTabLogoUrl(tab: UiTabConfig): string | null {
    return resolveTabLogoUrl(tab, this.api.getApiBaseUrl());
  }

  async onLogoSelected(tab: UiTabConfig, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.adminKey) return;

    this.logoError = '';
    this.logoUploadingTabId = tab.id;
    this.cdr.markForCheck();
    try {
      const response = await firstValueFrom(this.api.uploadTabLogo(tab.id, file, this.adminKey));
      this.config = this.normalizeConfig(response.config);
      this.uiConfig.setConfig(response.config);
      this.saveMessage = `Logo da aba "${tab.label}" atualizado.`;
    } catch (error) {
      const message = (error as { error?: { message?: string } })?.error?.message;
      this.logoError = message?.trim() || 'Falha ao enviar logo.';
    } finally {
      this.logoUploadingTabId = '';
      this.cdr.markForCheck();
    }
  }

  async removeCustomLogo(tab: UiTabConfig): Promise<void> {
    if (!this.adminKey || !tab.logoFile) return;

    this.logoError = '';
    this.logoUploadingTabId = tab.id;
    this.cdr.markForCheck();
    try {
      const response = await firstValueFrom(this.api.deleteTabLogo(tab.id, this.adminKey));
      this.config = this.normalizeConfig(response.config);
      this.uiConfig.setConfig(response.config);
      this.saveMessage = `Logo customizado da aba "${tab.label}" removido.`;
    } catch (error) {
      const message = (error as { error?: { message?: string } })?.error?.message;
      this.logoError = message?.trim() || 'Falha ao remover logo.';
    } finally {
      this.logoUploadingTabId = '';
      this.cdr.markForCheck();
    }
  }

  setRoomTab(email: string, tabId: string): void {
    if (!this.config) return;
    const normalized = email.trim().toLowerCase();
    if (!tabId) {
      delete this.config.roomTabOverrides[normalized];
    } else {
      this.config.roomTabOverrides[normalized] = tabId;
    }
    this.refreshRoomAssignments();
    this.syncRoomOrders();
  }

  clearRoomOverride(email: string): void {
    if (!this.config) return;
    delete this.config.roomTabOverrides[email.trim().toLowerCase()];
    this.refreshRoomAssignments();
    this.syncRoomOrders();
  }

  private refreshRoomAssignments(): void {
    if (!this.config) return;
    this.rooms = this.rooms.map((room) => {
      const override = this.config!.roomTabOverrides[room.email];
      if (override) {
        return { ...room, tabId: override, tabSource: 'override' as const };
      }
      const domain = extractEmailDomain(room.email);
      const tab = domain ? this.config!.tabs.find((entry) => entry.domains.includes(domain)) : undefined;
      return {
        ...room,
        tabId: tab?.id ?? null,
        tabSource: tab ? ('domain' as const) : ('unassigned' as const),
      };
    });
  }

  getOrderedRoomsForTab(tabId: string): AdminRoomView[] {
    if (!this.config) return [];
    const order = this.config.roomOrderByTab[tabId] ?? [];
    const tabRooms = this.rooms.filter((room) => room.tabId === tabId);
    const byEmail = new Map(tabRooms.map((room) => [room.email, room]));
    const ordered: AdminRoomView[] = [];
    for (const email of order) {
      const room = byEmail.get(email);
      if (room) {
        ordered.push(room);
        byEmail.delete(email);
      }
    }
    for (const room of byEmail.values()) {
      ordered.push(room);
    }
    return ordered;
  }

  moveRoom(tabId: string, email: string, direction: -1 | 1): void {
    if (!this.config) return;
    const order = [...(this.config.roomOrderByTab[tabId] ?? this.getOrderedRoomsForTab(tabId).map((r) => r.email))];
    const index = order.indexOf(email);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    this.config.roomOrderByTab[tabId] = order;
  }

  private syncRoomOrders(): void {
    if (!this.config) return;
    const next: Record<string, string[]> = { ...this.config.roomOrderByTab };
    for (const tab of this.config.tabs) {
      const tabRooms = this.rooms.filter((room) => room.tabId === tab.id);
      const tabEmails = new Set(tabRooms.map((room) => room.email));
      const existing = (next[tab.id] ?? []).filter((email) => tabEmails.has(email));
      for (const room of tabRooms) {
        if (!existing.includes(room.email)) {
          existing.push(room.email);
        }
      }
      next[tab.id] = existing;
    }
    this.config.roomOrderByTab = next;
  }

  async save(): Promise<void> {
    if (!this.config || !this.adminKey) return;
    this.isSaving = true;
    this.saveMessage = '';
    this.saveError = '';
    try {
      const response = await firstValueFrom(this.api.saveUiConfig(this.config, this.adminKey));
      this.config = this.normalizeConfig(response.config);
      this.uiConfig.setConfig(response.config);
      this.saveMessage = 'Configuração salva com sucesso.';
      await this.bootstrapAdmin();
    } catch (error) {
      const message = (error as { error?: { message?: string } })?.error?.message;
      this.saveError = message?.trim() || 'Falha ao salvar configuração.';
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }
}
