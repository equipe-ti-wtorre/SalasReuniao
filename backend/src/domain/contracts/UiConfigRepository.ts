import { UiConfig } from "../entities/UiConfig";

export interface UiConfigRepository {
  get(): Promise<UiConfig>;
  save(config: UiConfig): Promise<void>;
}
