import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";
import { DEFAULT_UNIVERSITY_MODULES } from "../../../lib/defaultUniversityModules";
import { ObjectId } from "mongodb";

const { UniversityModule } = db;
const { success, error, midd } = lib;

function toObjectId(id) {
  if (!id) return null;
  if (ObjectId.isValid(id) && typeof id === "string" && id.length === 24) {
    return new ObjectId(id);
  }
  return id;
}

export default async (req, res) => {
  try {
    await midd(req, res);
    const auth = await requireAdmin(req, res);
    if (!auth) return;

    if (req.method === "GET") {
      let modules = await UniversityModule.find({}, { sort: { order: 1 } });
      
      // Si la colección está vacía, sembramos automáticamente los módulos iniciales
      if (!modules || modules.length === 0) {
        for (const mod of DEFAULT_UNIVERSITY_MODULES) {
          await UniversityModule.insert({
            ...mod,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        modules = await UniversityModule.find({}, { sort: { order: 1 } });
      }

      return res.json(success({ modules }));
    }

    if (req.method === "POST") {
      const { action, id, moduleId, data } = req.body;

      if (action === "seed-defaults") {
        const count = await UniversityModule.count({});
        if (count === 0) {
          for (const mod of DEFAULT_UNIVERSITY_MODULES) {
            await UniversityModule.insert({
              ...mod,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
        const modules = await UniversityModule.find({}, { sort: { order: 1 } });
        return res.json(success({ modules }));
      }

      // --- Módulos ---
      if (action === "create-module") {
        if (!data || !data.title) {
          return res.status(400).json(error("El título del módulo es requerido"));
        }
        const count = await UniversityModule.count({});
        const newMod = {
          badge: data.badge || `Módulo ${count}`,
          title: data.title,
          lead: data.lead || "",
          theme: data.theme || "sunset",
          banner: data.banner || "",
          hideBannerText: !!data.hideBannerText,
          order: typeof data.order === "number" ? data.order : count,
          active: data.active !== false,
          videos: [],
          files: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await UniversityModule.insert(newMod);
        return res.json(success({ message: "Módulo creado exitosamente" }));
      }

      if (action === "update-module") {
        if (!id) return res.status(400).json(error("ID de módulo es requerido"));
        const targetId = toObjectId(id);
        const updateData = {
          ...(data.badge !== undefined && { badge: data.badge }),
          ...(data.title !== undefined && { title: data.title }),
          ...(data.lead !== undefined && { lead: data.lead }),
          ...(data.theme !== undefined && { theme: data.theme }),
          ...(data.banner !== undefined && { banner: data.banner }),
          ...(data.hideBannerText !== undefined && { hideBannerText: !!data.hideBannerText }),
          ...(data.order !== undefined && { order: Number(data.order) }),
          ...(data.active !== undefined && { active: !!data.active }),
          updatedAt: new Date(),
        };
        await UniversityModule.update({ _id: targetId }, updateData);
        return res.json(success({ message: "Módulo actualizado" }));
      }

      if (action === "delete-module") {
        if (!id) return res.status(400).json(error("ID de módulo es requerido"));
        const targetId = toObjectId(id);
        await UniversityModule.delete({ _id: targetId });
        return res.json(success({ message: "Módulo eliminado" }));
      }

      // --- Videos / Clases ---
      if (action === "save-video") {
        const targetModId = toObjectId(moduleId || id);
        if (!targetModId) return res.status(400).json(error("ID de módulo es requerido"));

        const mod = await UniversityModule.findOne({ _id: targetModId });
        if (!mod) return res.status(404).json(error("Módulo no encontrado"));

        const currentVideos = Array.isArray(mod.videos) ? [...mod.videos] : [];
        const videoData = data || {};

        if (!videoData.title) {
          return res.status(400).json(error("El título del video es requerido"));
        }

        const videoId = videoData.id || videoData._id || `vid_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const existingIdx = currentVideos.findIndex(v => (v.id && v.id === videoId) || (v._id && String(v._id) === String(videoId)));

        const cleanVideo = {
          id: videoId,
          title: videoData.title,
          desc: videoData.desc || "",
          videoUrl: videoData.videoUrl || "",
          thumbnail: videoData.thumbnail || "",
          duration: videoData.duration || "00:00",
          theme: videoData.theme || mod.theme || "sunset",
          order: typeof videoData.order === "number" ? videoData.order : (existingIdx >= 0 ? currentVideos[existingIdx].order : currentVideos.length),
        };

        if (existingIdx >= 0) {
          currentVideos[existingIdx] = { ...currentVideos[existingIdx], ...cleanVideo };
        } else {
          currentVideos.push(cleanVideo);
        }

        currentVideos.sort((a, b) => (a.order || 0) - (b.order || 0));

        await UniversityModule.update({ _id: targetModId }, { videos: currentVideos, updatedAt: new Date() });
        return res.json(success({ message: "Video guardado", video: cleanVideo }));
      }

      if (action === "delete-video") {
        const targetModId = toObjectId(moduleId);
        const videoId = data?.videoId || data?.id;
        if (!targetModId || !videoId) {
          return res.status(400).json(error("Faltan parámetros para eliminar video"));
        }

        const mod = await UniversityModule.findOne({ _id: targetModId });
        if (!mod) return res.status(404).json(error("Módulo no encontrado"));

        const updatedVideos = (mod.videos || []).filter(
          v => v.id !== videoId && String(v._id) !== String(videoId)
        );

        await UniversityModule.update({ _id: targetModId }, { videos: updatedVideos, updatedAt: new Date() });
        return res.json(success({ message: "Video eliminado" }));
      }

      // --- Archivos / Material Complementario ---
      if (action === "save-file") {
        const targetModId = toObjectId(moduleId || id);
        if (!targetModId) return res.status(400).json(error("ID de módulo es requerido"));

        const mod = await UniversityModule.findOne({ _id: targetModId });
        if (!mod) return res.status(404).json(error("Módulo no encontrado"));

        const currentFiles = Array.isArray(mod.files) ? [...mod.files] : [];
        const fileData = data || {};

        if (!fileData.name) {
          return res.status(400).json(error("El nombre del archivo es requerido"));
        }

        const fileId = fileData.id || fileData._id || `file_${Date.now()}`;
        const existingIdx = currentFiles.findIndex(f => (f.id && f.id === fileId) || (f._id && String(f._id) === String(fileId)));

        const cleanFile = {
          id: fileId,
          name: fileData.name,
          meta: fileData.meta || "Archivo",
          url: fileData.url || "",
        };

        if (existingIdx >= 0) {
          currentFiles[existingIdx] = { ...currentFiles[existingIdx], ...cleanFile };
        } else {
          currentFiles.push(cleanFile);
        }

        await UniversityModule.update({ _id: targetModId }, { files: currentFiles, updatedAt: new Date() });
        return res.json(success({ message: "Material guardado", file: cleanFile }));
      }

      if (action === "delete-file") {
        const targetModId = toObjectId(moduleId);
        const fileId = data?.fileId || data?.id;
        if (!targetModId || !fileId) {
          return res.status(400).json(error("Faltan parámetros para eliminar archivo"));
        }

        const mod = await UniversityModule.findOne({ _id: targetModId });
        if (!mod) return res.status(404).json(error("Módulo no encontrado"));

        const updatedFiles = (mod.files || []).filter(
          f => f.id !== fileId && String(f._id) !== String(fileId)
        );

        await UniversityModule.update({ _id: targetModId }, { files: updatedFiles, updatedAt: new Date() });
        return res.json(success({ message: "Material eliminado" }));
      }

      return res.status(400).json(error("Acción no válida"));
    }

    return res.status(405).json(error("Método no permitido"));
  } catch (err) {
    console.error("Error in /api/admin/university:", err);
    return res.status(500).json(error(err.message));
  }
};
