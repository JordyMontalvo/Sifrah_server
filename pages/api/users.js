// import db from "../../components/db"

// const { User } = db

// export default async (req, res) => {

//   const users = await User.find({})

//   for(var i = 0; i < users.length; i++) {
//     if (i >= 80) {
//       const user = users[i]
//       console.log(user.name)

//       if(user.affiliated) {
//         console.log(':)')
//         // UPDATE USER
//         await User.update({ id: user.id }, {
//           points: 0,
//         })
//       }
//     }
//   }

//   return res.end(`update users :)`)
// }
