import mongoose from "mongoose";
import db from "../../../components/db";
import lib from "../../../components/lib";

const { Affiliation, Activation, Collect, Promo } = db;
const { error, success, midd } = lib;

// Conexión a la base de datos
const connectDB = async () => {
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("MongoDB connected");
    } catch (error) {
      console.error("MongoDB connection error:", error);
      throw new Error("Database connection failed");
    }
  }
};

export default async (req, res) => {
  await connectDB(); // Conectar a la base de datos

  await midd(req, res);

  if (req.method == "GET") {
    const { filter } = req.query;

    if (filter == "day") {
      var start = new Date();
      start.setHours(0, 0, 0, 0);

      var end = new Date();
      end.setHours(23, 59, 59, 999);

      const affiliations = await Affiliation.find({
        date: { $gte: start, $lt: end },
      });
      const affiliations_count = affiliations.length;

      console.log({ start });
      console.log({ end });
      const activations = await Activation.find({
        date: { $gte: start, $lt: end },
      });
      const activations_count = activations.length;

      const collects = await Collect.find({ date: { $gte: start, $lt: end } });
      const collects_count = collects.length;

      const promos = await Promo.find({ date: { $gte: start, $lt: end } });
      const promos_count = promos.length;

      return res.json(
        success({
          affiliations,
          affiliations_count,
          activations,
          activations_count,
          collects,
          collects_count,
          promos,
          promos_count,
        })
      );
    }

    if (filter == "month") {
      var start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(1);

      var end = new Date();
      end.setHours(23, 59, 59, 999);
      end.setDate(31);

      const affiliations = await Affiliation.find({
        date: { $gte: start, $lt: end },
      });
      const affiliations_count = affiliations.length;

      const activations = await Activation.find({
        date: { $gte: start, $lt: end },
      });
      const activations_count = activations.length;

      const collects = await Collect.find({ date: { $gte: start, $lt: end } });
      const collects_count = collects.length;

      const monthlyIncome = await Activation.aggregate([
        { $match: { date: { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: "$price" } } },
      ]);

      const productsSold = await Activation.aggregate([
        { $match: { date: { $gte: start, $lt: end } } },
        { $unwind: "$products" },
        {
          $group: {
            _id: "$products.name",
            count: { $sum: "$products.quantity" },
          },
        },
        { $sort: { count: -1 } },
      ]);

      return res.json(
        success({
          affiliations,
          affiliations_count,
          activations,
          activations_count,
          collects,
          collects_count,
          monthlyIncome: monthlyIncome[0]?.total || 0,
          productsSold,
        })
      );
    }
  }
};
