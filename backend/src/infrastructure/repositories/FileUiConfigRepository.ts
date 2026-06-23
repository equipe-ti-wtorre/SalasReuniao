import fs from "node:fs/promises";
import path from "node:path";
import { UiConfigRepository } from "../../domain/contracts/UiConfigRepository";
import { UiConfig } from "../../domain/entities/UiConfig";
import { normalizeUiConfig } from "../../domain/uiConfigResolver";

export class FileUiConfigRepository implements UiConfigRepository {
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? path.join(process.cwd(), "data", "ui-config.json");
  }

  async get(): Promise<UiConfig> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<UiConfig>;
      return normalizeUiConfig(parsed);
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException | null)?.code;
      if (code === "ENOENT") {
        return normalizeUiConfig(undefined);
      }
      throw error;
    }
  }

  async save(config: UiConfig): Promise<void> {
    const normalized = normalizeUiConfig(config);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(normalized, null, 2), "utf-8");
  }
}
