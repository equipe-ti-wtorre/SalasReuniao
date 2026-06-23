import { GraphRoomsGateway } from "../../domain/contracts/GraphRoomsGateway";
import { TenantRepository } from "../../domain/contracts/TenantRepository";
import { UiConfigRepository } from "../../domain/contracts/UiConfigRepository";
import { AdminRoomView } from "../../domain/entities/UiConfig";
import { resolveApiLocalidade, resolveRoomTab } from "../../domain/uiConfigResolver";

const TENANT_LOCALIDADES = ["Allianz", "WTorre"] as const;

export class ListAllRoomsForAdminUseCase {
  constructor(
    private readonly graphGateway: GraphRoomsGateway,
    private readonly tenantRepository: TenantRepository,
    private readonly uiConfigRepository: UiConfigRepository,
  ) {}

  async execute(): Promise<AdminRoomView[]> {
    const config = await this.uiConfigRepository.get();
    const rooms: AdminRoomView[] = [];

    for (const localidade of TENANT_LOCALIDADES) {
      const tenant = await this.tenantRepository.findByLocalidade(localidade);
      if (!tenant) continue;

      const listed = await this.graphGateway.listRooms(tenant);
      for (const room of listed) {
        const email = room.email.trim().toLowerCase();
        const { tabId, source } = resolveRoomTab(email, config);
        rooms.push({
          name: room.name,
          email,
          apiLocalidade: resolveApiLocalidade(email, config) ?? localidade,
          tabId,
          tabSource: source,
        });
      }
    }

    return rooms.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
}
