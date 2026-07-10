const { MongoClient } = require("mongodb");
// const { PrismaClient } = require("@prisma/client");

const URL = process.env.DB_URL || process.env.MONGODB_URI || "mongodb://localhost:27017";
const name = process.env.DB_NAME || process.env.DB_NAME_FALLBACK || "sifrah";

// ==========================================
// MONGODB LEGACY CLIENT (Para colecciones no migradas aún)
// ==========================================
let globalDb = null;
let connectPromise = null;

class FakeClient {
  async connect() {
    if (!connectPromise) {
      connectPromise = (async () => {
        const client = new MongoClient(URL, { useUnifiedTopology: true });
        await client.connect();
        globalDb = client.db(name);
      })();
    }
    await connectPromise;
    return { db: () => globalDb };
  }
  close() {}
}
const Client = FakeClient;


// ==========================================
// PRISMA CLIENT & BRIDGE (Desactivado temporalmente - Sólo Mongo)
// ==========================================
// const prisma = new PrismaClient();

function translateMongoToPrismaQuery(query) {
  if (!query) return undefined;
  if (typeof query !== "object") return query;
  if (Array.isArray(query)) return query;

  const translated = {};
  for (const [key, value] of Object.entries(query)) {
    if (key === "_id") {
      const idStr = value ? value.toString() : null;
      if (idStr) {
        translated.OR = [{ id: idStr }, { mongoId: idStr }];
      }
    } else if (key === "$or") {
      translated.OR = value.map(translateMongoToPrismaQuery);
    } else if (key === "$and") {
      translated.AND = value.map(translateMongoToPrismaQuery);
    } else if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      Object.keys(value).some(k => k.startsWith("$"))
    ) {
      const fieldOp = {};
      for (const [opKey, opVal] of Object.entries(value)) {
        if (opKey === "$in") {
          if (Array.isArray(opVal) && opVal.length === 2 && opVal.includes(null) && opVal.includes(false)) {
            fieldOp.equals = false;
          } else {
            fieldOp.in = opVal;
          }
        }
        else if (opKey === "$nin") fieldOp.notIn = opVal;
        else if (opKey === "$gte") fieldOp.gte = opVal;
        else if (opKey === "$gt") fieldOp.gt = opVal;
        else if (opKey === "$lte") fieldOp.lte = opVal;
        else if (opKey === "$lt") fieldOp.lt = opVal;
        else if (opKey === "$ne") fieldOp.not = opVal;
        else if (opKey === "$exists") fieldOp.not = opVal ? null : undefined;
        else fieldOp[opKey] = opVal;
      }
      translated[key] = fieldOp;
    } else {
      translated[key] = value;
    }
  }
  return Object.keys(translated).length > 0 ? translated : undefined;
}

class PrismaWrapper {
  constructor(modelName) {
    this.modelName = modelName;
    this.model = prisma[modelName];
  }

  _prepareData(data) {
    if (!data) return data;
    const cloned = { ...data };
    if (cloned._id) {
      cloned.id = cloned._id.toString();
      cloned.mongoId = cloned._id.toString();
      delete cloned._id;
    }
    return cloned;
  }

  async findOne(query) {
    return await this.model.findFirst({ where: translateMongoToPrismaQuery(query) });
  }

  async find(query, opts = {}) {
    let orderBy = undefined;
    if (opts.sort) {
      orderBy = Object.keys(opts.sort).map(k => ({ [k]: opts.sort[k] === -1 ? 'desc' : 'asc' }));
    } else if (query && query.date === -1) { 
      // Handle cases where sort is mistakenly passed as query
      orderBy = { date: 'desc' };
      delete query.date;
    }

    return await this.model.findMany({
      where: translateMongoToPrismaQuery(query),
      orderBy,
      take: opts.limit,
      skip: opts.skip
    });
  }

  async findOneLast(query) {
    const items = await this.model.findMany({ where: translateMongoToPrismaQuery(query) });
    return items.length ? items[items.length - 1] : null;
  }

  async findPaginated(query, skip, limit) {
    return await this.model.findMany({
      where: translateMongoToPrismaQuery(query),
      skip,
      take: limit,
      orderBy: { date: 'desc' }
    });
  }

  async count(query) {
    return await this.model.count({ where: translateMongoToPrismaQuery(query) });
  }

  async insert(data) {
    return await this.model.create({ data: this._prepareData(data) });
  }

  async update(query, values) {
    const toUpdate = await this.model.findFirst({ where: translateMongoToPrismaQuery(query) });
    if (toUpdate) {
      return await this.model.update({ where: { id: toUpdate.id }, data: values });
    }
  }

  async updateOne(query, values) {
    return this.update(query, values);
  }

  async updateMany(query, values) {
    return await this.model.updateMany({
      where: translateMongoToPrismaQuery(query),
      data: values
    });
  }

  async updateInc(query, values) {
    const incData = {};
    for (const k in values) incData[k] = { increment: values[k] };
    await this.model.updateMany({
      where: translateMongoToPrismaQuery(query),
      data: incData
    });
  }

  async un_update(query, values) {
    const unsetData = {};
    for (const k in values) unsetData[k] = null;
    await this.model.updateMany({
      where: translateMongoToPrismaQuery(query),
      data: unsetData
    });
  }

  async delete(query) {
    const toDelete = await this.model.findFirst({ where: translateMongoToPrismaQuery(query) });
    if (toDelete) {
      return await this.model.delete({ where: { id: toDelete.id } });
    }
  }

