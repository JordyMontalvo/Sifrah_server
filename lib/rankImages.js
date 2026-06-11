const RANK_IMAGE_ID = "rank_images"

const RANK_IMAGE_SLOTS = [
  { key: "activo", label: "Activo" },
  { key: "bronce", label: "Bronce" },
  { key: "plata", label: "Plata" },
  { key: "oro", label: "Oro" },
  { key: "ruby", label: "Ruby" },
  { key: "esmeralda", label: "Esmeralda" },
  { key: "diamante", label: "Diamante" },
  { key: "doble_diamante", label: "Doble diamante" },
  { key: "triple_diamante", label: "Triple diamante" },
  { key: "diamante_imperial", label: "Diamante imperial" },
  { key: "embajador_sifrah", label: "Embajador Sifrah" },
]

const VALID_RANK_IMAGE_KEYS = RANK_IMAGE_SLOTS.map((s) => s.key)

function emptyRankImagesDoc() {
  const doc = { id: RANK_IMAGE_ID }
  for (const slot of RANK_IMAGE_SLOTS) {
    doc[slot.key] = ""
  }
  return doc
}

function getHistoricalRankImageKey(index) {
  if (index < 0 || index >= RANK_IMAGE_SLOTS.length) return null
  return RANK_IMAGE_SLOTS[index].key
}

module.exports = {
  RANK_IMAGE_ID,
  RANK_IMAGE_SLOTS,
  VALID_RANK_IMAGE_KEYS,
  emptyRankImagesDoc,
  getHistoricalRankImageKey,
}
