import bcrypt from 'bcrypt'
import db     from "../../../components/db"
import lib    from "../../../components/lib"

const { User, Transaction } = db
const { error, success, midd, model } = lib

// valid filters
// const q = { all: {}, affiliated: { affiliated: true }, activated: { activated: true } }

// models
const U = ['id', 'date', 'name', 'lastName', 'dni', 'email', 'phone', 'department', 'affiliated', 'activated', 'token', 'points', 'balance', 'parent', 'virtualbalance', 'country', 'rank','birthdate']


const handler = async (req, res) => {
  if (req.method == "GET") {
    console.log("GET ...");

    const { filter, page = 1, limit = 20, search, showAvailable } = req.query;
    console.log(
      "Received request with page:",
      page,
      "and limit:",
      limit,
      "search:",
      search
    );

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const q = {
      all: {},
      affiliated: { affiliated: true },
      activated: { activated: true },
    };

    // validate filter
    if (!(filter in q)) return res.json(error("invalid filter"));

    // get users
    let allUsers = await User.find(q[filter]);

    const transaction = await Transaction.find({
      virtual: { $in: [null, false] },
    }); // Asegúrate de que esta línea esté antes de usar 'transactions'

    // Filtrar usuarios con saldo disponible
    if (showAvailable === "true") {
      allUsers = allUsers.filter((user) => {
        const ins = transaction
          .filter((i) => i.user_id == user.id && i.type == "in")
          .reduce((a, b) => a + parseFloat(b.value), 0);
        const outs = transaction
          .filter((i) => i.user_id == user.id && i.type == "out")
          .reduce((a, b) => a + parseFloat(b.value), 0);
        return ins - outs > 0; // Solo usuarios con saldo disponible
      });
    }

    // Apply search if search parameter exists
    if (search) {
      const searchLower = search.toLowerCase();
      allUsers = allUsers.filter(
        (user) =>
          user.name?.toLowerCase().includes(searchLower) ||
          user.lastName?.toLowerCase().includes(searchLower) ||
          user.dni?.toLowerCase().includes(searchLower) ||
          user.country?.toLowerCase().includes(searchLower) ||
          user.phone?.toLowerCase().includes(searchLower)
      );

      console.log({ allUsers });
    }

    // Ordenar usuarios por fecha (más reciente primero)
    allUsers.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalUsers = allUsers.length;

    // Aplicar paginación
    const skip = (pageNum - 1) * limitNum;
    let users = allUsers.slice(skip, skip + limitNum);

    // Obtener los padres antes de usarlos
    const parentIds = users.filter((i) => i.parentId).map((i) => i.parentId);
    const parents = await User.find({ id: { $in: parentIds } });

    // Asegúrate de que los padres se obtengan antes de usarlos
    users = users.map((user) => {
      if (user.parentId) {
        const i = parents.findIndex((el) => el.id == user.parentId);
        if (i !== -1) {
          user.parent = parents[i]; // Asigna el objeto padre al usuario
        }
      }
      return user; // Asegúrate de devolver el usuario modificado
    });

    const transactions = await Transaction.find({
      virtual: { $in: [null, false] },
    });
    console.log("transactions ...");

    const virtualTransactions = await Transaction.find({ virtual: true });
    console.log("virtualTransactions ...");

    // parse user
    const totalBalance = allUsers.reduce((total, user) => {
      const ins = transactions
        .filter((i) => i.user_id == user.id && i.type == "in")
        .reduce((a, b) => a + parseFloat(b.value), 0);
      const outs = transactions
        .filter((i) => i.user_id == user.id && i.type == "out")
        .reduce((a, b) => a + parseFloat(b.value), 0);
      return total + (ins - outs); // Sumar el saldo de cada usuario
    }, 0);

    // Calcular el saldo no disponible
    const totalVirtualBalance = allUsers.reduce((total, user) => {
      const virtualIns = virtualTransactions
        .filter((i) => i.user_id == user.id && i.type == "in")
        .reduce((a, b) => a + parseFloat(b.value), 0);
      const virtualOuts = virtualTransactions
        .filter((i) => i.user_id == user.id && i.type == "out")
        .reduce((a, b) => a + parseFloat(b.value), 0);
      return total + (virtualIns - virtualOuts); // Sumar el saldo virtual de cada usuario
    }, 0);

    // Calcular el saldo para los usuarios que se están enviando
    users = users.map((user) => {
      const ins = transactions
        .filter((i) => i.user_id == user.id && i.type == "in")
        .reduce((a, b) => a + parseFloat(b.value), 0);
      const outs = transactions
        .filter((i) => i.user_id == user.id && i.type == "out")
        .reduce((a, b) => a + parseFloat(b.value), 0);
      user.balance = ins - outs;

      const virtualIns = virtualTransactions
        .filter((i) => i.user_id == user.id && i.type == "in")
        .reduce((a, b) => a + parseFloat(b.value), 0);
      const virtualOuts = virtualTransactions
        .filter((i) => i.user_id == user.id && i.type == "out")
        .reduce((a, b) => a + parseFloat(b.value), 0);
      user.virtualbalance = virtualIns - virtualOuts;

      return user; // Asegúrate de devolver el usuario modificado
    });
    // console.log({ users })

    // parse user
    users = users.map((user) => {
      const u = model(user, U);
      return { ...u };
    });
    // Cambia esto para obtener todos los usuarios

    // Calcular el saldo total de todos los usuarios

    // response con información de paginación
    return res.json(
      success({
        users,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limitNum),
        currentPage: pageNum,
        totalBalance,
        totalVirtualBalance,
      })
    );
  }


  if(req.method == 'POST') {
    console.log("POST ...")
    
    const { action, id } = req.body
    console.log({ action, id })

    if (action == 'migrate') {
      console.log('migrate ...')

      // migrar transaccinoes virtuales
      const transactions = await Transaction.find({ user_id: id, virtual: true })
      // console.log({ transactions })

      for(let transaction of transactions) {
        console.log({ transaction })

        await Transaction.update({ id: transaction.id }, { virtual: false })
      }
    }

    if (action == 'name') {
      // console.log('edit name ...')

      const { _name, _lastName, _dni, _password, _parent_dni, _points, _rank } = req.body.data
      console.log({ _name, _lastName, _dni, _password, _parent_dni, _points,_rank })

      const user = await User.findOne({ id })

      if(_dni != user.dni) {

        // error dni
        const user2 = await User.findOne({ dni: _dni })

        if(user2) return res.json(error('invalid dni'))
      }

      await User.update({ id }, { name: _name, lastName: _lastName, dni: _dni, points: _points, rank: _rank })

      if(_password) {

        const password = await bcrypt.hash(_password, 12)

        await User.update({ id }, { password })
      }

      if(_parent_dni) {

        const parent = await User.findOne({ dni: _parent_dni })

        if(!parent)              return res.json(error('invalid parent dni'))
        if(parent.id == user.id) return res.json(error('invalid parent dni'))

        await User.update({ id }, { parentId: parent.id })
      }
    }

    // response
    return res.json(success({}))
  }
}

export default async (req, res) => { await midd(req, res); return handler(req, res) }
