import db from "../../../components/db"
import lib from "../../../components/lib"
import { requireAdmin } from "../../../components/adminAuth";

const { AgendaEvent } = db
const { error, success, midd, rand } = lib

const handler = async (req, res) => {
  if (req.method == "GET") {
    try {
      const events = await AgendaEvent.find({});
      return res.json(success({ events }));
    } catch (err) {
      console.error(err);
      return res.json(error("Error fetching agenda"));
    }
  }

  if (req.method == "POST") {
    const { action, event, id } = req.body;

    if (action == "insert") {
      event.id = rand() + rand();
      event.createdAt = new Date();
      await AgendaEvent.insert(event);
      return res.json(success({ event }));
    }

    if (action == "update") {
      const { id: eventId, _id, ...values } = event;
      await AgendaEvent.update({ id: eventId }, values);
      return res.json(success());
    }

    if (action == "delete") {
      await AgendaEvent.delete({ id });
      return res.json(success());
    }
  }
};

export default async (req, res) => {
  await midd(req, res);
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  return handler(req, res);
};
