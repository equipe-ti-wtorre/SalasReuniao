import { Router } from "express";
import multer from "multer";
import { GetUiConfigUseCase, SaveUiConfigUseCase } from "../../application/use-cases/UiConfigUseCases";
import { ListAllRoomsForAdminUseCase } from "../../application/use-cases/ListAllRoomsForAdminUseCase";
import { TabLogoUseCases } from "../../application/use-cases/TabLogoUseCases";
import { adminAuthMiddleware } from "../middlewares/adminAuthMiddleware";

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024 },
});

export function buildAdminRoutes(
  getUiConfigUseCase: GetUiConfigUseCase,
  saveUiConfigUseCase: SaveUiConfigUseCase,
  listAllRoomsForAdminUseCase: ListAllRoomsForAdminUseCase,
  tabLogoUseCases: TabLogoUseCases,
) {
  const router = Router();

  router.get("/ui-config", async (_req, res) => {
    const config = await getUiConfigUseCase.execute();
    res.json({ config });
  });

  router.use(adminAuthMiddleware);

  router.get("/rooms", async (_req, res) => {
    const rooms = await listAllRoomsForAdminUseCase.execute();
    res.json({ rooms });
  });

  router.put("/ui-config", async (req, res) => {
    const config = await saveUiConfigUseCase.execute(req.body);
    res.json({ config });
  });

  router.post("/tabs/:tabId/logo", logoUpload.single("logo"), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ code: "LOGO_REQUIRED", message: "Informe o arquivo de logo." });
        return;
      }
      const tabId = req.params.tabId;
      if (typeof tabId !== "string") {
        res.status(400).json({ code: "INVALID_TAB_ID", message: "Identificador de aba inválido." });
        return;
      }
      const config = await tabLogoUseCases.upload(tabId, req.file);
      res.json({ config });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/tabs/:tabId/logo", async (req, res, next) => {
    try {
      const tabId = req.params.tabId;
      if (typeof tabId !== "string") {
        res.status(400).json({ code: "INVALID_TAB_ID", message: "Identificador de aba inválido." });
        return;
      }
      const config = await tabLogoUseCases.delete(tabId);
      res.json({ config });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function buildPublicUiConfigRoute(getUiConfigUseCase: GetUiConfigUseCase) {
  const router = Router();
  router.get("/ui-config", async (_req, res) => {
    const config = await getUiConfigUseCase.execute();
    res.json({ config });
  });
  return router;
}
