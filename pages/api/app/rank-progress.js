import db from "../../../components/db"
import lib from "../../../components/lib"
import { computeRankProgress } from "../../../lib/rankProgress"

const { User, Session, Tree } = db
const { error, success, midd } = lib

export default async (req, res) => {
  await midd(req, res)

  const { session: sessionToken } = req.query

  const session = await Session.findOne({ value: sessionToken })
  if (!session) return res.json(error("invalid session"))

  const user = await User.findOne({ id: session.id })
  if (!user) return res.json(error("user not found"))

  if (!user.tree && !user.affiliated) {
    return res.json(error("user not in tree"))
  }

  try {
    const [treeList, usersList] = await Promise.all([
      Tree.find({}),
      User.find({ tree: true }),
    ])

    const progress = computeRankProgress(user, usersList, treeList)

    return res.json(
      success({
        progress,
      })
    )
  } catch (e) {
    console.error("[rank-progress]", e)
    return res.json(error("could not compute rank progress"))
  }
}
