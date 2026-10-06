import db from "../../../components/db";
import lib from "../../../components/lib";
import {
  DEFAULT_POPUPS,
  POPUP_IDS,
  normalizeImagePopup,
  normalizeWelcomePopup,
  pickPopupForUser,
} from "../../../lib/popupConfig";

const { DashboardConfig, Session, User } = db;
const { success, error, midd } = lib;

async function loadPopup(type) {
  const saved = await DashboardConfig.findOne({ id: POPUP_IDS[type] });
  if (type === "welcome") {
    return normalizeWelcomePopup({ ...DEFAULT_POPUPS.welcome, ...(saved || {}) });
  }
  return normalizeImagePopup(type, { ...DEFAULT_POPUPS[type], ...(saved || {}) });
}

async function loadConfigs() {
  return {
    unaffiliated: await loadPopup("unaffiliated"),
    institutional: await loadPopup("institutional"),
    welcome: await loadPopup("welcome"),
  };
}

export default async (req, res) => {
  try {
    await midd(req, res);

    const sessionValue = (req.query && req.query.session) || (req.body && req.body.session);
    if (!sessionValue) return res.json(error("invalid session"));

    const session = await Session.findOne({ value: sessionValue });
    if (!session) return res.json(error("invalid session"));

    const user = await User.findOne({ id: session.id });
    if (!user) return res.json(error("invalid session"));

    if (req.method === "GET") {
      const configs = await loadConfigs();
      const popup = pickPopupForUser(user, configs);
      return res.json(success({ popup }));
    }

    if (req.method === "POST") {
      const action = String((req.body && req.body.action) || "");
      const type = String((req.body && req.body.type) || "");
      if (action !== "dismiss") {
        return res.status(400).json(error("Acción no válida"));
      }
      if (type === "welcome" && user.welcomePopupPending && !user.welcomePopupSeen) {
        await User.update(
          { id: user.id },
          {
            welcomePopupSeen: true,
            welcomePopupPending: false,
            welcomePopupSeenAt: new Date(),
          }
        );
      }
      return res.json(success({ dismissed: true }));
    }

    return res.status(405).json(error("Método no permitido"));
  } catch (err) {
    console.error("Error in /api/app/popups:", err);
    return res.status(500).json(error(err.message));
  }
};
