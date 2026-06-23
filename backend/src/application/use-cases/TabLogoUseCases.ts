import fs from "node:fs/promises";
import path from "node:path";
import { UiConfigRepository } from "../../domain/contracts/UiConfigRepository";
import { UiConfig } from "../../domain/entities/UiConfig";
import { AppError } from "../errors/AppError";

const ALLOWED_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/svg+xml",
  "image/png",
  "image/jpeg",
]);

export class TabLogoUseCases {
  private readonly logosDir: string;

  constructor(
    private readonly uiConfigRepository: UiConfigRepository,
    logosDir?: string,
  ) {
    this.logosDir = logosDir ?? path.join(process.cwd(), "data", "logos");
  }

  async upload(tabId: string, file: Express.Multer.File): Promise<UiConfig> {
    const normalizedTabId = tabId.trim().toLowerCase();
    const config = await this.uiConfigRepository.get();
    const tab = config.tabs.find((entry) => entry.id === normalizedTabId);
    if (!tab) {
      throw new AppError("TAB_NOT_FOUND", `Aba não encontrada: ${tabId}`, 404);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new AppError(
        "INVALID_LOGO_FILE",
        "Formato inválido. Use SVG, PNG ou JPEG.",
        400,
      );
    }

    const filename = `${normalizedTabId}${ext}`;
    await fs.mkdir(this.logosDir, { recursive: true });
    await fs.writeFile(path.join(this.logosDir, filename), file.buffer);

    if (tab.logoFile && tab.logoFile !== filename) {
      await this.removeLogoFile(tab.logoFile);
    }

    const updatedTabs = config.tabs.map((entry) =>
      entry.id === normalizedTabId ? { ...entry, logoFile: filename } : entry,
    );
    const updated: UiConfig = { ...config, tabs: updatedTabs };
    await this.uiConfigRepository.save(updated);
    return this.uiConfigRepository.get();
  }

  async delete(tabId: string): Promise<UiConfig> {
    const normalizedTabId = tabId.trim().toLowerCase();
    const config = await this.uiConfigRepository.get();
    const tab = config.tabs.find((entry) => entry.id === normalizedTabId);
    if (!tab) {
      throw new AppError("TAB_NOT_FOUND", `Aba não encontrada: ${tabId}`, 404);
    }

    if (tab.logoFile) {
      await this.removeLogoFile(tab.logoFile);
    }

    const updatedTabs = config.tabs.map((entry) =>
      entry.id === normalizedTabId ? { ...entry, logoFile: null } : entry,
    );
    const updated: UiConfig = { ...config, tabs: updatedTabs };
    await this.uiConfigRepository.save(updated);
    return this.uiConfigRepository.get();
  }

  private async removeLogoFile(filename: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.logosDir, filename));
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException | null)?.code;
      if (code !== "ENOENT") throw error;
    }
  }
}
