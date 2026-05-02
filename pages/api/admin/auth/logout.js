import db from "../../../../components/db";
import lib from "../../../../components/lib";
import { requireAdmin } from "../../../../components/adminAuth";

const { Session } = db;
const { midd, success } = lib;

export default async (req, res) => {
  await midd(req, res);

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const now = new Date();
  await Session.updateOne(
    { value: auth.value },
    {
      closedAt: now,
      closed_at: now.toISOString(),
      closedReason: "logout",
    }
  );
  return res.json(success({}));
};

