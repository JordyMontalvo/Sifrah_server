const { MongoClient } = require("mongodb");
const uri = process.env.DB_URL || process.env.MONGODB_URI;
const DNI = "73233003";

async function main() {
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db("sifrah");
  const u = await db.collection("users").findOne({ dni: DNI });
  if (!u) {
    console.log("No encontrado");
    return;
  }

  const affs = await db
    .collection("affiliations")
    .find({ userId: u.id })
    .toArray();
  const acts = await db
    .collection("activations")
    .find({ userId: u.id })
    .toArray();

  console.log("Usuario:", u.name, u.lastName);
  console.log("plan:", u.plan, "affiliation_points:", u.affiliation_points);
  console.log("\nTodas las afiliaciones:");
  affs.forEach((a) =>
    console.log(
      a.status,
      a.plan?.id,
      a.plan?.name,
      a.plan?.affiliation_points,
      "pk",
      a.period_key,
      "date",
      a.date,
      "approved",
      a.approved_at
    )
  );

  console.log("\nActivaciones:");
  acts.forEach((a) =>
    console.log(a.status, a.points, a.date, a.approved_at)
  );

  // 1020 = 120 + 900 (basic + master) o 450 + 570?
  console.log("\n1020 = basic(120)+master(900)?", 120 + 900);
  console.log("1020 = standard(450)+master(900)?", 450 + 900);

  // Lily parent? user id iqo971 - check children affiliations in may
  const mayAffs = await db
    .collection("affiliations")
    .find({
      userId: u.id,
      period_key: "2026-05",
    })
    .toArray();
  console.log("\nAffs periodo 2026-05:", mayAffs.length);

  // Search voucher or duplicate user
  const usersLike = await db
    .collection("users")
    .find({
      $or: [
        { name: /Shirle/i },
        { lastName: /Souza/i },
        { email: u.email },
      ],
    })
    .toArray();
  console.log(
    "\nUsuarios similares:",
    usersLike.map((x) => ({ dni: x.dni, id: x.id, pts: x.affiliation_points }))
  );

  // Afiliaciones cercanas en fecha (mismo día que Shirle)
  const nearby = await db
    .collection("affiliations")
    .find({
      date: {
        $gte: new Date("2026-05-11T00:00:00.000Z"),
        $lt: new Date("2026-05-13T00:00:00.000Z"),
      },
    })
    .toArray();

  console.log("\nAfiliaciones 11-12 mayo (todas):");
  for (const a of nearby) {
    const ux = await db.collection("users").findOne({ id: a.userId });
    console.log(
      ux?.dni,
      ux?.name,
      a.status,
      a.plan?.id,
      a.plan?.affiliation_points,
      a.id
    );
  }

  // ¿Lily misma línea? Shirle es parent de lily en tree
  const tree = await db.collection("tree").findOne({ id: u.id });
  console.log("\nTree node childs count:", tree?.childs?.length);
  console.log("user.date registro:", u.date);

  // Regla negocio reportada: distribuidor(450) + ? = 1020
  console.log("\nInterpretaciones de 1020:");
  console.log("  Ejecutivo(120) + Empresario(900) =", 120 + 900);
  console.log("  Distribuidor(450) + Empresario(900) =", 450 + 900);
  console.log("  Distribuidor(450) + delta master-standard =", 450 + (900 - 450));

  await client.close();
}

main().catch(console.error);
