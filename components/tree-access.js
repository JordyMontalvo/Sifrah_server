// Control de acceso al árbol genealógico.
//
// Los endpoints del árbol aceptan el identificador del nodo a consultar, porque
// la aplicación necesita ir bajando por la red al desplegar los nodos. Sin
// comprobación, ese parámetro permite pedir el nodo de cualquier socio y obtener
// su documento de identidad, correo y teléfono.
//
// El árbol solo enlaza hacia abajo: cada nodo guarda sus hijos y el campo
// parentId está vacío en todos los documentos. Por eso la pertenencia se
// resuelve descendiendo desde el nodo del propio usuario, no subiendo desde el
// nodo pedido.
import db from "./db";

const { Tree } = db;

// Indica si targetId es el propio nodo o cuelga de él, usando una lista de
// nodos ya cargada en memoria.
export function isSelfOrDownline(nodes, rootId, targetId) {
  if (rootId == null || targetId == null) return false;

  const root = String(rootId);
  const target = String(targetId);
  if (root === target) return true;

  const childrenById = new Map();
  for (const node of nodes || []) {
    if (!node) continue;
    childrenById.set(String(node.id), (node.childs || []).map(String));
  }

  // Recorrido hacia abajo con parada en cuanto se encuentra el nodo. El conjunto
  // de visitados evita quedarse en bucle si los datos tuvieran una referencia
  // circular.
  const visited = new Set([root]);
  const pending = [...(childrenById.get(root) || [])];
  while (pending.length) {
    const current = pending.pop();
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const children = childrenById.get(current);
    if (children) pending.push(...children);
  }

  return false;
}

// Igual que la anterior, pero trayendo el árbol de la base de datos. Son unos
// setecientos nodos de dos campos, del orden de decenas de kilobytes.
export async function canViewNode(rootId, targetId) {
  if (rootId == null || targetId == null) return false;
  if (String(rootId) === String(targetId)) return true;

  const nodes = await Tree.find({});
  return isSelfOrDownline(nodes, rootId, targetId);
}
