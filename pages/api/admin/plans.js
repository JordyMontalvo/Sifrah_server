import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

const { Plan } = db;
const { midd, success } = lib;

export default async (req, res) => {
  await midd(req, res);
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method == "GET") {
    let plans = await Plan.find({});

    // response
    return res.json(
      success({
        plans,
      })
    );
  }
  if (req.method == "POST") {
    const { action } = req.body;

    if (action == "edit") {
      const { id } = req.body;
      const {
        _name,
        _amount,
        _img,
        _affiliation_points,
        _n,
        _max_products,
        _kit,
      } = req.body.data;

      await Plan.update(
        { id },
        {
          $set: {
            name: _name,
            amount: _amount,
            img: _img,
            affiliation_points: _affiliation_points,
            n: _n,
            max_products: _max_products,
            kit: _kit,
          },
        }
      );
    }

    if (action == "add") {
      const { name, amount, img, affiliation_points, n, max_products, kit } =
        req.body.data;

      await Plan.insert({
        id: name.toLowerCase().replace(/\s+/g, "_"),
        name,
        amount,
        img,
        affiliation_points,
        n,
        max_products,
        kit,
      });
    }

    if (action == "delete") {
      const { id } = req.body;
      await Plan.delete({ id });
    }

    // response
    return res.json(success({}));
  }
  // El panel no usa estas dos vias (solo GET y POST), pero quedan publicadas.
  // Antes recibian el cuerpo entero como filtro de la consulta, de modo que con
  // un operador en lugar de un identificador se alcanzaba un plan cualquiera.
  // Ahora exigen el identificador concreto, como el resto del fichero.
  const cuerpo = req.body || {};
  const identificadorPlan =
    typeof cuerpo.id === "string" && cuerpo.id.trim() ? cuerpo.id.trim() : null;

  if (req.method == "PUT") {
    // Esta via nunca llego a modificar nada: se llamaba a Plan.update sin los
    // valores a escribir. Se deja sin efecto a proposito, para alterar un plan
    // esta la accion 'edit' del POST, que si acota los campos que acepta.
    return res.json(
      success({
        plan: null,
      })
    );
  }
  if (req.method == "DELETE") {
    if (!identificadorPlan) return res.json(success({ plan: null }));
    let plan = await Plan.delete({ id: identificadorPlan });

    // response
    return res.json(
      success({
        plan,
      })
    );
  }
};
