import db from "../../../components/db";
import lib from "../../../components/lib";
import {
  savingsCatalogMongoFilter,
  isPromotionProduct,
} from "../../../lib/productCatalog";
import {
  countPromotionPurchasedByUser,
  enrichPromotionForStore,
  validatePromotionOrder,
} from "../../../lib/promotionStock";
import { resolveStoreCategories } from "../../../lib/savingsCategoryDefaults";
import { sortProducts } from "../../../lib/productSort";

const { User, Session, Product, Activation, Office, Transaction, Period, SavingsCategory } = db
const { success, error, midd, rand } = lib

const SAVINGS_ORDER_TYPE = "savings_bonus"

async function getOrCreateOpenPeriod(now = new Date()) {
  const openPeriods = await Period.find({ status: "open" })
  if (openPeriods?.length) {
    openPeriods.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return openPeriods[0]
  }
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const key = `${year}-${String(month).padStart(2, "0")}`
  const existing = await Period.findOne({ key })
  if (existing && existing.status !== "closed") return existing
  const period = {
    id: rand(),
    key,
    year,
    month,
    label: `${month}/${year}`,
    status: "open",
    createdAt: now,
    closedAt: null,
  }
  await Period.insert(period)
  return period
}

export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  const sessionDoc = await Session.findOne({ value: session })
  if (!sessionDoc) return res.json(error("invalid session"))

  const user = await User.findOne({ id: sessionDoc.id })
  if (!user) return res.json(error("user not found"))

  if (req.method === "GET") {
    try {
      let products = await Product.find(savingsCatalogMongoFilter())
      products = products.filter((p) => {
        if (!isPromotionProduct(p)) return true
        return p.promotion_active !== false
      })

      products = sortProducts(products)

      const formattedProducts = []
      for (const p of products) {
        const fromSifrah =
          !isPromotionProduct(p) &&
          p.catalog_type !== "savings" &&
          (Number(p.points) > 0 ||
            (p.plans && Object.values(p.plans).some(Boolean)) ||
            (p.code && Number(p.price) > 0));

        let base = {
          id: p.id,
          name: p.name,
          sub: p.savings_description || p.subdescription || p.type,
          price: p.savings_price || p.price,
          img: fromSifrah ? p.img || p.savings_img : p.savings_img || p.img,
          description: p.savings_description || p.description,
          type: p.type,
          savings_category_id: p.savings_category_id || null,
          catalog_type: p.catalog_type || (p.points ? "both" : "savings"),
          is_promotion: !!p.is_promotion,
          points: 0,
        };

        if (isPromotionProduct(p)) {
          const purchased = await countPromotionPurchasedByUser(
            p.id,
            user.id,
            Activation
          );
          base = enrichPromotionForStore(
            { ...base, available_quantity: p.available_quantity },
            purchased
          );
          const max = Number(p.available_quantity) || 0;
          if (max > 0 && base.promotion_remaining === 0) {
            continue;
          }
        }

        formattedProducts.push(base);
      }

      const transactions = await Transaction.find({
        user_id: user.id,
        virtual: { $in: [null, false] },
      })
      const savingsBalance = lib.calcSavingsBonusBalance(transactions)

      const allCategories = await SavingsCategory.find({})
      const categories = resolveStoreCategories(formattedProducts, allCategories)

      return res.json(
        success({
          products: formattedProducts,
          savingsBalance,
          categories,
        })
      )
    } catch (e) {
      console.error("[Savings Bonus API Error]", e)
      return res.json(error("server error"))
    }
  }

  if (req.method === "POST") {
    try {
      let { products, office, deliveryMethod, deliveryInfo } = req.body

      if (!Array.isArray(products) || !products.length) {
        return res.json(error("No hay productos en la orden."))
      }

      const officeId =
        office ||
        (deliveryInfo && deliveryInfo.officeId
          ? String(deliveryInfo.officeId).trim()
          : "")
      if (!officeId) {
        return res.json(error("Selecciona una Oficina de Recojo (PDE)."))
      }

      const officeDoc = await Office.findOne({
        id: officeId,
        active: { $ne: false },
      })
      if (!officeDoc) {
        return res.json(error("La Oficina de Recojo seleccionada no es válida."))
      }

      const catalog = await Product.find(savingsCatalogMongoFilter())
      const catalogMap = new Map(catalog.map((p) => [String(p.id), p]))

      const stockError = await validatePromotionOrder(
        products,
        catalogMap,
        Activation,
        user.id
      )
      if (stockError) {
        return res.json(error(stockError.error))
      }

      products = products.map((item) => {
        const dbProduct = catalogMap.get(String(item.id))
        if (!dbProduct) {
          throw new Error(`Producto no válido para Bono Ahorro: ${item.id}`)
        }
        const qty = Math.max(1, Number(item.total) || 1)
        const unitPrice = Number(dbProduct.savings_price ?? dbProduct.price) || 0
        return {
          id: dbProduct.id,
          name: dbProduct.name,
          type: dbProduct.type,
          img: dbProduct.savings_img || dbProduct.img,
          price: unitPrice,
          total: qty,
          points: 0,
          is_promotion: !!dbProduct.is_promotion,
        }
      })

      const price = products.reduce(
        (sum, p) => sum + Number(p.price) * Number(p.total),
        0
      )
      const total = products.reduce((sum, p) => sum + Number(p.total), 0)

      const userTx = await Transaction.find({
        user_id: user.id,
        virtual: { $in: [null, false] },
      })
      const savingsBalance = lib.calcSavingsBonusBalance(userTx)
      if (price <= 0) return res.json(error("Monto de canje inválido."))
      if (savingsBalance < price) {
        return res.json(error("Saldo Bono Ahorro insuficiente."))
      }

      const period = await getOrCreateOpenPeriod(new Date())
      const redemptionId = rand()
      const holdTxId = rand()

      // Reservar saldo de inmediato (evita doble gasto con varias solicitudes pendientes)
      await Transaction.insert({
        id: holdTxId,
        date: new Date(),
        user_id: user.id,
        type: "out",
        value: price,
        name: "savings_bonus_redemption",
        desc: `Reserva canje Bono Ahorro #${redemptionId} (pendiente)`,
        virtual: false,
        wallet_tipo: "BONO_AHORRO",
        activation_id: redemptionId,
        period_key: period.key,
        period_label: period.label,
      })

      await Activation.insert({
        id: redemptionId,
        date: new Date(),
        userId: user.id,
        products,
        price,
        points: 0,
        total,
        period_key: period.key,
        period_label: period.label,
        check: false,
        pay_method: "savings_bonus",
        order_type: SAVINGS_ORDER_TYPE,
        office: officeId,
        status: "pending",
        delivered: false,
        transactions: [holdTxId],
        amounts: [0, 0, price],
        delivery_info: {
          method: deliveryMethod || "pickup",
          has_delivery: deliveryMethod === "delivery",
          ...(deliveryMethod === "delivery" &&
            deliveryInfo && {
              recipient_name: deliveryInfo.recipientName,
              recipient_document: deliveryInfo.document,
              recipient_phone: deliveryInfo.recipientPhone,
              delivery_price: deliveryInfo.deliveryPrice || 0,
            }),
        },
      })

      return res.json(success({ orderNumber: redemptionId, id: redemptionId }))
    } catch (e) {
      console.error("[Savings Bonus POST]", e)
      if (e.message?.includes("Producto no válido")) {
        return res.json(error(e.message))
      }
      return res.json(error("server error"))
    }
  }

  return res.json(error("method not allowed"))
}
