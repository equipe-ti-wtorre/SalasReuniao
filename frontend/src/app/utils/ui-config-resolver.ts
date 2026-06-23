import { TAB_LOGO_ASSETS, UiConfig, UiTabConfig } from '../models/ui-config.models';

export function extractEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

export function resolveRoomTab(
  email: string,
  config: UiConfig,
): { tabId: string | null; source: 'override' | 'domain' | 'unassigned' } {
  const normalizedEmail = email.trim().toLowerCase();
  const override = config.roomTabOverrides[normalizedEmail];
  if (override) {
    const tabExists = config.tabs.some((tab) => tab.id === override);
    return { tabId: tabExists ? override : null, source: 'override' };
  }

  const domain = extractEmailDomain(normalizedEmail);
  if (!domain) return { tabId: null, source: 'unassigned' };

  const tab = config.tabs.find((entry) => entry.domains.includes(domain));
  if (!tab) return { tabId: null, source: 'unassigned' };
  return { tabId: tab.id, source: 'domain' };
}

export function getApiLocations(config: UiConfig): string[] {
  return Array.from(new Set(Object.values(config.domainToApiLocalidade)));
}

export function resolveApiLocalidade(emailOrDomain: string, config: UiConfig): string | null {
  const domain = emailOrDomain.includes('@')
    ? extractEmailDomain(emailOrDomain)
    : emailOrDomain.trim().toLowerCase();
  if (!domain) return null;
  return config.domainToApiLocalidade[domain] ?? null;
}

export interface RoomWithEmail {
  email: string;
}

export function sortRoomsByTabOrder<T extends RoomWithEmail>(
  rooms: T[],
  tabId: string,
  config: UiConfig,
): T[] {
  const order = config.roomOrderByTab?.[tabId.trim().toLowerCase()];
  if (!order?.length) return rooms;

  const indexByEmail = new Map(order.map((email, index) => [email, index]));
  return [...rooms].sort((a, b) => {
    const aIndex = indexByEmail.get(a.email.trim().toLowerCase());
    const bIndex = indexByEmail.get(b.email.trim().toLowerCase());
    if (aIndex === undefined && bIndex === undefined) return 0;
    if (aIndex === undefined) return 1;
    if (bIndex === undefined) return -1;
    return aIndex - bIndex;
  });
}

export function resolveTabLogoUrl(tab: UiTabConfig, apiBaseUrl: string): string | null {
  if (tab.logoFile) {
    const base = apiBaseUrl.replace(/\/$/, '');
    return `${base}/logos/${tab.logoFile}`;
  }
  return TAB_LOGO_ASSETS[tab.logoKey] ?? TAB_LOGO_ASSETS[tab.id] ?? null;
}
