import { Localidade } from "./Tenant";

export interface UiTabConfig {
  id: string;
  label: string;
  domains: string[];
  logoKey: string;
  logoFile?: string | null;
}

export interface UiConfig {
  tabs: UiTabConfig[];
  domainToApiLocalidade: Record<string, Localidade>;
  roomTabOverrides: Record<string, string>;
  roomOrderByTab: Record<string, string[]>;
}

export interface AdminRoomView {
  name: string;
  email: string;
  apiLocalidade: Localidade;
  tabId: string | null;
  tabSource: "override" | "domain" | "unassigned";
}
