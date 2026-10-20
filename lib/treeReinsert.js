// Reincorpora un nodo al arbol como DIRECTO de su patrocinador, sin reconstruir
// su downline antigua (su childs actual se conserva). Se usa al restaurar una
// cuenta eliminada: la compresion hecha al eliminar se respeta y solo vuelve a
// colgar este nodo de su patrocinador. Idempotente: si ya figura en el arbol no
// duplica. Mismo patron que register.js al reparar el arbol.
//
// Modulo puro (sin IO propio): recibe las colecciones Tree y User como
// dependencias, por lo que es testeable con dobles en memoria.
//
// @returns {Promise<boolean>} true si realizo algun cambio estructural.
async function reinsertIntoSponsorTree(Tree, User, user) {
  if (!user || !user.parentId) return false;

  const sponsor = await User.findOne({ id: user.parentId });
  if (!sponsor) return false;

  const sponsorNodeId =
    sponsor.coverage && sponsor.coverage.id ? sponsor.coverage.id : sponsor.id;
  const parentNode = await Tree.findOne({ id: sponsorNodeId });
  if (!parentNode) return false;

  let changed = false;

  const parentChilds = parentNode.childs || [];
  if (!parentChilds.some((c) => String(c) === String(user.id))) {
    await Tree.update({ id: sponsorNodeId }, { childs: [...parentChilds, user.id] });
    changed = true;
  }

  const ownNode = await Tree.findOne({ id: user.id });
  if (ownNode) {
    await Tree.update({ id: user.id }, { parent: sponsorNodeId, childs: ownNode.childs || [] });
  } else {
    await Tree.insert({ id: user.id, childs: [], parent: sponsorNodeId });
    changed = true;
  }

  return changed;
}

module.exports = { reinsertIntoSponsorTree };
