import db from "../../../components/db";
import lib from "../../../components/lib";

const { Affiliation, Activation, Collect, Promo } = db;
const { error, success, midd } = lib;

export default async (req, res) => {
  try {
    // Aplicar CORS primero
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

        const activations = await Activation.find({
          date: { $gte: start, $lt: end },
        });
        const activations_count = activations.length;

        const collects = await Collect.find({
          date: { $gte: start, $lt: end },
        });
        const collects_count = collects.length;

        const promos = await Promo.find({ date: { $gte: start, $lt: end } });
        const promos_count = promos.length;

        // Calcular ingresos diarios
        let dailyIncome = 0;
        let dailyIncomeActivations = 0;
        let dailyIncomeAffiliations = 0;

        // Ingresos de activaciones
        for (const activation of activations) {
          dailyIncomeActivations += activation.price || 0;
        }

        // Ingresos de afiliaciones
        for (const affiliation of affiliations) {
          dailyIncomeAffiliations +=
            (affiliation.plan && affiliation.plan.amount) || 0;
        }

        dailyIncome = dailyIncomeActivations + dailyIncomeAffiliations;

        // Calcular productos más vendidos del día
        const productsSold = {};

        // Productos de afiliaciones
        for (const affiliation of affiliations) {
          if (affiliation.products && Array.isArray(affiliation.products)) {
            for (const product of affiliation.products) {
              if (product.name && product.total) {
                if (!productsSold[product.name]) {
                  productsSold[product.name] = 0;
                }
                productsSold[product.name] += product.total;
              }
            }
          }
        }

        // Productos de activaciones
        for (const activation of activations) {
          if (activation.products && Array.isArray(activation.products)) {
            for (const product of activation.products) {
              if (product.name && product.quantity) {
                if (!productsSold[product.name]) {
                  productsSold[product.name] = 0;
                }
                productsSold[product.name] += product.quantity;
              }
            }
          }
        }

        const productsSoldArray = Object.entries(productsSold)
          .map(([name, count]) => ({ _id: name, count }))
          .sort((a, b) => b.count - a.count);

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
            dailyIncome,
            dailyIncomeActivations,
            dailyIncomeAffiliations,
            productsSold: productsSoldArray,
          })
        );
      }

      if (filter == "week") {
        // Calcular inicio y fin de la semana actual
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const affiliations = await Affiliation.find({
          date: { $gte: startOfWeek, $lt: endOfWeek },
        });
        const affiliations_count = affiliations.length;

        const activations = await Activation.find({
          date: { $gte: startOfWeek, $lt: endOfWeek },
        });
        const activations_count = activations.length;

        const collects = await Collect.find({
          date: { $gte: startOfWeek, $lt: endOfWeek },
        });
        const collects_count = collects.length;

        // Calcular ingresos semanales
        let weeklyIncome = 0;
        let weeklyIncomeActivations = 0;
        let weeklyIncomeAffiliations = 0;

        // Ingresos de activaciones
        for (const activation of activations) {
          weeklyIncomeActivations += activation.price || 0;
        }

        // Ingresos de afiliaciones
        for (const affiliation of affiliations) {
          weeklyIncomeAffiliations +=
            (affiliation.plan && affiliation.plan.amount) || 0;
        }

        weeklyIncome = weeklyIncomeActivations + weeklyIncomeAffiliations;

        // Calcular productos más vendidos de la semana
        const productsSold = {};

        // Productos de afiliaciones
        for (const affiliation of affiliations) {
          if (affiliation.products && Array.isArray(affiliation.products)) {
            for (const product of affiliation.products) {
              if (product.name && product.total) {
                if (!productsSold[product.name]) {
                  productsSold[product.name] = 0;
                }
                productsSold[product.name] += product.total;
              }
            }
          }
        }

        // Productos de activaciones
        for (const activation of activations) {
          if (activation.products && Array.isArray(activation.products)) {
            for (const product of activation.products) {
              if (product.name && product.quantity) {
                if (!productsSold[product.name]) {
                  productsSold[product.name] = 0;
                }
                productsSold[product.name] += product.quantity;
              }
            }
          }
        }

        const productsSoldArray = Object.entries(productsSold)
          .map(([name, count]) => ({ _id: name, count }))
          .sort((a, b) => b.count - a.count);

        return res.json(
          success({
            affiliations,
            affiliations_count,
            activations,
            activations_count,
            collects,
            collects_count,
            weeklyIncome,
            weeklyIncomeActivations,
            weeklyIncomeAffiliations,
            productsSold: productsSoldArray,
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

        const collects = await Collect.find({
          date: { $gte: start, $lt: end },
        });
        const collects_count = collects.length;

        // Calcular ingresos mensuales manualmente
        let monthlyIncome = 0;
        let monthlyIncomeActivations = 0;
        let monthlyIncomeAffiliations = 0;

        // Ingresos de activaciones
        for (const activation of activations) {
          monthlyIncomeActivations += activation.price || 0;
        }

        // Ingresos de afiliaciones
        for (const affiliation of affiliations) {
          monthlyIncomeAffiliations +=
            (affiliation.plan && affiliation.plan.amount) || 0;
        }

        monthlyIncome = monthlyIncomeActivations + monthlyIncomeAffiliations;

        // Obtener activaciones para cada período
        const todayActivations = await Activation.find({
          date: { $gte: start, $lt: end },
        });

        const weekActivations = await Activation.find({
          date: { $gte: start, $lt: end },
        });

        const monthActivations = await Activation.find({
          date: { $gte: start, $lt: end },
        });

        // Obtener afiliaciones del mes para productos
        const monthAffiliations = await Affiliation.find({
          date: { $gte: start, $lt: end },
        });

        // Calcular productos más vendidos del mes
        const productsSold = {};

        // Productos de afiliaciones del mes
        for (const affiliation of monthAffiliations) {
          if (affiliation.products && Array.isArray(affiliation.products)) {
            for (const product of affiliation.products) {
              if (product.name && product.total) {
                if (!productsSold[product.name]) {
                  productsSold[product.name] = 0;
                }
                productsSold[product.name] += product.total;
              }
            }
          }
        }

        // Productos de activaciones del mes
        for (const activation of monthActivations) {
          if (activation.products && Array.isArray(activation.products)) {
            for (const product of activation.products) {
              if (product.name && product.quantity) {
                if (!productsSold[product.name]) {
                  productsSold[product.name] = 0;
                }
                productsSold[product.name] += product.quantity;
              }
            }
          }
        }

        const productsSoldArray = Object.entries(productsSold)
          .map(([name, count]) => ({ _id: name, count }))
          .sort((a, b) => b.count - a.count);

        return res.json(
          success({
            affiliations,
            affiliations_count,
            activations,
            activations_count,
            collects,
            collects_count,
            monthlyIncome,
            monthlyIncomeActivations,
            monthlyIncomeAffiliations,
            productsSold: productsSoldArray,
          })
        );
      }

      if (filter == "all") {
        // Obtener datos de todos los períodos
        const now = new Date();

        // Hoy
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        // Esta semana
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Este mes
        const monthStart = new Date(now);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(now);
        monthEnd.setDate(31);
        monthEnd.setHours(23, 59, 59, 999);

        // Obtener activaciones para cada período
        const todayActivations = await Activation.find({
          date: { $gte: todayStart, $lt: todayEnd },
        });

        const weekActivations = await Activation.find({
          date: { $gte: weekStart, $lt: weekEnd },
        });

        const monthActivations = await Activation.find({
          date: { $gte: monthStart, $lt: monthEnd },
        });

        // Obtener afiliaciones del mes para productos
        const monthAffiliations = await Affiliation.find({
          date: { $gte: monthStart, $lt: monthEnd },
        });

        // --- NUEVO: Obtener totales de usuarios y afiliados ---
        const totalUsers = (await db.User.find({})).length;
        const affiliatedUsers = (await db.User.find({ affiliated: true }))
          .length;
        // -----------------------------------------------------

        // Calcular ingresos
        let dailyIncome = 0;
        let dailyIncomeActivations = 0;
        let dailyIncomeAffiliations = 0;

        // Ingresos de activaciones del día
        for (const activation of todayActivations) {
          dailyIncomeActivations += activation.price || 0;
        }

        // Ingresos de afiliaciones del día
        const todayAffiliations = await Affiliation.find({
          date: { $gte: todayStart, $lt: todayEnd },
        });
        for (const affiliation of todayAffiliations) {
          dailyIncomeAffiliations +=
            (affiliation.plan && affiliation.plan.amount) || 0;
        }

        dailyIncome = dailyIncomeActivations + dailyIncomeAffiliations;

        let weeklyIncome = 0;
        let weeklyIncomeActivations = 0;
        let weeklyIncomeAffiliations = 0;

        // Ingresos de activaciones de la semana
        for (const activation of weekActivations) {
          weeklyIncomeActivations += activation.price || 0;
        }

        // Ingresos de afiliaciones de la semana
        const weekAffiliations = await Affiliation.find({
          date: { $gte: weekStart, $lt: weekEnd },
        });
        for (const affiliation of weekAffiliations) {
          weeklyIncomeAffiliations +=
            (affiliation.plan && affiliation.plan.amount) || 0;
        }

        weeklyIncome = weeklyIncomeActivations + weeklyIncomeAffiliations;

        let monthlyIncome = 0;
        let monthlyIncomeActivations = 0;
        let monthlyIncomeAffiliations = 0;

        // Ingresos de activaciones del mes
        for (const activation of monthActivations) {
          monthlyIncomeActivations += activation.price || 0;
        }

        // Ingresos de afiliaciones del mes
        for (const affiliation of monthAffiliations) {
          monthlyIncomeAffiliations +=
            (affiliation.plan && affiliation.plan.amount) || 0;
        }

        monthlyIncome = monthlyIncomeActivations + monthlyIncomeAffiliations;

        // Calcular productos más vendidos del mes
        const productsSold = {};

        // Productos de afiliaciones del mes
        for (const affiliation of monthAffiliations) {
          if (affiliation.products && Array.isArray(affiliation.products)) {
            for (const product of affiliation.products) {
              if (product.name && product.total) {
                if (!productsSold[product.name]) {
                  productsSold[product.name] = 0;
                }
                productsSold[product.name] += product.total;
              }
            }
          }
        }

        // Productos de activaciones del mes
        for (const activation of monthActivations) {
          if (activation.products && Array.isArray(activation.products)) {
            for (const product of activation.products) {
              if (product.name && product.quantity) {
                if (!productsSold[product.name]) {
                  productsSold[product.name] = 0;
                }
                productsSold[product.name] += product.quantity;
              }
            }
          }
        }

        const productsSoldArray = Object.entries(productsSold)
          .map(([name, count]) => ({ _id: name, count }))
          .sort((a, b) => b.count - a.count);

        return res.json(
          success({
            dailyIncome,
            dailyIncomeActivations,
            dailyIncomeAffiliations,
            weeklyIncome,
            weeklyIncomeActivations,
            weeklyIncomeAffiliations,
            monthlyIncome,
            monthlyIncomeActivations,
            monthlyIncomeAffiliations,
            productsSold: productsSoldArray,
            todayActivations: todayActivations.length,
            weekActivations: weekActivations.length,
            monthActivations: monthActivations.length,
            totalUsers,
            affiliatedUsers,
          })
        );
      }
    }
  } catch (err) {
    console.error("Reports API Error:", err);
    return res.status(500).json(error("Internal server error"));
  }
};
