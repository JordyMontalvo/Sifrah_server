const { MongoClient } = require("mongodb");
const { PrismaClient } = require("@prisma/client");

const MONGO_URL = process.env.DB_URL || process.env.MONGODB_URI || "mongodb://localhost:27017";
const MONGO_DB_NAME = process.env.DB_NAME || "sifrah";

const prisma = new PrismaClient();

async function migrate() {
  const mongoClient = new MongoClient(MONGO_URL, { useUnifiedTopology: true });

  try {
    await mongoClient.connect();
    console.log("✅ Conectado a MongoDB");
    const db = mongoClient.db(MONGO_DB_NAME);

    // ==========================================
    // MIGRAR ENTIDADES INDEPENDIENTES (Catálogos y Configuraciones)
    // ==========================================
    const migrateCollection = async (collectionName, modelName, mapFn) => {
      console.log(`\n⏳ Migrando ${collectionName}...`);
      const docs = await db.collection(collectionName).find({}).toArray();
      let count = 0;
      for (const doc of docs) {
        try {
          const data = mapFn(doc);
          if (!data) continue;
          await prisma[modelName].upsert({
            where: { id: data.id },
            update: {},
            create: data
          });
          count++;
        } catch (e) {
          console.error(`Error en ${collectionName} ID: ${doc._id}`, e.message);
        }
      }
      console.log(`✅ ${count} registros migrados en ${collectionName}.`);
    };

    await migrateCollection("plans", "plan", (doc) => {
      if (!doc.id) return null;
      return {
        id: doc.id.toString(),
        mongoId: doc._id.toString(),
        name: doc.name || "",
        amount: parseFloat(doc.amount) || 0,
        img: doc.img,
        affiliation_points: parseFloat(doc.affiliation_points) || 0,
        n: parseInt(doc.n) || 0,
        max_products: parseInt(doc.max_products) || 0,
        kit: parseFloat(doc.kit) || 0,
      };
    });

    await migrateCollection("periods", "period", (doc) => {
      if (!doc.id || !doc.key) return null;
      return {
        id: doc.id.toString(),
        mongoId: doc._id.toString(),
        key: doc.key,
        year: parseInt(doc.year) || 0,
        month: parseInt(doc.month) || 0,
        label: doc.label || "",
        status: doc.status || "open",
        createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
        closedAt: doc.closedAt ? new Date(doc.closedAt) : null,
      };
    });

    await migrateCollection("flyers", "flyer", (doc) => ({
      id: doc.id ? doc.id.toString() : doc._id.toString(),
      mongoId: doc._id.toString(),
      name: doc.name || "",
      image_url: doc.image_url,
      base_image_url: doc.base_image_url,
      active: Boolean(doc.active),
      description: doc.description,
      created_at: doc.created_at ? new Date(doc.created_at) : new Date(),
      updated_at: doc.updated_at ? new Date(doc.updated_at) : new Date(),
    }));

    await migrateCollection("audio_categories", "audioCategory", (doc) => ({
      id: doc.id ? doc.id.toString() : doc._id.toString(),
      mongoId: doc._id.toString(),
      name: doc.name || "",
      created_at: doc.created_at ? new Date(doc.created_at) : new Date(),
    }));

    await migrateCollection("book_categories", "bookCategory", (doc) => ({
      id: doc.id ? doc.id.toString() : doc._id.toString(),
      mongoId: doc._id.toString(),
      name: doc.name || "",
      created_at: doc.created_at ? new Date(doc.created_at) : new Date(),
    }));

    await migrateCollection("delivery_agencies", "deliveryAgency", (doc) => ({
      id: doc.agency_id ? doc.agency_id.toString() : doc._id.toString(),
      mongoId: doc._id.toString(),
      agency_id: doc.agency_id ? doc.agency_id.toString() : null,
      agency_name: doc.agency_name || "",
      agency_code: doc.agency_code,
      coverage_areas: doc.coverage_areas || [],
      active: Boolean(doc.active),
      created_at: doc.created_at ? new Date(doc.created_at) : new Date(),
      updated_at: doc.updated_at ? new Date(doc.updated_at) : new Date(),
    }));

    await migrateCollection("payment_methods", "paymentMethod", (doc) => ({
      id: doc.id ? doc.id.toString() : doc._id.toString(),
      mongoId: doc._id.toString(),
      cuenta: doc.cuenta,
      titular: doc.titular,
      banco: doc.banco,
      tipo: doc.tipo,
      cci: doc.cci,
      active: Boolean(doc.active),
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
    }));

    await migrateCollection("banner", "banner", (doc) => ({
      id: doc.id ? doc.id.toString() : doc._id.toString(),
      mongoId: doc._id.toString(),
      img: doc.img,
      img2: doc.img2,
      img3: doc.img3,
    }));

    await migrateCollection("materials", "material", (doc) => ({
      id: doc._id.toString(),
      mongoId: doc._id.toString(),
      title: doc.title || "",
      description: doc.description,
      image: doc.image,
      link: doc.link,
    }));

    await migrateCollection("offices", "office", (doc) => ({
      id: doc.id ? doc.id.toString() : doc._id.toString(),
      mongoId: doc._id.toString(),
      type: doc.type,
      name: doc.name || "",
      email: doc.email,
      password: doc.password,
      products: doc.products || [],
      accounts: doc.accounts,
      address: doc.address,
      profit: parseFloat(doc.profit) || 0,
      googleMapsUrl: doc.googleMapsUrl,
      phone: doc.phone,
      dias: doc.dias,
      horario: doc.horario,
    }));

    await migrateCollection("delivery_districts", "deliveryDistrict", (doc) => ({
      id: doc._id.toString(),
      mongoId: doc._id.toString(),
      department: doc.department,
      province: doc.province,
      district_name: doc.district_name || "",
      delivery_type: doc.delivery_type,
      active: Boolean(doc.active),
      zone_id: doc.zone_id ? doc.zone_id.toString() : null,
      created_at: doc.created_at ? new Date(doc.created_at) : new Date(),
      updated_at: doc.updated_at ? new Date(doc.updated_at) : new Date(),
    }));

    await migrateCollection("dashboard_config", "dashboardConfig", (doc) => ({
      id: doc.id ? doc.id.toString() : doc._id.toString(),
      mongoId: doc._id.toString(),
      text: doc.text,
    }));

    await migrateCollection("delivery_zones", "deliveryZone", (doc) => ({
      id: doc.zone_id ? doc.zone_id.toString() : doc._id.toString(),
      mongoId: doc._id.toString(),
      zone_id: doc.zone_id ? doc.zone_id.toString() : null,
      zone_name: doc.zone_name || "",
      price: parseFloat(doc.price) || 0,
      delivery_type: doc.delivery_type,
      description: doc.description,
      active: Boolean(doc.active),
      created_at: doc.created_at ? new Date(doc.created_at) : new Date(),
      updated_at: doc.updated_at ? new Date(doc.updated_at) : new Date(),
    }));

    // ==========================================
    // MIGRAR USUARIOS Y ENTIDADES DEPENDIENTES
    // ==========================================
    
    // Obtener los planes directamente de Prisma
    const pgPlans = await prisma.plan.findMany();
    const planIds = new Set(pgPlans.map(p => p.id));

    console.log("\n⏳ Migrando Usuarios (Fase 1: Datos Base)...");
    const users = await db.collection("users").find({}).toArray();
    let usersCount = 0;
    const usersMap = new Map();
    
    for (const user of users) {
      if (!user.id || !user.dni) continue;
      usersMap.set(user.id.toString(), user);

      const bDate = user.birthdate ? new Date(user.birthdate) : null;
      const validBDate = bDate && !isNaN(bDate.getTime()) ? bDate : null;
      const planId = user.plan && planIds.has(user.plan.toString()) ? user.plan.toString() : null;

      await prisma.user.upsert({
        where: { id: user.id.toString() },
        update: {},
        create: {
          id: user.id.toString(),
          mongoId: user._id.toString(),
          date: user.date ? new Date(user.date) : new Date(),
          name: user.name || "Sin Nombre",
          lastName: user.lastName,
          dni: user.dni.toString(),
          email: user.email || null,
          phone: user.phone || null,
          department: user.department || null,
          city: user.city || null,
          country: user.country || null,
          address: user.address || null,
          birthdate: validBDate,
          photo: user.photo || null,
          planId: planId,
          affiliated: Boolean(user.affiliated),
          activated: Boolean(user.activated),
          internal_activated: Boolean(user._activated),
          token: user.token,
          points: parseFloat(user.points) || 0,
          affiliation_points: parseFloat(user.affiliation_points) || 0,
          total_points: parseFloat(user.total_points) || 0,
          rank: user.rank,
          rank_history: user.rank_history || [],
          tree: Boolean(user.tree),
          last_prediction_update: user.last_prediction_update ? new Date(user.last_prediction_update) : null,
          leadership_factors: user.leadership_factors || [],
          leadership_level: user.leadership_level,
          leadership_probability: parseFloat(user.leadership_probability) || null,
          leadership_score: parseFloat(user.leadership_score) || null,
          status: user.status || "active",
          statusReason: user.statusReason,
          blocked_at: user.blocked_at ? new Date(user.blocked_at) : null,
          eliminated_at: user.eliminated_at ? new Date(user.eliminated_at) : null,
          reactivated_at: user.reactivated_at ? new Date(user.reactivated_at) : null,
        },
      });
      usersCount++;
    }
    console.log(`✅ ${usersCount} Usuarios migrados (Base).`);

    console.log("\n⏳ Actualizando Relaciones de Patrocinador (Tree)...");
    let relCount = 0;
    for (const [id, user] of usersMap.entries()) {
      if (user.parentId && usersMap.has(user.parentId.toString())) {
        await prisma.user.update({
          where: { id: id },
          data: { parentId: user.parentId.toString() }
        });
        relCount++;
      }
    }
    console.log(`✅ ${relCount} Relaciones actualizadas.`);

    // DEPENDENCIAS DE USUARIO
    console.log("\n⏳ Migrando Collects...");
    const collects = await db.collection("collects").find({}).toArray();
    let collectCount = 0;
    for (const collect of collects) {
      if (!collect.userId || !usersMap.has(collect.userId.toString())) continue;
      await prisma.collect.upsert({
        where: { id: collect.id ? collect.id.toString() : collect._id.toString() },
        update: {},
        create: {
          id: collect.id ? collect.id.toString() : collect._id.toString(),
          mongoId: collect._id.toString(),
          date: collect.date ? new Date(collect.date) : new Date(),
          cash: Boolean(collect.cash),
          bank: collect.bank,
          account: collect.account,
          account_type: collect.account_type,
          amount: parseFloat(collect.amount) || 0,
          office: collect.office,
          status: collect.status,
          userId: collect.userId.toString()
        }
      });
      collectCount++;
    }
    console.log(`✅ ${collectCount} Collects migrados.`);

    console.log("\n⏳ Migrando Transacciones...");
    const transactions = await db.collection("transactions").find({}).toArray();
    let trxCount = 0;
    const trxBatches = [];
    let currentTrxBatch = [];
    
    for (const trx of transactions) {
      if (!trx.user_id || !usersMap.has(trx.user_id.toString())) continue; 
      
      currentTrxBatch.push({
        id: trx.id ? trx.id.toString() : undefined,
        mongoId: trx._id.toString(),
        date: trx.date ? new Date(trx.date) : new Date(),
        type: trx.type || "in",
        value: parseFloat(trx.value) || 0,
        name: trx.name,
        wallet_tipo: trx.wallet_tipo,
        virtual: Boolean(trx.virtual),
        affiliation_id: trx.affiliation_id ? trx.affiliation_id.toString() : null,
        internal_userId: trx._user_id ? trx._user_id.toString() : null,
        period_key: trx.period_key,
        period_label: trx.period_label,
        userId: trx.user_id.toString()
      });

      if (currentTrxBatch.length === 500) {
        trxBatches.push(currentTrxBatch);
        currentTrxBatch = [];
      }
    }
    if (currentTrxBatch.length > 0) trxBatches.push(currentTrxBatch);

    for (const batch of trxBatches) {
      await prisma.transaction.createMany({
        data: batch,
        skipDuplicates: true
      });
      trxCount += batch.length;
    }
    console.log(`✅ ${trxCount} Transacciones migradas.`);

    console.log("\n⏳ Migrando Activaciones...");
    const activations = await db.collection("activations").find({}).toArray();
    let actCount = 0;
    for (const act of activations) {
      if (!act.userId || !usersMap.has(act.userId.toString())) continue;
      await prisma.activation.upsert({
        where: { id: act.id ? act.id.toString() : act._id.toString() },
        update: {},
        create: {
          id: act.id ? act.id.toString() : act._id.toString(),
          mongoId: act._id.toString(),
          date: act.date ? new Date(act.date) : new Date(),
          products: act.products || [],
          price: parseFloat(act.price) || 0,
          points: parseFloat(act.points) || 0,
          total: parseFloat(act.total) || 0,
          check: Boolean(act.check),
          voucher: act.voucher,
          transactions: act.transactions || [],
          amounts: act.amounts || {},
          office: act.office,
          status: act.status,
          delivered: Boolean(act.delivered),
          pay_method: act.pay_method,
          bank: act.bank,
          voucher_date: act.voucher_date ? new Date(act.voucher_date) : null,
          voucher_number: act.voucher_number,
          userId: act.userId.toString()
        }
      });
      actCount++;
    }
    console.log(`✅ ${actCount} Activaciones migradas.`);


    console.log("\n🎉 MIGRACIÓN TOTAL COMPLETADA CON ÉXITO 🎉");

  } catch (error) {
    console.error("❌ Error durante la migración:", error);
  } finally {
    await mongoClient.close();
    await prisma.$disconnect();
  }
}

migrate();
