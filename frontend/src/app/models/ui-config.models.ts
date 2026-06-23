export interface UiTabConfig {
  id: string;
  label: string;
  domains: string[];
  logoKey: string;
  logoFile?: string | null;
}

export interface UiConfig {
  tabs: UiTabConfig[];
  domainToApiLocalidade: Record<string, string>;
  roomTabOverrides: Record<string, string>;
  roomOrderByTab: Record<string, string[]>;
}

export interface AdminRoomView {
  name: string;
  email: string;
  apiLocalidade: string;
  tabId: string | null;
  tabSource: 'override' | 'domain' | 'unassigned';
}

export const RESERVAS_TAB_ID = 'reservas';

export const TAB_LOGO_ASSETS: Record<string, string> = {
  nubankparque: 'assets/logos/allianz-parque.svg',
  allianzparque: 'assets/logos/allianz-parque.svg',
  wtorre: 'assets/logos/wtorre.svg',
  novoanhangabau: 'assets/logos/novo-anhangabau.svg',
};

export const BUILTIN_LOGO_OPTIONS = [
  { key: 'nubankparque', label: 'Allianz Parque' },
  { key: 'allianzparque', label: 'Allianz Parque (alt)' },
  { key: 'wtorre', label: 'WTorre' },
  { key: 'novoanhangabau', label: 'Novo Anhangabaú' },
];
