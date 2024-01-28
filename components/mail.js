const DOMAIN = process.env.DOMAIN
const apiKey = process.env.MAILGUN_KEY
const domain = process.env.MAILGUN_DOMAIN

const mailgun = require('mailgun-js')({ apiKey, domain })

class Mail {

  async welcome(email, check) {

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
    <style type="text/css">
      @import url('https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&display=swap');

      body {
        font-family: 'Lato', sans-serif;
        color: #2A2A2A;
      }

      #wrapper {
        max-width: 800px;
        border-radius: 4px;
        margin: auto;
        background-color: #f6f8f9;
        padding: 24px 16px;
        text-align: center;
      }

      img {
        width: 220px
      }

      a {
        display: inline-block;
        text-decoration: none;
        background-color: #0093cb;
        color: #fff;
        padding: 12px 24px;
        border-radius: 24px;
      }
    </style>
    </head>
    <body>

      <div id="wrapper" style="max-width: 800px;border-radius: 4px;margin: auto;background-color: #f6f8f9;padding: 24px 16px;text-align: center;">
        <img src="https://obeglobalvirtual.com/logo.png" style="width: 220px;">
        <h1>Bienvenido a OBE Global Perú</h1>
        <p>Haga click en el enlace a continuación para iniciar sesión en su oficina.</p>
        <a href="${DOMAIN}/login" style="display: inline-block;text-decoration: none;background-color: #0093cb;color: #fff;padding: 12px 24px;border-radius: 24px;">Ingresar a mi oficina</a>
      </div>

    </body>
    </html>
    `
    const data = {
      from:    'OBE Global Perú <admin@obeglobalvirtual.com>',
      to:       email,
      subject: 'Bienvenido a OBE Global Perú',
      html,
    }

    return await mailgun.messages().send(data)
  }
}

const mail = new Mail()

export default mail


// const html = `
// <!DOCTYPE html>
// <html>
// <head>
// <style type="text/css">
//   @import url('https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&display=swap');

//   body {
//     font-family: 'Lato', sans-serif;
//     color: #2A2A2A;
//   }

//   #wrapper {
//     max-width: 800px;
//     border-radius: 4px;
//     margin: auto;
//     background-color: #f6f8f9;
//     padding: 24px 16px;
//     text-align: center;
//   }

//   img {
//     width: 220px
//   }

//   a {
//     display: inline-block;
//     text-decoration: none;
//     background-color: #0093cb;
//     color: #fff;
//     padding: 12px 24px;
//     border-radius: 24px;
//   }
// </style>
// </head>
// <body>

//   <div id="wrapper" style="max-width: 800px;border-radius: 4px;margin: auto;background-color: #f6f8f9;padding: 24px 16px;text-align: center;">
//     <img src="https://obeglobalvirtual.com/logo.png" style="width: 220px;">
//     <h1>Bienvenido a OBE Global Perú</h1>
//     <p>Haga click en el enlace a continuación para confirmar su correo electrónico.</p>
//     <a href="${DOMAIN}/check/${check}" style="display: inline-block;text-decoration: none;background-color: #0093cb;color: #fff;padding: 12px 24px;border-radius: 24px;">Confirmar email</a>
//   </div>

// </body>
// </html>
// `
