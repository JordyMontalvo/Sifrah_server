// import db from "../../components/db"

// const { Token } = db

// function makeid(length) {
//    var result           = '';
//    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
//    var charactersLength = characters.length;
//    for ( var i = 0; i < length; i++ ) {
//       result += characters.charAt(Math.floor(Math.random() * charactersLength));
//    }
//    return result;
// }

// export default async (req, res) => {

//   // const n = 100
//   const n = 0
//   // const n = 1

//   for(var i = 0; i < n; i++) {

//     const token = makeid(6)
//     // const token = 'D44F71'

//     // console.log({ token })

//     const _token = await Token.findOne({ value: token })
//     // console.log({ _token })

//     if(_token) {

//       console.log(`token ${token} already exist`)

//     } else {

//       await Token.insert({ value: token, free: true })

//       console.log(`token ${i}: ${token} insert on db`)
//     }
//   }

//   return res.end(`insert new tokens :)`)
// }
