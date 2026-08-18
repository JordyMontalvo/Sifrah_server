import assert from "assert";
import { calculatePromotionBlocks } from "../lib/promotionEligibility.js";
import {
  getPromotionRemaining,
  enrichPromotionForStore,
  validatePromotionOrder,
} from "../lib/promotionStock.js";

console.log("=== Corriendo pruebas de Lógica de Promociones por Bloques (160 pts) ===");

// 1. Pruebas de cálculo de bloques
// Caso A: No afiliado en el periodo actual
{
  const res0 = calculatePromotionBlocks({ affiliatedCurrentPeriod: false, accumulatedPoints: 0, cartPoints: 0 });
  assert.strictEqual(res0.eligible, false);
  assert.strictEqual(res0.total_blocks, 0);
  assert.strictEqual(res0.affiliation_blocks, 0);
  assert.strictEqual(res0.reconsumption_blocks, 0);
  assert.strictEqual(res0.points_to_next_block, 160);

  const res159 = calculatePromotionBlocks({ affiliatedCurrentPeriod: false, accumulatedPoints: 100, cartPoints: 59 });
  assert.strictEqual(res159.eligible, false);
  assert.strictEqual(res159.total_blocks, 0);
  assert.strictEqual(res159.projected_points, 159);
  assert.strictEqual(res159.points_to_next_block, 1);

  const res160 = calculatePromotionBlocks({ affiliatedCurrentPeriod: false, accumulatedPoints: 100, cartPoints: 60 });
  assert.strictEqual(res160.eligible, true);
  assert.strictEqual(res160.total_blocks, 1);
  assert.strictEqual(res160.reconsumption_blocks, 1);
  assert.strictEqual(res160.points_to_next_block, 160);

  const res320 = calculatePromotionBlocks({ affiliatedCurrentPeriod: false, accumulatedPoints: 250, cartPoints: 70 });
  assert.strictEqual(res320.eligible, true);
  assert.strictEqual(res320.total_blocks, 2);
  assert.strictEqual(res320.reconsumption_blocks, 2);

  const res480 = calculatePromotionBlocks({ affiliatedCurrentPeriod: false, accumulatedPoints: 480, cartPoints: 0 });
  assert.strictEqual(res480.eligible, true);
  assert.strictEqual(res480.total_blocks, 3);
  assert.strictEqual(res480.reconsumption_blocks, 3);
  console.log("✔ Casos de usuario no afiliado en periodo actual: OK");
}

// Caso B: Afiliado en el periodo actual (Regla 9)
{
  const aff0 = calculatePromotionBlocks({ affiliatedCurrentPeriod: true, accumulatedPoints: 0, cartPoints: 0 });
  assert.strictEqual(aff0.eligible, true);
  assert.strictEqual(aff0.affiliation_blocks, 1);
  assert.strictEqual(aff0.reconsumption_blocks, 0);
  assert.strictEqual(aff0.total_blocks, 1);

  const aff160 = calculatePromotionBlocks({ affiliatedCurrentPeriod: true, accumulatedPoints: 160, cartPoints: 0 });
  assert.strictEqual(aff160.eligible, true);
  assert.strictEqual(aff160.affiliation_blocks, 1);
  assert.strictEqual(aff160.reconsumption_blocks, 1);
  assert.strictEqual(aff160.total_blocks, 2); // 1 afiliación + 1 reconsumo

  const aff320 = calculatePromotionBlocks({ affiliatedCurrentPeriod: true, accumulatedPoints: 320, cartPoints: 0 });
  assert.strictEqual(aff320.eligible, true);
  assert.strictEqual(aff320.affiliation_blocks, 1);
  assert.strictEqual(aff320.reconsumption_blocks, 2);
  assert.strictEqual(aff320.total_blocks, 3); // 1 afiliación + 2 reconsumo
  console.log("✔ Casos de usuario afiliado en periodo actual (Regla 9): OK");
}

