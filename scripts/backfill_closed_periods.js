require('dotenv').config({path: __dirname + '/../.env'});
const db = require('../components/db.js');

async function backfillClosedPeriods() {
  console.log("Iniciando backfill de periodos en la colección closeds...");

  const allPeriods = await db.Period.find({});
  if (!allPeriods || allPeriods.length === 0) {
    console.log("No se encontraron periodos en la base de datos.");
    process.exit(1);
  }

  const closeds = await db.Closed.find({});
  console.log(`Se encontraron ${closeds.length} cierres.`);

  let updatedCount = 0;

  for (let c of closeds) {
    if (c.period_key && c.period_label) {
      console.log(`[SALTADO] Cierre ID ${c.id} ya tiene periodo asignado: ${c.period_key}`);
      continue;
    }

    const cDate = new Date(c.date);
    const cTime = cDate.getTime();

    let bestPeriod = null;
    let minDiff = Infinity;

    // Buscar el periodo cuyo 'closedAt' esté más cerca de la fecha del cierre
    for (let p of allPeriods) {
      if (p.closedAt) {
        const pCloseTime = new Date(p.closedAt).getTime();
        const diff = Math.abs(pCloseTime - cTime);
        if (diff < minDiff) {
          minDiff = diff;
          bestPeriod = p;
        }
      }
    }

    // Si la diferencia es menor a 24 horas, asumimos que es el correcto
    // Esto asegura que incluso si iniciaron y cerraron muy rápido, matchee por exactitud de cierre
    if (minDiff < 24 * 60 * 60 * 1000 && bestPeriod) {
      c.period_key = bestPeriod.key;
      c.period_label = bestPeriod.label;
      await db.Closed.update({ id: c.id }, { period_key: c.period_key, period_label: c.period_label });
      console.log(`[ACTUALIZADO] Cierre ID ${c.id} (Fecha: ${cDate.toISOString()}) -> Periodo: ${bestPeriod.label} (Diferencia: ${minDiff}ms)`);
      updatedCount++;
    } else {
      console.log(`[ADVERTENCIA] Cierre ID ${c.id} (Fecha: ${cDate.toISOString()}) no encontró periodo cercano (Diferencia mínima: ${minDiff}ms)`);
    }
  }

  console.log(`\nCompletado. Se actualizaron ${updatedCount} cierres retroactivamente.`);
  process.exit(0);
}

backfillClosedPeriods().catch(console.error);
