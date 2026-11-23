import assert from "assert";
import {
  calculatePromotionBlocks,
  getPromotionRequiredPoints,
  parsePromotionRequiredPoints,
  promotionBlocksFor,
} from "../lib/promotionEligibility.js";
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

// 4. Puntaje de reconsumo configurable por promoción (promotion_required_points)
async function runConfigurableRequirementTests() {
  // Valor por promoción, con 160 por defecto
  assert.strictEqual(getPromotionRequiredPoints({}), 160);
  assert.strictEqual(getPromotionRequiredPoints({ promotion_required_points: 200 }), 200);
  assert.strictEqual(getPromotionRequiredPoints({ promotion_required_points: "abc" }), 160);
  assert.strictEqual(getPromotionRequiredPoints({ promotion_required_points: 0 }), 160);

  // Validación del valor que envía el admin
  assert.strictEqual(parsePromotionRequiredPoints("").value, 160);
  assert.strictEqual(parsePromotionRequiredPoints("200").value, 200);
  assert.ok(parsePromotionRequiredPoints(0).error);
  assert.ok(parsePromotionRequiredPoints(-5).error);
  assert.ok(parsePromotionRequiredPoints(1.5).error);
  console.log("✔ Puntaje configurable (valor por defecto y validación): OK");

  const promo200 = { id: "promo-200", name: "Promo 200", available_quantity: 1, is_promotion: true, promotion_required_points: 200 };
  const base = (accumulated, cart = 0, affiliated = false) => ({
    affiliated_current_period: affiliated,
    accumulated_points: accumulated,
    cart_points: cart,
  });

  // Reconsumo con 200: 160 bloqueada, 200 habilita 1, 400 habilita 2
  assert.strictEqual(promotionBlocksFor(base(160), promo200).total_blocks, 0);
  assert.strictEqual(promotionBlocksFor(base(200), promo200).total_blocks, 1);
  assert.strictEqual(promotionBlocksFor(base(400), promo200).total_blocks, 2);
  // Los puntos del pedido en curso cuentan: 150 acumulados + 50 en el carrito = 1 bloque
  assert.strictEqual(promotionBlocksFor(base(150, 50), promo200).total_blocks, 1);
  console.log("✔ Reconsumo con puntaje de 200 (160 / 200 / 400 / carrito): OK");

  // Afiliación del ciclo: 1 compra sin mínimo de reconsumo, aunque el requisito sea 200
  assert.strictEqual(promotionBlocksFor(base(0, 0, true), promo200).total_blocks, 1);
  assert.strictEqual(promotionBlocksFor(base(160, 0, true), promo200).total_blocks, 1);
  assert.strictEqual(promotionBlocksFor(base(200, 0, true), promo200).total_blocks, 2);
  console.log("✔ Afiliación habilita 1 promoción sin mínimo, adicionales con 200 pts: OK");

  // Catálogo: la promoción con 160 pts acumulados sigue visible pero sin cupo
  const locked = enrichPromotionForStore(promo200, 0, base(160));
  assert.strictEqual(locked.promotion_required_points, 200);
  assert.strictEqual(locked.promotion_remaining, 0);
  assert.strictEqual(locked.promotion_points_to_next_block, 40);
  const unlocked = enrichPromotionForStore(promo200, 0, base(400));
  assert.strictEqual(unlocked.promotion_remaining, 2);
  // Compatibilidad: pasar un número de bloques sigue funcionando
  assert.strictEqual(enrichPromotionForStore(promo200, 0, 3).promotion_remaining, 3);
  console.log("✔ Catálogo con puntaje por promoción: OK");

  // Pedido: dos promociones con requisitos distintos en el mismo pedido
  const promo160 = { id: "promo-160", name: "Promo 160", available_quantity: 1, is_promotion: true };
  const catalog = new Map([["promo-200", promo200], ["promo-160", promo160]]);
  const noPurchases = { find: async () => [] };

  const errLocked = await validatePromotionOrder([{ id: "promo-200", total: 1 }], catalog, noPurchases, "u", "2026-11", base(160));
  assert.ok(errLocked && errLocked.error.includes("200"));
  const okWithCart = await validatePromotionOrder([{ id: "promo-200", total: 1 }], catalog, noPurchases, "u", "2026-11", base(160, 40));
  assert.strictEqual(okWithCart, null);
  const okTwo = await validatePromotionOrder([{ id: "promo-200", total: 2 }], catalog, noPurchases, "u", "2026-11", base(400));
  assert.strictEqual(okTwo, null);
  const errThree = await validatePromotionOrder([{ id: "promo-200", total: 3 }], catalog, noPurchases, "u", "2026-11", base(400));
  assert.ok(errThree && errThree.error.includes("200"));

  const okMixed160 = await validatePromotionOrder([{ id: "promo-160", total: 1 }], catalog, noPurchases, "u", "2026-11", base(180));
  assert.strictEqual(okMixed160, null);
  const errMixed200 = await validatePromotionOrder([{ id: "promo-160", total: 1 }, { id: "promo-200", total: 1 }], catalog, noPurchases, "u", "2026-11", base(180));
  assert.ok(errMixed200 && errMixed200.error.includes("Promo 200"));
  console.log("✔ Validación de pedido con requisitos distintos por promoción: OK");
}

runOrderValidationTests().then(runConfigurableRequirementTests).then(() => {
  console.log("\n🎉 ¡TODAS LAS PRUEBAS DE BACKEND PASARON EXITOSAMENTE!");
}).catch((err) => {
  console.error("❌ Error en prueba:", err);
  process.exit(1);
});
