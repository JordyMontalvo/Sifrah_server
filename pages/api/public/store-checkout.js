import db from "../../../components/db";
import lib from "../../../components/lib";
import {
  filterSifrahCatalogProducts,
  isPromotionProduct,
  isSavingsOnlyProduct,
} from "../../../lib/productCatalog";

const { User, Product, Activation, Affiliation, Period, PaymentMethod, Office } = db;
const { error, success, midd, rand } = lib;

function clean(value, max) {
  return String(value || "").trim().slice(0, max);
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function withDeliveryDb(fn) {
  const { MongoClient } = require("mongodb");
  const uri = process.env.MONGODB_URI || process.env.DB_URL;
  if (!uri) throw new Error("sin cobertura");
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  await client.connect();
  try {
    return await fn(client.db());
  } finally {
    await client.close();
  }
}

async function deliveryQuote(info) {
  const department = clean(info.department, 80).toLowerCase();
  const district = clean(info.district, 80);
  const agency = clean(info.agency, 80);
  if (department === "lima") {
    const zone = await withDeliveryDb(async (database) => {
      const districtInfo = await database.collection("delivery_districts").findOne({
        district_name: { $regex: new RegExp("^" + escapeRegex(district) + "$", "i") },
        active: true,
      });
      if (!districtInfo || !districtInfo.zone_id) return null;
      return database.collection("delivery_zones").findOne({
        _id: districtInfo.zone_id,
        active: true,
      });
    });
    if (!zone) return { error: "Ese distrito no tiene cobertura de delivery." };
    return {
      price: Math.max(0, Number(zone.price) || 0),
      type: "zone",
      zone: {
        zone_name: zone.zone_name || "",
        zone_id: zone.zone_id || "",
        price: Math.max(0, Number(zone.price) || 0),
      },
    };
  }
  if (!agency) return { error: "Selecciona la agencia de transporte." };
  const found = await withDeliveryDb((database) =>
    database.collection("delivery_agencies").findOne({ agency_code: agency })
  );
  if (!found) return { error: "La agencia de transporte no es válida." };
  return {
    price: 0,
    type: "agency",
    agencyName: found.agency_name || agency,
    agencyCode: agency,
  };
}

export default async (req, res) => {
  await midd(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const methods = await PaymentMethod.find({ active: true });
    const rawOffices = await Office.find({ active: { $ne: false } });
    const offices = (rawOffices || []).map((o) => ({
      id: o.id,
      name: o.name,
      address: o.address || "",
      phone: o.phone || "",
      horario: o.horario || "",
      googleMapsUrl: o.googleMapsUrl || "",
    }));

    return res.json(
      success({
        paymentMethods: (methods || []).map((method) => ({
          id: method.id,
          name: method.banco,
          account: method.cuenta,
          holder: method.titular,
          type: method.tipo,
          cci: method.cci || "",
        })),
        offices,
      })
    );
  }

  if (req.method !== "POST") return res.status(405).json(error("Método no permitido"));

  const body = req.body || {};
  const userId = clean(body.userId, 80);
  const buyer = body.buyer || {};
  const delivery = body.delivery || {};
  const proof = body.proof || {};
  const payMethod = clean(body.pay_method, 20);
  const items = Array.isArray(body.products) ? body.products : [];
  const shippingMethod = clean(body.shipping_method, 20) === "pickup" ? "pickup" : "delivery";
  const officeId = clean(body.office_id, 80);

  if (!userId) return res.json(error("Tienda no válida"));
  const owner = await User.findOne({ id: userId });
  if (!owner) return res.json(error("Tienda no encontrada"));

  const name = clean(buyer.name, 80);
  const document = clean(buyer.document, 12);
  const phone = clean(buyer.phone, 12);
  const email = clean(buyer.email, 120);
  if (name.length < 3) return res.json(error("Escribe el nombre de quien recibe o retira."));
  if (!/^\d{8}$/.test(document)) return res.json(error("El DNI debe tener 8 dígitos."));
  if (!/^\d{9}$/.test(phone)) return res.json(error("El celular debe tener 9 dígitos."));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.json(error("El correo no es válido."));
  }

  let office = null;
  const address = clean(delivery.address, 160);
  if (shippingMethod === "pickup") {
    if (!officeId) return res.json(error("Selecciona el punto de entrega."));
    office = await Office.findOne({ id: officeId, active: { $ne: false } });
    if (!office) return res.json(error("El punto de entrega no es válido."));
  } else {
    if (address.length < 5) return res.json(error("Escribe la dirección de entrega."));
    if (!clean(delivery.department, 80) || !clean(delivery.province, 80) || !clean(delivery.district, 80)) {
      return res.json(error("Completa departamento, provincia y distrito."));
    }
  }

  if (payMethod !== "bank" && payMethod !== "credit-card") {
    return res.json(error("Selecciona un método de pago."));
  }
  if (!items.length || items.length > 30) return res.json(error("El pedido no tiene productos válidos."));

  const proofType = clean(proof.type, 20) === "factura" ? "factura" : "boleta";
  if (proofType === "factura") {
    if (!/^\d{11}$/.test(clean(proof.ruc, 11))) return res.json(error("El RUC debe tener 11 dígitos."));
    if (clean(proof.razonSocial, 120).length < 3) return res.json(error("Escribe la razón social."));
  }

  const catalog = filterSifrahCatalogProducts(await Product.find({}));
  const byId = new Map(catalog.map((product) => [String(product.id), product]));
  const products = [];
  for (const item of items) {
    const qty = Number(item.total);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 20 || Math.floor(qty) !== qty) {
      return res.json(error("La cantidad de un producto no es válida."));
    }
    const dbProduct = byId.get(String(item.id));
    if (!dbProduct || isPromotionProduct(dbProduct) || isSavingsOnlyProduct(dbProduct)) {
      return res.json(error("Hay un producto que no está disponible en esta tienda."));
    }
    const publicPrice = Number(dbProduct.public_price);
    const socio = Number(dbProduct.price_socio);
    const unit =
      publicPrice > 0
        ? publicPrice
        : socio > 0
        ? socio
        : Number(dbProduct.price) || 0;
    if (unit <= 0) return res.json(error("Hay un producto sin precio."));
    products.push({
      id: dbProduct.id,
      name: dbProduct.name,
      total: qty,
      price: unit,
      // Snapshot del precio socio: la ganancia del socio se calcula al aprobar
      price_socio: socio > 0 ? socio : 0,
      points: Number(dbProduct.points) || 0,
    });
  }

  let quote = { price: 0, type: "pickup" };
  if (shippingMethod === "delivery") {
    try {
      quote = await deliveryQuote(delivery);
    } catch (err) {
      return res.json(error("No se pudo calcular el delivery."));
    }
    if (quote.error) return res.json(error(quote.error));
  }

  const goods = products.reduce((sum, item) => sum + item.price * item.total, 0);
  const price = goods + quote.price;
  const points = products.reduce((sum, item) => sum + item.points * item.total, 0);
  const total = products.reduce((sum, item) => sum + item.total, 0);

  let voucher = null;
  let voucherNumber = null;
  let bank = null;
  let bankInfo = null;
  let transactionId = null;
  let authorizationCode = null;

  if (payMethod === "bank") {
    voucher = clean(body.voucher, 500);
    voucherNumber = clean(body.voucher_number, 40);
    bank = clean(body.bank, 80);
    if (!voucher.startsWith("https://") || !voucherNumber || !bank) {
      return res.json(error("Sube el comprobante y escribe el número de operación."));
    }
    const dupAct = await Activation.findOne({
      $or: [{ voucher_number: voucherNumber }, { voucher_number2: voucherNumber }],
      status: { $in: ["approved", "pending"] },
    });
    const dupAff = await Affiliation.findOne({
      $or: [{ voucher_number: voucherNumber }, { voucher_number2: voucherNumber }],
      status: { $in: ["approved", "pending"] },
    });
    if (dupAct || dupAff) {
      return res.json(error("Ese número de operación ya fue registrado."));
    }
    bankInfo = body.bank_info && typeof body.bank_info === "object" ? body.bank_info : { name: bank };
    const voucher2 = clean(body.voucher2, 500);
    const voucherNumber2 = clean(body.voucher_number2, 40);
    if (voucher2 || voucherNumber2) {
      if (!voucher2.startsWith("https://") || !voucherNumber2) {
        return res.json(error("El segundo comprobante necesita su foto y su número de operación."));
      }
      if (voucherNumber2 === voucherNumber) {
        return res.json(error("Los dos comprobantes no pueden tener el mismo número de operación."));
      }
      const dup2 = await Activation.findOne({
        $or: [{ voucher_number: voucherNumber2 }, { voucher_number2: voucherNumber2 }],
        status: { $in: ["approved", "pending"] },
      });
      const dupAff2 = await Affiliation.findOne({
        $or: [{ voucher_number: voucherNumber2 }, { voucher_number2: voucherNumber2 }],
        status: { $in: ["approved", "pending"] },
      });
      if (dup2 || dupAff2) return res.json(error("Ese número de operación ya fue registrado."));
      body._voucher2 = voucher2;
      body._voucherNumber2 = voucherNumber2;
    }
  } else {
    transactionId = clean(body.transaction_id, 80);
    authorizationCode = clean(body.authorization_code, 80);
    if (!transactionId) return res.json(error("El pago con tarjeta no se completó."));
  }

  const openPeriods = await Period.find({ status: "open" });
  let period = null;
  if (openPeriods && openPeriods.length) {
    openPeriods.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    period = openPeriods[0];
  }

  const orderId = rand();
  await Activation.insert({
    id: orderId,
    date: new Date(),
    userId: owner.id,
    channel: "shared_store",
    products,
    price,
    points,
    total,
    period_key: period ? period.key : null,
    period_label: period ? period.label : null,
    check: false,
    voucher,
    voucher2: body._voucher2 || null,
    voucher_number2: body._voucherNumber2 || null,
    transactions: [],
    amounts: [],
    office: shippingMethod === "pickup" ? officeId : null,
    status: "pending",
    delivered: false,
    pay_method: payMethod,
    bank,
    bank_info: bankInfo,
    voucher_number: voucherNumber,
    transaction_id: transactionId || null,
    authorization_code: authorizationCode || null,
    buyer: { name, document, phone, email },
    proof: {
      type: proofType,
      document: proofType === "boleta" ? document : "",
      ruc: proofType === "factura" ? clean(proof.ruc, 11) : "",
      razon_social: proofType === "factura" ? clean(proof.razonSocial, 120) : "",
      direccion_fiscal: proofType === "factura" ? clean(proof.direccionFiscal, 160) : "",
    },
    delivery_info: {
      method: shippingMethod,
      has_delivery: shippingMethod === "delivery",
      ...(shippingMethod === "pickup"
        ? {
            office_id: officeId,
            office_name: office ? office.name : "",
            office_address: office ? office.address || "" : "",
            office_phone: office ? office.phone || "" : "",
            recipient_name: name,
            recipient_document: document,
            recipient_phone: phone,
          }
        : {
            recipient_name: name,
            recipient_document: document,
            recipient_phone: phone,
            location: {
              department: clean(delivery.department, 80),
              province: clean(delivery.province, 80),
              district: clean(delivery.district, 80),
            },
            delivery_price: quote.price,
            delivery_type: quote.type,
            delivery_address: address,
            ...(quote.zone ? { zone_info: quote.zone } : {}),
            ...(quote.agencyCode
              ? { agency_info: { agency_name: quote.agencyName, agency_code: quote.agencyCode } }
              : {}),
          }),
    },
  });

  return res.json(success({ orderNumber: orderId, id: orderId, total: price }));
};
