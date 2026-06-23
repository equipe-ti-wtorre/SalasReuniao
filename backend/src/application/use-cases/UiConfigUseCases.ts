import { z } from "zod";
import { UiConfigRepository } from "../../domain/contracts/UiConfigRepository";
import { UiConfig } from "../../domain/entities/UiConfig";
import { normalizeUiConfig } from "../../domain/uiConfigResolver";

export class GetUiConfigUseCase {
  constructor(private readonly uiConfigRepository: UiConfigRepository) {}

  async execute(): Promise<UiConfig> {
    return this.uiConfigRepository.get();
  }
}

const tabSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  domains: z.array(z.string().trim().min(1)),
  logoKey: z.string().trim().min(1),
  logoFile: z.string().trim().min(1).nullable().optional(),
});

const uiConfigSchema = z
  .object({
    tabs: z.array(tabSchema).min(1),
    domainToApiLocalidade: z.record(z.string(), z.string().trim().min(1)),
    roomTabOverrides: z.record(z.string(), z.string()),
    roomOrderByTab: z.record(z.string(), z.array(z.string())).optional(),
  })
  .superRefine((value, ctx) => {
    const tabIds = new Set(value.tabs.map((tab) => tab.id.trim().toLowerCase()));
    if (tabIds.size !== value.tabs.length) {
      ctx.addIssue({ code: "custom", message: "IDs de aba devem ser únicos." });
    }
    for (const tabId of Object.values(value.roomTabOverrides)) {
      if (!tabIds.has(tabId.trim().toLowerCase())) {
        ctx.addIssue({
          code: "custom",
          message: `Override aponta para aba inexistente: ${tabId}`,
        });
        break;
      }
    }
    for (const [tabId, emails] of Object.entries(value.roomOrderByTab ?? {})) {
      if (!tabIds.has(tabId.trim().toLowerCase())) {
        ctx.addIssue({
          code: "custom",
          message: `Ordem de salas aponta para aba inexistente: ${tabId}`,
        });
        break;
      }
      for (const email of emails) {
        if (!email.trim().includes("@")) {
          ctx.addIssue({
            code: "custom",
            message: `E-mail inválido na ordem de salas: ${email}`,
          });
          break;
        }
      }
    }
  });

export class SaveUiConfigUseCase {
  constructor(private readonly uiConfigRepository: UiConfigRepository) {}

  async execute(input: unknown): Promise<UiConfig> {
    const parsed = uiConfigSchema.parse(input);
    const normalized = normalizeUiConfig({
      tabs: parsed.tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        domains: tab.domains,
        logoKey: tab.logoKey,
        logoFile: tab.logoFile ?? null,
      })),
      domainToApiLocalidade: parsed.domainToApiLocalidade,
      roomTabOverrides: parsed.roomTabOverrides,
      roomOrderByTab: parsed.roomOrderByTab ?? {},
    });
    await this.uiConfigRepository.save(normalized);
    return normalized;
  }
}
