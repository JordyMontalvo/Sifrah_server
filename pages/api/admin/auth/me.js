import db from "../../../../components/db";
import lib from "../../../../components/lib";
import { requireAdmin } from "../../../../components/adminAuth";

const { success, midd } = lib;

export default async (req, res) => {
  await midd(req, res);

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const { user } = auth;
  return res.json(
    success({
      account: {
        id: user.id,
        dni: user.dni,
        name: user.name,
        lastName: user.lastName,
        email: user.email,
        type: user.type,
      },
    })
  );
};