// 2. Pruebas de cupo por producto (disponibilidad y remaining)
{
  const promoProduct1 = { id: "promo-1", name: "Promo Pack", available_quantity: 1, is_promotion: true };
  const promoProduct2 = { id: "promo-2", name: "Promo Duo", available_quantity: 2, is_promotion: true };

  // 1 cupo base (available_quantity = 1), 1 bloque
  assert.strictEqual(getPromotionRemaining(promoProduct1, 0, 1), 1);
  assert.strictEqual(getPromotionRemaining(promoProduct1, 1, 1), 0);

  // 1 cupo base, 2 bloques (320 pts)
  assert.strictEqual(getPromotionRemaining(promoProduct1, 0, 2), 2);
  assert.strictEqual(getPromotionRemaining(promoProduct1, 1, 2), 1);
  assert.strictEqual(getPromotionRemaining(promoProduct1, 2, 2), 0);

  // 2 cupos base (available_quantity = 2), 1 bloque (160 pts)
  assert.strictEqual(getPromotionRemaining(promoProduct2, 0, 1), 2);
  assert.strictEqual(getPromotionRemaining(promoProduct2, 1, 1), 1);
  assert.strictEqual(getPromotionRemaining(promoProduct2, 2, 1), 0);

  // 2 cupos base, 2 bloques (320 pts)
  assert.strictEqual(getPromotionRemaining(promoProduct2, 0, 2), 4);
  assert.strictEqual(getPromotionRemaining(promoProduct2, 3, 2), 1);
  assert.strictEqual(getPromotionRemaining(promoProduct2, 4, 2), 0);

  // Enriquecimiento de producto
  const enriched = enrichPromotionForStore(promoProduct2, 1, 2);
  assert.strictEqual(enriched.available_quantity, 2);
  assert.strictEqual(enriched.promotion_total_allowed, 4);
  assert.strictEqual(enriched.promotion_purchased, 1);
  assert.strictEqual(enriched.promotion_remaining, 3);
  console.log("✔ Cálculo de cupos restantes por producto y multiplicador: OK");
}

// 3. Pruebas de validación de orden
async function runOrderValidationTests() {
  const promo = { id: "promo-1", name: "Colágeno Promo", available_quantity: 1, is_promotion: true };
  const regular = { id: "reg-1", name: "Luce Force", price: 100, points: 160 };
  const catalog = new Map([
    ["promo-1", promo],
    ["reg-1", regular],
  ]);

  const mockActivation = {
    find: async ({ period_key }) => {
      // Simular 0 compras previas en el periodo
      return [];
    },
  };

  // Pedido con 1 promo y 0 bloques -> Error
  const err0 = await validatePromotionOrder(
    [{ id: "promo-1", total: 1 }],
    catalog,
    mockActivation,
    "user-1",
    "2026-08",
    { total_blocks: 0, projected_points: 0, eligible: false }
  );
  assert.ok(err0 && err0.error);

  // Pedido con 1 promo y 1 bloque -> Válido
  const ok1 = await validatePromotionOrder(
    [{ id: "promo-1", total: 1 }],
    catalog,
    mockActivation,
    "user-1",
    "2026-08",
    { total_blocks: 1, projected_points: 160, eligible: true }
  );
  assert.strictEqual(ok1, null);

  // Pedido con 2 promos y 1 bloque -> Error
  const errExceed = await validatePromotionOrder(
    [{ id: "promo-1", total: 2 }],
    catalog,
    mockActivation,
    "user-1",
    "2026-08",
    { total_blocks: 1, projected_points: 160, eligible: true }
  );
  assert.ok(errExceed && errExceed.error);

  // Pedido con 2 promos y 2 bloques (320 pts) -> Válido
  const ok2 = await validatePromotionOrder(
    [{ id: "promo-1", total: 2 }],
    catalog,
    mockActivation,
    "user-1",
    "2026-08",
    { total_blocks: 2, projected_points: 320, eligible: true }
  );
  assert.strictEqual(ok2, null);

  // Pedido con 1 promo comprada previamente + 1 promo en carrito con 2 bloques -> Válido
  const mockActivationWith1Purchased = {
    find: async () => [{ period_key: "2026-08", products: [{ id: "promo-1", total: 1 }] }],
  };
  const okWithPrevious = await validatePromotionOrder(
    [{ id: "promo-1", total: 1 }],
    catalog,
    mockActivationWith1Purchased,
    "user-1",
    "2026-08",
    { total_blocks: 2, projected_points: 320, eligible: true }
  );
  assert.strictEqual(okWithPrevious, null);

  // Pedido con 2 promos en carrito pero ya compró 1 previamente (total 3 > 2 cupos) -> Error
  const errWithPrevious = await validatePromotionOrder(
    [{ id: "promo-1", total: 2 }],
    catalog,
    mockActivationWith1Purchased,
    "user-1",
    "2026-08",
    { total_blocks: 2, projected_points: 320, eligible: true }
  );
  assert.ok(errWithPrevious && errWithPrevious.error);

  console.log("✔ Validación de orden en backend (validatePromotionOrder): OK");
}

runOrderValidationTests().then(() => {
  console.log("\n🎉 ¡TODAS LAS PRUEBAS DE BACKEND PASARON EXITOSAMENTE!");
}).catch((err) => {
  console.error("❌ Error en prueba:", err);
  process.exit(1);
});
