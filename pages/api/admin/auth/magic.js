import db from "../../../../components/db"
import lib from "../../../../components/lib"

const { User, Session } = db
const { rand, midd } = lib

export default async (req, res) => {
  await midd(req, res);
  try {
    const { secret } = req.query || {}
    if (secret !== 'sifrah-admin-2024') return res.status(403).send('Forbidden');

    const user = await User.findOne({ dni: 'ADMIN' });
    if (!user) return res.status(404).send('Admin user not found in DB');

    const sessionValue = rand() + rand() + rand();
    await Session.insert({
      id: user.id,
      value: sessionValue,
      kind: 'admin',
      createdAt: new Date(),
      userAgent: req.headers['user-agent'] || '',
      ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
    });

    const account = encodeURIComponent(JSON.stringify({
      id: user.id,
      dni: user.dni,
      name: user.name,
      email: user.email,
      type: user.type
    }));

    const redirectUrl = `https://sifrah-admin.vercel.app/login?token=${sessionValue}&account=${account}`;
    res.writeHead(302, { Location: redirectUrl });
    return res.end();
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
