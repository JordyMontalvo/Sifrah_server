const cors = require('micro-cors')()
const ImageKit = require("imagekit")
const { requireSession } = require("../../../components/adminAuth")

const publicKey = process.env.IMAGEKIT_PUBLIC
const privateKey = process.env.IMAGEKIT_PRIVATE

var imagekit = new ImageKit({
  publicKey,
  privateKey,
  urlEndpoint: "https://ik.imagekit.io/asu/",
})

// Entrega credenciales de subida firmadas: sin sesion cualquiera podia subir
// archivos a la cuenta de ImageKit.
module.exports = cors(async (req, res) => {
  if (req.method === "OPTIONS") return res.status(200).end()

  const auth = await requireSession(req, res)
  if (!auth) return

  return res.json(imagekit.getAuthenticationParameters())
})




// const authenticationParameters = imagekit.getAuthenticationParameters()
// return res.json(authenticationParameters)
