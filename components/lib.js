const Cors = require("cors");

class Lib {
  constructor() {
    this.cors = Cors({
      origin: true, // Allow all origins
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "X-Api-Version",
        "x-file-name",
        "x-dir",
        // GET con anti-caché (admin/sessions, etc.): sin esto el preflight falla en producción (Vercel → Heroku)
        "Cache-Control",
        "Pragma",
        // Sentry browser SDK (tracing): sin esto el preflight falla en local/prod
        "sentry-trace",
        "baggage",
      ],
    });

    this.midd = this.midd.bind(this);
  }

  rand() {
    return Math.random().toString(36).substr(2);
  }
  
  // Generate a unique 6-character token (e.g., "A3B5C7")
  generateToken() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 6; i++) {
      token += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return token;
  }
  
  error(msg) {
    return { error: true, msg };
  }
  success(opts) {
    return { error: false, ...opts };
  }

  midd(req, res) {
    return new Promise((resolve, reject) => {
      this.cors(req, res, (result) => {
        if (result instanceof Error) return reject(result);
        return resolve(result);
      });
    });
  }

  acum(a, query, field) {
    const x = Object.keys(query)[0];
    const y = Object.values(query)[0];

    return a
      .filter((i) => i[x] == y)
      .map((i) => i[field])
      .reduce((a, b) => a + b, 0);
  }

  /** Saldo disponible para retiro / transferencia (excluye Bono Ahorro). */
  calcAvailableBalance(transactions) {
    if (!Array.isArray(transactions)) return 0;
    const ins = transactions
      .filter((t) => t.type === "in" && t.wallet_tipo !== "BONO_AHORRO")
      .reduce((sum, t) => sum + Number(t.value || 0), 0);
    const outs = transactions
      .filter((t) => t.type === "out" && t.wallet_tipo !== "BONO_AHORRO")
      .reduce((sum, t) => sum + Number(t.value || 0), 0);
    return ins - outs;
  }

  /** Saldo Bono Ahorro (solo canje, no retirable). */
  calcSavingsBonusBalance(transactions) {
    if (!Array.isArray(transactions)) return 0;
    const ins = transactions
      .filter((t) => t.type === "in" && t.wallet_tipo === "BONO_AHORRO")
      .reduce((sum, t) => sum + Number(t.value || 0), 0);
    const outs = transactions
      .filter((t) => t.type === "out" && t.wallet_tipo === "BONO_AHORRO")
      .reduce((sum, t) => sum + Number(t.value || 0), 0);
    return ins - outs;
  }

  ids(a) {
    return a.map((i) => i.userId);
  }
  _ids(a) {
    return a.map((i) => i.id);
  }
  parent_ids(a) {
    return a.map((i) => i.parentId);
  }

  map(a) {
    return new Map(a.map((i) => [i.id, i]));
  }
  _map(a) {
    return new Map(a.map((i) => [i.userId, i]));
  }

  model(obj, model) {
    let ret = {};

    for (let key in obj) if (model.includes(key)) ret[key] = obj[key];

    return ret;
  }

  async createAuditLog(AuditLog, payload) {
    if (!AuditLog) return;
    await AuditLog.insert({
      id: this.rand(),
      date: new Date(),
      ...payload
    });
  }

  /** Misma ventana de periodo (period_key o mismo mes calendario de aprobación). */
  isSameAffiliationPeriod(aff, periodKey, refDate) {
    if (!aff) return false;
    const affPeriod = aff.period_key;
    const affDateRaw = aff.approved_at || aff.date;
    const affDate = affDateRaw ? new Date(affDateRaw) : null;
    const ref = refDate ? new Date(refDate) : null;

    const sameCalendarMonth =
      ref &&
      affDate &&
      !isNaN(ref.getTime()) &&
      !isNaN(affDate.getTime()) &&
      affDate.getFullYear() === ref.getFullYear() &&
      affDate.getMonth() === ref.getMonth();

    if (periodKey && affPeriod) {
      return affPeriod === periodKey || sameCalendarMonth;
    }
    if (sameCalendarMonth) return true;
    return !periodKey && !affPeriod;
  }

  sortAffiliationsByApprovalDesc(affiliations) {
    return [...(affiliations || [])].sort((a, b) => {
      const da = new Date(a.approved_at || a.date || 0).getTime();
      const db = new Date(b.approved_at || b.date || 0).getTime();
      return db - da;
    });
  }

  /**
   * Suma puntos de afiliación de todas las afiliaciones aprobadas en el mismo periodo.
   * Si el usuario migra de paquete dentro del mes, acumula 450 + 900, etc.
   */
  async sumApprovedAffiliationPointsInPeriod(
    Affiliation,
    userId,
    periodKey,
    refDate,
    excludeId = null
  ) {
    const approved = await Affiliation.find({ userId, status: "approved" });
    let total = 0;
    for (const aff of approved || []) {
      if (excludeId && aff.id === excludeId) continue;
      if (!this.isSameAffiliationPeriod(aff, periodKey, refDate)) continue;
      total += Number(aff.plan?.affiliation_points) || 0;
    }
    return total;
  }

  /** Afiliación aprobada más reciente (plan vigente). */
  async getLatestApprovedAffiliation(Affiliation, userId) {
    const approved = await Affiliation.find({ userId, status: "approved" });
    const sorted = this.sortAffiliationsByApprovalDesc(approved);
    return sorted[0] || null;
  }

  /**
   * Calcula puntos acumulados del periodo y datos del plan según la última afiliación aprobada.
   */
  async resolveUserAffiliationState(Affiliation, userId, periodKey, refDate) {
    const latest = await this.getLatestApprovedAffiliation(Affiliation, userId);
    if (!latest) return null;

    const pk = periodKey != null ? periodKey : latest.period_key;
    const rd = refDate != null ? refDate : latest.approved_at || latest.date;
    const affiliation_points = await this.sumApprovedAffiliationPointsInPeriod(
      Affiliation,
      userId,
      pk,
      rd
    );

    return {
      affiliated: true,
      _activated: true,
      activated: true,
      plan: latest.plan.id,
      n: latest.plan.n,
      affiliation_points,
      affiliation_date: latest.approved_at || latest.date,
    };
  }

  // Actualiza total_points de un nodo y propaga hacia arriba
  async updateTotalPointsCascade(User, Tree, userId) {
    // 1. Obtener el nodo del árbol
    const node = await Tree.findOne({ id: userId });
    if (!node) return;

    // 2. Obtener el usuario
    const user = await User.findOne({ id: userId });
    if (!user) return;

    // 3. Calcular el total de los hijos
    let childrenTotal = 0;
    if (node.childs && node.childs.length > 0) {
      const childUsers = await User.find({ id: { $in: node.childs } });
      childrenTotal = childUsers.reduce((acc, c) => acc + (c.total_points || 0), 0);
    }

    // 4. Calcular el total_points propio
    const total_points = (user.points || 0) + (user.affiliation_points || 0) + childrenTotal;

    // 5. Guardar el total_points en el usuario
    await User.update({ id: userId }, { total_points });

    // 6. Propagar hacia arriba si tiene padre
    if (node.parent) {
      await this.updateTotalPointsCascade(User, Tree, node.parent);
    }
  }
}

export default new Lib()