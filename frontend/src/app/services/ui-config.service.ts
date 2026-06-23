import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { UiConfig } from '../models/ui-config.models';
import { getApiLocations, resolveRoomTab } from '../utils/ui-config-resolver';
import { RoomsApiService } from './rooms-api.service';

@Injectable({ providedIn: 'root' })
export class UiConfigService {
  private readonly configSubject = new BehaviorSubject<UiConfig | null>(null);

  readonly config$ = this.configSubject.asObservable();

  constructor(private readonly api: RoomsApiService) {}

  get config(): UiConfig | null {
    return this.configSubject.value;
  }

  async load(): Promise<UiConfig> {
    const response = await firstValueFrom(this.api.getUiConfig());
    this.configSubject.next(response.config);
    return response.config;
  }

  setConfig(config: UiConfig): void {
    this.configSubject.next(config);
  }

  getTabs(): UiConfig['tabs'] {
    return this.config?.tabs ?? [];
  }

  getApiLocations(): string[] {
    if (!this.config) return ['Allianz', 'WTorre'];
    return getApiLocations(this.config);
  }

  resolveTabForRoom(email: string): string | null {
    if (!this.config) return null;
    return resolveRoomTab(email, this.config).tabId;
  }

  isLocationTab(tabId: string): boolean {
    return tabId !== 'reservas' && this.getTabs().some((tab) => tab.id === tabId);
  }
}
