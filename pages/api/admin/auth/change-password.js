import bcrypt from "bcrypt";
import db from "../../../../components/db";
import lib from "../../../../components/lib";
import { requireAdmin } from "../../../../components/adminAuth";

const { User, Session } = db;
const { error, success, midd } = lib;

export default async (req, res) => {
  await midd(req, res);

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method !== "POST") return res.status(405).json(error("method not allowed"));

  const { oldPassword, newPassword, revokeOthers = true } = req.body || {};
  if (!oldPassword || !newPassword) return res.json(error("missing password"));

  const user = await User.findOne({ id: auth.user.id });
  const ok = await bcrypt.compare(String(oldPassword), String(user.password || ""));
  if (!ok) return res.json(error("invalid password"));

  const hashed = await bcrypt.hash(String(newPassword), 12);
  await User.update({ id: user.id }, { password: hashed });

  if (revokeOthers) {
    await Session.deleteMany({ id: user.id, kind: "admin", value: { $ne: auth.value } });
  }

  return res.json(success({}));
};

