import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Product, Activation, Office, Transaction, Period } = db
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
      const products = await Product.find({ is_savings_bonus: true })

      const formattedProducts = products.map((p) => ({
        id: p.id,
        name: p.name,
        sub: p.savings_description || p.subdescription || p.type,
        price: p.savings_price || p.price,
        img: p.savings_img || p.img,
        description: p.savings_description || p.description,
        type: p.type,
        catalog_type: p.catalog_type || (p.points ? "both" : "savings"),
      }))

      const transactions = await Transaction.find({
        user_id: user.id,
        virtual: { $in: [null, false] },
      })
      const savingsBalance = lib.calcSavingsBonusBalance(transactions)

      return res.json(
        success({
          products: formattedProducts,
          savingsBalance,
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

      const catalog = await Product.find({ is_savings_bonus: true })
      const catalogMap = new Map(catalog.map((p) => [String(p.id), p]))

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
