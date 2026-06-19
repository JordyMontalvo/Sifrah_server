import db from "../../../components/db"
import lib from "../../../components/lib"
import { requireAdmin } from "../../../components/adminAuth";

const { Office, Product, Recharge } = db
const { success, error, midd } = lib

function normalizeOfficeProducts(office, products) {
  if (!Array.isArray(office.products)) {
    office.products = []
  }

  for (const product of products) {
    const exists = office.products.find((e) => e.id == product.id)
    if (!exists) {
      office.products.push({
        id: product.id,
        total: 0,
      })
    }
  }

  office.products = office.products.map((p) => {
    const product = products.find((e) => e.id == p.id)
    return {
      ...p,
      name: product ? product.name : (p.name || "Producto"),
    }
  })

  return office
}

export default async (req, res) => {
  await midd(req, res)
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    let offices = await Office.find({})
    const products = await Product.find({})
    const recharges = await Recharge.find({})

    for (const office of offices) {
      normalizeOfficeProducts(office, products)
    }

    if (req.method == 'GET') {
      offices = offices.map((office) => {
        office.recharges = recharges.filter((r) => r.office_id == office.id)
        return office
      })

      return res.json(success({ offices }))
    }

  if(req.method == 'POST') {

    const { id, products: bodyProducts, office } = req.body
    // console.log({ products })

    if(bodyProducts) {
      const office = offices.find(e => e.id == id)
      if (!office) {
        return res.status(404).json(error('office not found'))
      }
      normalizeOfficeProducts(office, products)

      bodyProducts.forEach((p, i) => {
        if (office.products[i]) {
          office.products[i].total += bodyProducts[i].total
        }
      })

      // console.log(office)

      await Office.update(
        { id },
        { products: office.products }
      )

      await Recharge.insert({
        date:    new Date(),
        office_id: id,
        products: bodyProducts
      })

    }

    if(office) {
      console.log(' update office ', office)
      
      if(id) {
        // Actualizar oficina existente
        await Office.update(
          { id },
          {
            phone:    office.phone,
            name:     office.name,
            address:  office.address,
            googleMapsUrl: office.googleMapsUrl,
            accounts: office.accounts,
            horario:  office.horario,
            dias:     office.dias,
          }
        )
      } else {
        // Crear nueva oficina
        const newOffice = {
          id: Date.now().toString(), // Generar ID único
          phone: office.phone,
          name: office.name,
          address: office.address,
          googleMapsUrl: office.googleMapsUrl || "",
          accounts: office.accounts || "",
          horario: office.horario || "",
          dias: office.dias || "",
          active: true, // Nueva oficina activa por defecto
          products: [], // Inicializar array de productos vacío
          recharges: [] // Inicializar array de recargas vacío
        }
        
        await Office.insert(newOffice)
        
        // Retornar la nueva oficina creada
        return res.json(success({ office: newOffice }))
      }
    }

    // Solo retornar success() si no se creó una nueva oficina
    return res.json(success())
  }

  if(req.method == 'DELETE') {
    const { id } = req.body

    if(!id) {
      return res.status(400).json({ error: true, message: 'ID de oficina requerido' })
    }

    try {
      // Desactivar la oficina en lugar de eliminarla (soft delete)
      await Office.update({ id }, { active: false })
      
      return res.json(success({ message: 'Oficina desactivada exitosamente' }))
    } catch (error) {
      console.error('Error al desactivar oficina:', error)
      return res.status(500).json({ error: true, message: 'Error interno del servidor' })
    }
  }

  if(req.method == 'PATCH') {
    const { id, action } = req.body

    if(!id) {
      return res.status(400).json({ error: true, message: 'ID de oficina requerido' })
    }

    try {
      if(action === 'reactivate') {
        // Reactivar oficina desactivada
        await Office.update({ id }, { active: true })
        return res.json(success({ message: 'Oficina reactivada exitosamente' }))
      }
      
      return res.status(400).json({ error: true, message: 'Acción no válida' })
    } catch (error) {
      console.error('Error al reactivar oficina:', error)
      return res.status(500).json({ error: true, message: 'Error interno del servidor' })
    }
  }
  } catch (err) {
    console.error('admin/offices error:', err)
    return res.status(500).json(error(err.message || 'internal server error'))
  }
}
