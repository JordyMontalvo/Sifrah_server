import Cors from 'cors'

class Lib {

  constructor() {
    this.cors = Cors({ methods: ['GET', 'POST'] })

    this.midd = this.midd.bind(this)
  }

  rand ()       { return Math.random().toString(36).substr(2) }
  error(msg)    { return { error: true, msg }}
  success(opts) { return { error: false, ...opts }}

  midd(req, res) {
    return new Promise((resolve, reject) => {
      this.cors(req, res, (result) => {
        if (result instanceof Error) return reject(result)
        return resolve(result)
      })
    })
  }

  acum(a, query, field) {

    const x = Object.keys(query)[0]
    const y = Object.values(query)[0]

    return a
      .filter(i => i[x] == y)
      .map(i => i[field])
      .reduce((a, b) => a + b, 0)
  }

  ids(a) {
    return a.map(i => i.userId)
  }
  _ids(a) {
    return a.map(i => i.id)
  }
  parent_ids(a) {
    return a.map(i => i.parentId)
  }

  map(a) {
    return new Map(a.map(i => [i.id, i]))
  }
  _map(a) {
    return new Map(a.map(i => [i.userId, i]))
  }

  model(obj, model) {
    let ret = {}

    for(let key in obj)
      if(model.includes(key))
        ret[key] = obj[key]

    return ret
  }
}

export default new Lib()
