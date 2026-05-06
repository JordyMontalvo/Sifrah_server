import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Product } = db
const { success, error, midd } = lib

export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  // Validar sesión
  const sessionDoc = await Session.findOne({ value: session })
  if (!sessionDoc) return res.json(error('invalid session'))

  // Validar usuario
  const user = await User.findOne({ id: sessionDoc.id })
  if (!user) return res.json(error('user not found'))

  if (req.method === 'GET') {
    try {
      // Obtener solo productos habilitados para Bono Ahorro
      // Optimizamos la consulta trayendo solo lo necesario
      const products = await Product.find({ is_savings_bonus: true })
      
      // Formatear la respuesta para que la App la consuma directamente
      const formattedProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        sub: p.savings_description || p.subdescription || p.type,
        price: p.savings_price || p.price,
        img: p.savings_img || p.img,
        description: p.savings_description || p.description,
        type: p.type,
        catalog_type: p.catalog_type || (p.points ? 'both' : 'savings')
      }))

      return res.json(success({
        products: formattedProducts
      }))
    } catch (e) {
      console.error("[Savings Bonus API Error]", e)
      return res.json(error('server error'))
    }
  }

  // Reservado para futuras implementaciones (canjes)
  if (req.method === 'POST') {
    return res.json(error('method not allowed'))
  }
}
