const db = require('./db');

function rand() {
  return Math.random().toString(36).substr(2);
}

async function healActivations() {
  try {
    const { Activation, User, AuditLog } = db;
    const acts = await Activation.find({ status: "approved" }, { limit: 100, sort: { date: -1 } });
    if (acts) {
      for (const act of acts) {
        const approvedAt = act.approved_at ? new Date(act.approved_at).getTime() : new Date(act.date).getTime();
        if (Date.now() - approvedAt < 2 * 60000) continue;

        const log = await AuditLog.findOne({ target_id: act.id, action: "approve" });
        if (!log) {
          console.log(`[Auto-Healer] Detectada inconsistencia en activación: ${act.id}. Reparando...`);
          const user = await User.findOne({ id: act.userId });
          if (!user) continue;
          
          const old_points = user.points || 0;
          const new_points = old_points + (act.points || 0);
          const activated = user.activated ? true : new_points >= 120;
          
          await User.update({ id: user.id }, { points: new_points, activated: activated });
          await AuditLog.insert({
            id: rand(), date: new Date(), collection: "activations", action: "approve", target_id: act.id,
            user_id: user.id, admin_id: "system_auto_healer",
            state_before: { points: old_points, activated: user.activated },
            state_after: { points: new_points, activated: activated }
          });
          console.log(`[Auto-Healer] Activación ${act.id} reparada. Se sumaron ${act.points || 0} puntos.`);
        }
      }
    }
  } catch (error) { console.error("[Auto-Healer] Error en activaciones:", error); }
}

async function healAffiliations() {
  try {
    const { Affiliation, User, AuditLog } = db;
    const affs = await Affiliation.find({ status: "approved" }, { limit: 100, sort: { date: -1 } });
    if (affs) {
      for (const aff of affs) {
        const approvedAt = aff.approved_at ? new Date(aff.approved_at).getTime() : new Date(aff.date).getTime();
        if (Date.now() - approvedAt < 2 * 60000) continue;

        const log = await AuditLog.findOne({ target_id: aff.id, action: "approve" });
        if (!log) {
          console.log(`[Auto-Healer] Detectada inconsistencia en afiliación: ${aff.id}. Reparando log...`);
          const user = await User.findOne({ id: aff.userId });
          if (!user) continue;
          
          await AuditLog.insert({
            id: rand(), date: new Date(), collection: "affiliations", action: "approve", target_id: aff.id,
            user_id: user.id, admin_id: "system_auto_healer",
            state_before: { activated: user.activated },
            state_after: { activated: true }
          });
          console.log(`[Auto-Healer] Afiliación ${aff.id} reparada exitosamente.`);
        }
      }
    }
  } catch (error) { console.error("[Auto-Healer] Error en afiliaciones:", error); }
}

function runHealer() {
  healActivations();
  healAffiliations();
}

module.exports = {
  start: () => {
    console.log("[Auto-Healer] Iniciado. Monitoreando inconsistencias...");
    setTimeout(runHealer, 5000);
    setInterval(runHealer, 15 * 60 * 1000);
  }
};
