import db from "../../../components/db"
import lib from "../../../components/lib"
import { requireAdmin } from "../../../components/adminAuth";

const { Office, Product, Recharge } = db
const { success, error, midd } = lib

function toPlain(value) {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value))
}

function normalizeOfficeProducts(office, products) {
  const catalog = Array.isArray(products) ? products : []
  let items = Array.isArray(office.products) ? office.products : []

  for (const product of catalog) {
    if (!product || product.id == null) continue
    const exists = items.find((e) => String(e.id) === String(product.id))
    if (!exists) {
      items.push({ id: product.id, total: 0 })
    }
  }

  items = items.map((p) => {
    if (!p || p.id == null) {
      return { id: null, total: 0, name: "Producto" }
    }
    const product = catalog.find((e) => String(e.id) === String(p.id))
    return {
      id: p.id,
      total: Number(p.total) || 0,
      name: product && product.name ? product.name : (p.name || "Producto"),
    }
  })

  office.products = items
  return office
}

async function loadOfficesPayload() {
  const [officesRaw, productsRaw, rechargesRaw] = await Promise.all([
    Office.find({}).catch((e) => {
      console.error("admin/offices Office.find:", e)
      return []
    }),
    Product.find({}).catch((e) => {
      console.error("admin/offices Product.find:", e)
      return []
    }),
    Recharge.find({}).catch((e) => {
      console.error("admin/offices Recharge.find:", e)
      return []
    }),
  ])

  const offices = Array.isArray(officesRaw) ? officesRaw : []
  const products = Array.isArray(productsRaw) ? productsRaw : []
  const recharges = Array.isArray(rechargesRaw) ? rechargesRaw : []

  return offices.map((office) => {
    const row = normalizeOfficeProducts({ ...toPlain(office) }, products)
    row.recharges = recharges.filter(
      (r) => r && String(r.office_id) === String(office.id)
    )
    return row
  })
}

export default async (req, res) => {
  try {
    await midd(req, res)
    const auth = await requireAdmin(req, res)
    if (!auth) return

    if (req.method === "GET") {
      const offices = await loadOfficesPayload()
      return res.json(success({ offices }))
    }

    if (req.method === "POST") {
      const { id, products: bodyProducts, office: officeBody } = req.body || {}
      const offices = await loadOfficesPayload()
      const products = await Product.find({}).catch(() => [])

      if (bodyProducts) {
        const office = offices.find((e) => String(e.id) === String(id))
        if (!office) {
          return res.status(404).json(error("office not found"))
        }
        normalizeOfficeProducts(office, products)

        bodyProducts.forEach((p, i) => {
          if (office.products[i] && bodyProducts[i]) {
            office.products[i].total += Number(bodyProducts[i].total) || 0
          }
        })

        await Office.update({ id }, { products: office.products })

        await Recharge.insert({
          date: new Date(),
          office_id: id,
          products: bodyProducts,
        })
      }

      if (officeBody) {
        if (id) {
          await Office.update(
            { id },
            {
              phone: officeBody.phone,
              name: officeBody.name,
              address: officeBody.address,
              googleMapsUrl: officeBody.googleMapsUrl,
              accounts: officeBody.accounts,
              horario: officeBody.horario,
              dias: officeBody.dias,
            }
          )
        } else {
          const newOffice = {
            id: Date.now().toString(),
            phone: officeBody.phone,
            name: officeBody.name,
            address: officeBody.address,
            googleMapsUrl: officeBody.googleMapsUrl || "",
            accounts: officeBody.accounts || "",
            horario: officeBody.horario || "",
            dias: officeBody.dias || "",
            active: true,
            products: [],
            recharges: [],
          }
          await Office.insert(newOffice)
          return res.json(success({ office: newOffice }))
        }
      }

      return res.json(success())
    }

    if (req.method === "DELETE") {
      const { id } = req.body || {}
      if (!id) {
        return res.status(400).json({ error: true, message: "ID de oficina requerido" })
      }
      await Office.update({ id }, { active: false })
      return res.json(success({ message: "Oficina desactivada exitosamente" }))
    }

    if (req.method === "PATCH") {
      const { id, action } = req.body || {}
      if (!id) {
        return res.status(400).json({ error: true, message: "ID de oficina requerido" })
      }
      if (action === "reactivate") {
        await Office.update({ id }, { active: true })
        return res.json(success({ message: "Oficina reactivada exitosamente" }))
      }
      return res.status(400).json({ error: true, message: "Acción no válida" })
    }

    res.statusCode = 405
    return res.json(error("method not allowed"))
  } catch (err) {
    console.error("admin/offices fatal:", err)
    return res.status(500).json(error(err && err.message ? err.message : "internal server error"))
  }
}
