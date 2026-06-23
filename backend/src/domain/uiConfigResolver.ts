import { UiConfig, UiTabConfig } from "./entities/UiConfig";
import { Localidade } from "./entities/Tenant";

export const DEFAULT_DOMAIN_TO_API_LOCALIDADE: Record<string, Localidade> = {
  "nubankparque.com.br": "Allianz",
  "allianzparque.com.br": "Allianz",
  "basecoworking.space": "Allianz",
  "bravolive.com.br": "Allianz",
  "novoanhangabau.com.br": "Allianz",
  "wtentretenimento.com.br": "Allianz",
  "wtorre.com.br": "WTorre",
  "sendcooliving.com.br": "WTorre",
  "waltertorre.com.br": "WTorre",
};

export const DEFAULT_UI_CONFIG: UiConfig = {
  tabs: [
    {
      id: "nubankparque",
      label: "Nubank Parque",
      domains: ["nubankparque.com.br", "allianzparque.com.br"],
      logoKey: "nubankparque",
    },
    {
      id: "wtorre",
      label: "Wtorre",
      domains: ["wtorre.com.br"],
      logoKey: "wtorre",
    },
    {
      id: "novoanhangabau",
      label: "Novo Anhangabau",
      domains: ["novoanhangabau.com.br"],
      logoKey: "novoanhangabau",
    },
  ],
  domainToApiLocalidade: { ...DEFAULT_DOMAIN_TO_API_LOCALIDADE },
  roomTabOverrides: {},
  roomOrderByTab: {},
};

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

export function extractEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

export function normalizeUiConfig(input: Partial<UiConfig> | null | undefined): UiConfig {
  const tabs = (input?.tabs ?? DEFAULT_UI_CONFIG.tabs).map((tab) => normalizeTab(tab));
  const domainToApiLocalidade = normalizeDomainMap(
    input?.domainToApiLocalidade ?? DEFAULT_UI_CONFIG.domainToApiLocalidade,
  );
  const roomTabOverrides = normalizeOverrides(input?.roomTabOverrides ?? {});
  const roomOrderByTab = normalizeRoomOrderByTab(input?.roomOrderByTab ?? {}, tabs);

  return {
    tabs,
    domainToApiLocalidade,
    roomTabOverrides,
    roomOrderByTab,
  };
}

function normalizeRoomOrderByTab(
  map: Record<string, string[]>,
  tabs: UiTabConfig[],
): Record<string, string[]> {
  const tabIds = new Set(tabs.map((tab) => tab.id));
  const normalized: Record<string, string[]> = {};
  for (const [tabId, emails] of Object.entries(map)) {
    const key = tabId.trim().toLowerCase();
    if (!tabIds.has(key)) continue;
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const email of emails) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail.includes("@") || seen.has(normalizedEmail)) continue;
      seen.add(normalizedEmail);
      ordered.push(normalizedEmail);
    }
    normalized[key] = ordered;
  }
  return normalized;
}

function normalizeTab(tab: UiTabConfig): UiTabConfig {
  const logoFileRaw = tab.logoFile?.trim();
  return {
    id: tab.id.trim().toLowerCase(),
    label: tab.label.trim(),
    domains: Array.from(new Set(tab.domains.map(normalizeDomain).filter(Boolean))),
    logoKey: tab.logoKey.trim().toLowerCase() || tab.id.trim().toLowerCase(),
    logoFile: logoFileRaw ? logoFileRaw : null,
  };
}

function normalizeDomainMap(map: Record<string, Localidade>): Record<string, Localidade> {
  const normalized: Record<string, Localidade> = {};
  for (const [domain, localidade] of Object.entries(map)) {
    const key = normalizeDomain(domain);
    if (!key) continue;
    normalized[key] = localidade;
  }
  return normalized;
}

function normalizeOverrides(map: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [email, tabId] of Object.entries(map)) {
    const key = email.trim().toLowerCase();
    const value = tabId.trim().toLowerCase();
    if (!key.includes("@") || !value) continue;
    normalized[key] = value;
  }
  return normalized;
}

export function resolveApiLocalidade(emailOrDomain: string, config: UiConfig): Localidade | null {
  const domain = emailOrDomain.includes("@")
    ? extractEmailDomain(emailOrDomain)
    : normalizeDomain(emailOrDomain);
  if (!domain) return null;
  return config.domainToApiLocalidade[domain] ?? null;
}

export function getDomainsForApiLocalidade(config: UiConfig, localidade: string): string[] {
  const key = localidade.trim().toLowerCase();
  return Object.entries(config.domainToApiLocalidade)
    .filter(([, value]) => value.trim().toLowerCase() === key)
    .map(([domain]) => domain);
}

export function belongsToApiLocalidade(
  email: string,
  localidade: string,
  config: UiConfig,
): boolean {
  const allowed = getDomainsForApiLocalidade(config, localidade);
  if (allowed.length === 0) return true;
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return allowed.includes(domain);
}

export function resolveRoomTab(
  email: string,
  config: UiConfig,
): { tabId: string | null; source: "override" | "domain" | "unassigned" } {
  const normalizedEmail = email.trim().toLowerCase();
  const override = config.roomTabOverrides[normalizedEmail];
  if (override) {
    const tabExists = config.tabs.some((tab) => tab.id === override);
    return { tabId: tabExists ? override : null, source: "override" };
  }

  const domain = extractEmailDomain(normalizedEmail);
  if (!domain) return { tabId: null, source: "unassigned" };

  const tab = config.tabs.find((entry) => entry.domains.includes(domain));
  if (!tab) return { tabId: null, source: "unassigned" };
  return { tabId: tab.id, source: "domain" };
}

export function getApiLocations(config: UiConfig): Localidade[] {
  return Array.from(new Set(Object.values(config.domainToApiLocalidade)));
}

export interface RoomWithEmail {
  email: string;
}

export function sortRoomsByTabOrder<T extends RoomWithEmail>(
  rooms: T[],
  tabId: string,
  config: UiConfig,
): T[] {
  const order = config.roomOrderByTab[tabId.trim().toLowerCase()];
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
