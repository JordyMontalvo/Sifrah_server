import db  from "../../../components/db"
import lib from "../../../components/lib"

const { Session } = db
const { midd } = lib


const Logout = async (req, res) => {

  let { session } = req.body

  // El identificador de la sesión se guarda en el campo value. Al pasar la
  // cadena suelta, delete la interpretaba como { id: ... }, que es el
  // identificador del usuario, así que no se borraba nada y el token seguía
  // siendo válido indefinidamente después de cerrar sesión.
  //
  // Se exige explícitamente una cadena: si se admitiera un objeto, bastaría con
  // enviar un operador de consulta para cerrar de golpe las sesiones de todos
  // los usuarios.
  if (typeof session === "string" && session.trim()) {
    await Session.deleteMany({ value: session.trim() })
  }

  return res.end()
}

export default async (req, res) => { await midd(req, res); return Logout(req, res) }