  async deleteOne(query) {
    return this.delete(query);
  }

  async deleteMany(query) {
    return await this.model.deleteMany({ where: translateMongoToPrismaQuery(query) });
  }
}


// ==========================================
// CLASES LEGACY DE MONGO (No migradas a Postgres aún)
// ==========================================
class MongoWrapper {
  constructor(collectionName) {
    this.collectionName = collectionName;
  }
  async _getCollection() {
    const client = new Client();
    const conn = await client.connect();
    return conn.db().collection(this.collectionName);
  }
  async findOne(query) {
    const col = await this._getCollection();
    return await col.findOne(query);
  }
  async find(query = {}, opts = {}) {
    const col = await this._getCollection();
    let cursor = col.find(query);
    if (opts.sort) cursor = cursor.sort(opts.sort);
    if (opts.limit) cursor = cursor.limit(opts.limit);
    if (opts.skip) cursor = cursor.skip(opts.skip);
    return await cursor.toArray();
  }
  async findPaginated(query, skip, limit, sort = { _id: -1 }) {
    const col = await this._getCollection();
    let cursor = col.find(query);
    if (Object.keys(sort).length > 0) cursor = cursor.sort(sort);
    if (skip) cursor = cursor.skip(skip);
    if (limit) cursor = cursor.limit(limit);
    return await cursor.toArray();
  }
  async findOneLast(query) {
    const items = await this.find(query);
    return items.length ? items[items.length - 1] : null;
  }
  async count(query) {
    const col = await this._getCollection();
    return await col.countDocuments(query);
  }
  async insert(doc) {
    const col = await this._getCollection();
    await col.insertOne(doc);
  }
  async update(query, values) {
    const col = await this._getCollection();
    await col.updateOne(query, { $set: values });
  }
  async updateOne(query, values) {
    return this.update(query, values);
  }
  async updateMany(query, values) {
    const col = await this._getCollection();
    await col.updateMany(query, { $set: values });
  }
  async delete(query) {
    if (typeof query === 'string') query = { id: query };
    const col = await this._getCollection();
    await col.deleteOne(query);
  }
  async deleteOne(query) {
    if (typeof query === 'string') query = { id: query };
    return this.delete(query);
  }
  async deleteMany(query) {
    if (typeof query === 'string') query = { id: query };
    const col = await this._getCollection();
    await col.deleteMany(query);
  }
}

// Personalización especial para productos en Mongo
class ProductWrapper extends MongoWrapper {
  async find(query = {}, opts = {}) {
    const res = await super.find(query, opts);
    return res.filter(p => !p.name || !p.name.toLowerCase().includes("trapeador"));
  }

  async findOne(query) {
    const res = await super.findOne(query);
    if (res && res.name && res.name.toLowerCase().includes("trapeador")) {
      return null;
    }
    return res;
  }

  async findPaginated(query, skip, limit, sort = { _id: -1 }) {
    const res = await super.findPaginated(query, skip, limit, sort);
    return res.filter(p => !p.name || !p.name.toLowerCase().includes("trapeador"));
  }

  async un_update(query, values) {
    const col = await this._getCollection();
    await col.updateOne(query, { $unset: values });
  }
}


// ==========================================
// EXPORT DB
// ==========================================
class DB {
  constructor(models) {
    Object.assign(this, models);
  }
}

module.exports = new DB({
  // --- REVERTIDO A MONGODB TEMPORALMENTE ---
  User: new MongoWrapper('users'),
  Activation: new MongoWrapper('activations'),
  Transaction: new MongoWrapper('transactions'),
  Tree: new MongoWrapper('tree'),
  Plan: new MongoWrapper('plans'),
  Period: new MongoWrapper('periods'),
  Collect: new MongoWrapper('collects'),
  Flyer: new MongoWrapper('flyers'),
  AudioCategory: new MongoWrapper('audio_categories'),
  BookCategory: new MongoWrapper('book_categories'),
  DeliveryAgency: new MongoWrapper('delivery_agencies'),
  PaymentMethod: new MongoWrapper('payment_methods'),
  Banner: new MongoWrapper('banner'),
  Material: new MongoWrapper('materials'),
  Office: new MongoWrapper('offices'),
  DeliveryDistrict: new MongoWrapper('delivery_districts'),
  DashboardConfig: new MongoWrapper('dashboard_config'),
  DeliveryZone: new MongoWrapper('delivery_zones'),

  // --- MANTENIDO EN MONGO (AÚN NO MIGRADO) ---
  Session: new MongoWrapper('sessions'),
  Affiliation: new MongoWrapper('affiliations'),
  Product: new ProductWrapper('products'),
  Promo: new MongoWrapper('promos'),
  Prom: new MongoWrapper('promo'),
  Token: new MongoWrapper('tokens'),
  OfficeCollect: new MongoWrapper('office_collects'),
  Recharge: new MongoWrapper('recharges'),
  Closed: new MongoWrapper('closeds'),
  RankBonusPayment: new MongoWrapper('rank_bonus_payments'),
  Audio: new MongoWrapper('audios'),
  Book: new MongoWrapper('books'),
  SavingsCategory: new MongoWrapper('savings_categories'),
  AgendaEvent: new MongoWrapper('agenda_events'),
  AuditLog: new MongoWrapper('audit_logs'),
  ReactivationRequest: new MongoWrapper('reactivation_requests'),
});
