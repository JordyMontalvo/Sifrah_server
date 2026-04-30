import db from "../../../components/db"
import lib from "../../../components/lib"

const { AgendaEvent } = db
const { error, success, midd } = lib

const handler = async (req, res) => {
  if (req.method == "GET") {
    try {
      const events = await AgendaEvent.find({ status: "Publicado" });
      return res.json(success({ events }));
    } catch (err) {
      console.error(err);
      return res.json(error("Error fetching agenda"));
    }
  }
};

export default async (req, res) => {
  await midd(req, res);
  return handler(req, res);
};
