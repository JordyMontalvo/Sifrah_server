import db from "../../../components/db"
import lib from "../../../components/lib"

const { Tree, User } = db
const { success, midd, map, error } = lib

let tree, users, is_found


function find(id, n) {

  if(n == 100) return

  const node = tree.find(e => e.id == id)


  if(node.childs.length == 0) return


  node.childs.forEach(_id => {
    find(_id, n+1)
  })

  node._childs = []

  node.childs.forEach(_id => {
    const _node = tree.find(e => e.id == _id)
    node._childs.push(_node)
  })
}


function found(id, __id) {
  const node = tree.find(e => e.id == id)

  node.childs.forEach(_id => {
    if(_id == __id) is_found = true

    found(_id, __id)
  })
}

export default async (req, res) => {
  await midd(req, res)

  tree  = await Tree.find({})

  users = await User.find({ tree: true })

  tree.forEach(node => {
    const user = users.find(e => e.id == node.id)
    // node.name = user.name + ' ' + user.lastName
    node.name = user.name
    node.dni  = user.dni
  })

  if(req.method == 'GET') {
    console.log('GET ...')
    // get tree

    find('5f0e0b67af92089b5866bcd0', 0)

    const node = tree.find(e => e.id == '5f0e0b67af92089b5866bcd0')
    console.log(node)

    // response
    return res.json(success({
      node
    }))
  }

  if(req.method == 'POST') {
    // console.log('POST ...')
    const { to: _to, from: _from } = req.body

    const to   = tree.find(e => e.dni == _to)   ; console.log({ to })
    const from = tree.find(e => e.dni == _from) ; console.log({ from })

    if(!to)   return res.json(error(`no existe ${_to} en el árbol`))
    if(!from) return res.json(error(`no existe ${_from} en el árbol`))

    // validate
    is_found = false
    found(to.id, from.id)

    if(is_found) return res.json(error(`movimiento inválido`))

    // move

    const parent_to = tree.find(e => e.id == to.parent) /*; console.log({ parent_to })*/

    const i = parent_to.childs.indexOf(to.id) /*; console.log({ i })*/
    parent_to.childs.splice(i, 1) /*; console.log({ parent_to })*/

    await Tree.update({ id: parent_to.id}, {
      childs: parent_to.childs
    })

    from.childs.push(to.id) /*; console.log({ from })*/

    await Tree.update({ id: from.id}, {
      childs: from.childs
    })

    to.parent = from.id /*; console.log({ to })*/

    await Tree.update({ id: to.id}, {
      parent: to.parent
    })

    // Actualizar los puntos del padre anterior (si existe)
    if (parent_to && parent_to.id) {
      await lib.updateTotalPointsCascade(User, Tree, parent_to.id)
    }

    // Actualizar los puntos del nuevo padre
    if (from && from.id) {
      await lib.updateTotalPointsCascade(User, Tree, from.id)
    }

    return res.json(success())
  }
}
