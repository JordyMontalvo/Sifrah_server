import db from "../../../components/db"
import lib from "../../../components/lib"

const { DashboardConfig } = db
const { error, success, midd } = lib

export default async (req, res) => {
  await midd(req, res)

  if(req.method == 'GET') {
    // Obtener configuración del dashboard
    let config = await DashboardConfig.findOne({ id: 'travel_bonus' })
    
    // Si no existe, crear uno por defecto
    if (!config) {
      config = {
        id: 'travel_bonus',
        text: 'Tu progreso hacia el Bono Viaje se actualizará próximamente. ¡Sigue trabajando para alcanzar tus objetivos!'
      }
      await DashboardConfig.insert(config)
    }

    // response
    return res.json(success({ config }))
  }

  if(req.method == 'POST') {
    const { text } = req.body

    if (!text || typeof text !== 'string') {
      return res.json(error('El texto es requerido'))
    }

    // Verificar si existe la configuración
    const existingConfig = await DashboardConfig.findOne({ id: 'travel_bonus' })
    
    if (existingConfig) {
      // Actualizar
      await DashboardConfig.update({ id: 'travel_bonus' }, { text })
    } else {
      // Crear nueva
      await DashboardConfig.insert({
        id: 'travel_bonus',
        text
      })
    }

    return res.json(success({ message: 'Configuración actualizada correctamente' }))
  }
}

