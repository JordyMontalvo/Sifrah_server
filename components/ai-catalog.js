/**
 * Catálogo Semántico de Productos Sifrah para RAG / Asistente Virtual
 * Fichas técnicas provisionales de prueba (ingredientes, dolencias, beneficios y precauciones)
 * Una vez se tengan las fichas oficiales, se actualizan aquí o en la base de datos.
 */

const catalog = [
  {
    sku: "REJUVENECE",
    names: ["REJUVENECE-POTE", "REJUVENECE-SACHET"],
    category: "Articulaciones y Antienvejecimiento",
    price: 85,
    points: 40,
    tags: ["colageno", "piel", "articulaciones", "arrugas", "rodillas", "cartilago", "pelo", "uñas"],
    targetAilments: [
      "dolor de rodilla",
      "desgaste de articulaciones",
      "artritis",
      "artrosis leve",
      "crujido de rodillas",
      "dolor articular",
      "arrugas y líneas de expresión",
      "flacidez en la piel",
      "uñas quebradizas",
      "caída leve de cabello"
    ],
    benefits: [
      "Regenera y lubrica el cartílago articular",
      "Mejora la elasticidad e hidratación profunda de la piel",
      "Fortalece uñas quebradizas y hebras capilares",
      "Aporta antioxidantes para frenar el envejecimiento celular"
    ],
    ingredients: [
      "Colágeno Hidrolizado Marino y Bovino",
      "Vitamina C (facilita absorción)",
      "Ácido Hialurónico",
      "Resveratrol",
      "Magnesio y Zinc"
    ],
    usage: "Tomar 1 medida (o 1 sachet) disuelto en 250ml de agua o jugo en ayunas o antes de dormir.",
    contraindications: [
      "Personas con fenilcetonuria",
      "Alergia a proteínas o mariscos",
      "Insuficiencia renal avanzada (consultar previamente a su médico)"
    ]
  },
  {
    sku: "REGENERA_T",
    names: ["REGENERA T"],
    category: "Salud Digestiva y Gástrica",
    price: 90,
    points: 40,
    tags: ["gastritis", "acidez", "reflujo", "estomago", "ardor", "ulcera", "digestion", "inflamacion"],
    targetAilments: [
      "gastritis",
      "ardor de estómago",
      "acidez estomacal",
      "reflujo gastroesofágico",
      "pesadez estomacal tras comer",
      "inflamación gástrica",
      "molestia por Helicobacter pylori (como coadyuvante)"
    ],
    benefits: [
      "Regenera y protege la mucosa y paredes del estómago",
      "Calma el ardor y fuego estomacal casi al instante",
      "Acción cicatrizante y antiinflamatoria en el tracto digestivo",
      "Favorece una digestión liviana y sin reflujo"
    ],
    ingredients: [
      "Extracto de Sangre de Grado",
      "Tocosh deshidratado",
      "Aloe Vera (Sábila liofilizada)",
      "Uña de Gato",
      "Glutamina y Caléndula"
    ],
    usage: "Disolver 1 sachet o 1 scoop en agua tibia 20 minutos antes del desayuno y antes de la cena.",
    contraindications: [
      "No consumir en exceso durante el primer trimestre de embarazo sin aval médico."
    ]
  },
  {
    sku: "DETOX",
    names: ["DETOX-POTE", "DETOX-SACHET"],
    category: "Desintoxicación y Limpieza Hepática / Colon",
    price: 85,
    points: 40,
    tags: ["detox", "higado graso", "estreñimiento", "limpieza de colon", "gases", "hinchazon", "digestion"],
    targetAilments: [
      "estreñimiento crónico o severo",
      "hígado graso",
      "abdomen hinchado o inflamado",
      "digestión lenta",
      "boca amarga al despertar",
      "retención de toxinas",
      "gases constantes"
    ],
    benefits: [
      "Desintoxica y depura el hígado y vesícula biliar",
      "Regula el tránsito intestinal y limpia el colon suavemente",
      "Elimina la pesadez y sensación de abotagamiento abdominal",
      "Mejora el aliento y la apariencia de la piel grasa o con impurezas"
    ],
    ingredients: [
      "Alcachofa",
      "Boldo",
      "Flor de Arena",
      "Psyllium Husk (fibra soluble)",
      "Chanca Piedra",
      "Espirulina y Clorofila"
    ],
    usage: "1 porción en la noche disuelta en agua tibia durante 7 a 14 días continuos.",
    contraindications: [
      "Obstrucción de vías biliares",
      "Diarrea aguda",
      "Embarazo o lactancia inmediata"
    ]
  },
  {
    sku: "VIGORPROST",
    names: ["VIGORPROST"],
    category: "Salud Prostática y Masculina",
    price: 50,
    points: 25,
    tags: ["prostata", "orina", "miccion nocturna", "hombres", "vigor", "vejiga", "flujo debil"],
    targetAilments: [
      "inflamación de próstata (prostatitis leve)",
      "levantarse varias veces de noche a orinar (nicturia)",
      "chorro o flujo urinario débil o entrecortado",
      "sensación de no vaciar la vejiga por completo",
      "molestia pélvica en varones mayores de 35 años"
    ],
    benefits: [
      "Desinflama el tejido prostático de forma natural",
      "Mejora la fuerza y fluidez del chorro urinario",
      "Disminuye las idas nocturnas al baño",
      "Aporta antioxidantes específicos para el aparato reproductor masculino"
    ],
    ingredients: [
      "Saw Palmetto (Serenoa repens)",
      "Semillas de Calabaza (Cucurbita pepo)",
      "Licopeno de tomate concentrado",
      "Ortiga menor (Urtica dioica)",
      "Zinc Quelado"
    ],
    usage: "Tomar 2 cápsulas o 1 porción diaria con el almuerzo con abundante agua.",
    contraindications: [
      "Producto formulado para hombres adultos. Ante sospecha de tumor o antígeno prostático muy elevado, acudir a urólogo."
    ]
  },
  {
    sku: "IMPULZE",
    names: ["IMPULZE-SACHET"],
    category: "Energía, Vitalidad y Enfoque Mental",
    price: 90,
    points: 40,
    tags: ["energia", "cansancio", "fatiga", "agotamiento", "sueño", "concentracion", "rendimiento"],
    targetAilments: [
      "cansancio físico crónico",
      "fatiga mental y falta de concentración",
      "pereza y somnolencia a mitad del día",
      "desgaste por exceso de trabajo o deporte",
      "estrés y bajo rendimiento cognitivo"
    ],
    benefits: [
      "Energía sostenida sin taquicardia ni bajón brusco",
      "Mejora la claridad mental, concentración y memoria de trabajo",
      "Reduce el cortisol y la fatiga por estrés",
      "Optimiza la oxigenación celular durante el día"
    ],
    ingredients: [
      "Maca Negra y Amarilla gelatinizada",
      "Guaraná",
      "Ginseng Panax",
      "Camu Camu",
      "Complejo B (B1, B6, B12)",
      "Taurina y Coenzima Q10"
    ],
    usage: "Tomar 1 sachet disuelto en agua fría a media mañana o antes de entrenar / trabajar.",
    contraindications: [
      "Hipertensión no controlada (por contenido de extractos energizantes)",
      "No tomar después de las 6:00 pm si sufre de insomnio"
    ]
  },
  {
    sku: "ESBELTA",
    names: ["ESBELTA"],
    category: "Control de Peso y Quema de Grasa",
    price: 90,
    points: 40,
    tags: ["peso", "adelgazar", "grasa", "ansiedad", "antojo", "metabolismo", "talla"],
    targetAilments: [
      "sobrepeso",
      "grasa localizada (abdomen/caderas)",
      "ansiedad incontrolable por comer dulces o harinas",
      "metabolismo lento",
      "retención de líquidos"
    ],
    benefits: [
      "Acelera el metabolismo y la termogénesis (quema de grasa)",
      "Calma la ansiedad por comer y genera sensación de saciedad",
      "Efecto diurético suave para deshinchar piernas y abdomen",
      "Convierte los depósitos de grasa en energía utilizable"
    ],
    ingredients: [
      "Té Verde y Té Matcha",
      "L-Carnitina",
      "Garcinia Cambogia (HCA)",
      "Picolinato de Cromo",
      "Café Verde",
      "Cáscara de Naranja Agria"
    ],
    usage: "1 porción 30 minutos antes del desayuno o del almuerzo.",
    contraindications: [
      "Embarazadas y madres lactantes",
      "Sensibilidad extrema a la cafeína"
    ]
  },
  {
    sku: "VITALPRO",
    names: ["Vitalpro"],
    category: "Sistema Inmune y Nutrición Integral",
    price: 70,
    points: 30,
    tags: ["defensas", "inmunidad", "gripe", "vitaminas", "nutricion", "anemia", "debilidad"],
    targetAilments: [
      "defensas bajas (enfermarse seguido de gripe o infecciones)",
      "debilidad corporal general o convalecencia",
      "tendencia a la anemia o falta de nutrientes",
      "alimentación deficiente o desbalanceada"
    ],
    benefits: [
      "Refuerza el sistema inmunológico frente a virus y bacterias",
      "Aporte completo de micronutrientes esenciales de alta asimilación",
      "Ayuda a prevenir cuadros respiratorios frecuentes",
      "Aumenta la vitalidad basal diaria"
    ],
    ingredients: [
      "Calostro Bovino",
      "Cúrcuma y Kion (Jengibre)",
      "Zinc y Vitamina D3",
      "Camu Camu (alta Vitamina C natural)",
      "Probióticos microencapsulados"
    ],
    usage: "1 scoop disuelto en agua o avena tibia por las mañanas.",
    contraindications: [
      "Intolerancia severa a derivados lácteos (por el calostro)."
    ]
  },
  {
    sku: "LA_TRADICION",
    names: ["LA TRADICIÓN-POTE", "LA TRADICIÓN-SACHET"],
    category: "Nutrición Ancestral y Longevidad",
    price: 85,
    points: 40,
    tags: ["ancestral", "vitalidad", "longevidad", "nutricion", "cereales", "vigor"],
    targetAilments: [
      "desnutrición leve o pérdida de masa muscular",
      "adultos mayores con poco apetito o debilidad",
      "estudiantes o trabajadores con alta demanda de nutrientes naturales"
    ],
    benefits: [
      "Nutrición balanceada a base de superalimentos andinos",
      "Aporte proteico y de fibra para mantener la fuerza muscular",
      "Propiedades antioxidantes y reconstituyentes"
    ],
    ingredients: [
      "Quinua, Kiwicha y Cañihua gelatinizadas",
      "Algarrobo",
      "Cacao criollo",
      "Polen y Maca"
    ],
    usage: "1 a 2 cucharadas en jugos, batidos o leche vegetal en el desayuno.",
    contraindications: ["Ninguna relevante, apto para toda la familia."]
  },
  {
    sku: "LINEA_CAPILAR",
    names: ["Champú Anticaída", "Loción Anticaída", "Champú Calvicie", "Loción Calvicie"],
    category: "Salud Capilar y Cuero Cabelludo",
    price: 55,
    points: 15,
    tags: ["cabello", "caida de pelo", "calvicie", "alopecia", "cuero cabelludo", "caspa", "champu"],
    targetAilments: [
      "caída excesiva de cabello al bañarse o peinarse",
      "entradas pronunciadas o pérdida de densidad capilar (calvicie inicial)",
      "cabello débil, fino, quebradizo y sin brillo",
      "cuero cabelludo graso o con caspa"
    ],
    benefits: [
      "Nutre y reactiva el folículo piloso debilitado",
      "Frena la caída y estimula el nacimiento de nuevos cabellos",
      "Engrosa la hebra capilar y fortalece la raíz",
      "Limpia profundamente sin sulfatos agresivos"
    ],
    ingredients: [
      "Biotina (Vitamina H)",
      "Extracto de Romero y Ortiga",
      "Capixyl y Pantenol (Provitamina B5)",
      "Aceite de Argán",
      "Zinc PCA"
    ],
    usage: "Lavar el cabello 3 a 4 veces por semana con el champú; aplicar la loción directamente en la raíz en seco con masajes circulares.",
    contraindications: ["Uso externo únicamente. Evitar contacto con los ojos."]
  },
  {
    sku: "LINEA_FACIAL",
    names: ["Crema Antiedad", "Crema Antiacné"],
    category: "Cuidado Facial y Dermocosmética",
    price: 45,
    points: 12,
    tags: ["acne", "espinillas", "arrugas", "rostro", "manchas", "grasa en la cara", "crema facial"],
    targetAilments: [
      "brotes de acné, barros y espinillas",
      "poros dilatados y piel grasa o brillosa",
      "manchas post-inflamatorias del acné",
      "arrugas finas y falta de firmeza en el rostro"
    ],
    benefits: [
      "La crema Antiacné regula la producción de sebo y desinflama los brotes",
      "La crema Antiedad hidrata profundamente y rellena líneas de expresión",
      "Textura ligera de rápida absorción, no comedogénica"
    ],
    ingredients: [
      "Ácido Salicílico y Niacinamida (Antiacné)",
      "Ácido Hialurónico y Péptidos Tensores (Antiedad)",
      "Baba de Caracol y Aloe Vera"
    ],
    usage: "Aplicar sobre el rostro limpio por la mañana y noche con suaves toques.",
    contraindications: ["Uso tópico. En caso de irritación descontinuar. Usar protector solar."]
  }
];

const COMBOS = [
  {
    id: "COMBO_ARTICULAR_PRO",
    name: "Combo Articular & Regenerativo (Rejuvenece + Detox)",
    primarySku: "REJUVENECE",
    companionSku: "DETOX",
    description: "La sinergia ideal: Detox desinflama el tracto digestivo y depura toxinas para que el Colágeno Hidrolizado de Rejuvenece se absorba al 100% en las articulaciones.",
    discountHint: "S/ 170 total • 80 Pts de volumen"
  },
  {
    id: "COMBO_DIGESTIVO_TOTAL",
    name: "Combo Digestivo Total (Regenera T + Detox)",
    primarySku: "REGENERA_T",
    companionSku: "DETOX",
    description: "Regenera T cicatriza y protege las paredes del estómago contra el ardor y acidez, mientras Detox limpia el colon y combate el estreñimiento.",
    discountHint: "S/ 175 total • 80 Pts de volumen"
  },
  {
    id: "COMBO_ENERGIA_INMUNE",
    name: "Combo Rendimiento & Defensas (Impulze + Vitalpro)",
    primarySku: "IMPULZE",
    companionSku: "VITALPRO",
    description: "Impulze entrega vitalidad y claridad mental inmediata con Maca y Guaraná, y Vitalpro refuerza tus defensas con Calostro y Vitamina D3.",
    discountHint: "S/ 160 total • 70 Pts de volumen"
  },
  {
    id: "COMBO_CONTROL_PESO",
    name: "Combo Silueta & Quema Grasa (Esbelta + Detox)",
    primarySku: "ESBELTA",
    companionSku: "DETOX",
    description: "Esbelta acelera el metabolismo y la quema de calorías con Té Matcha y L-Carnitina, mientras Detox drena líquidos retenidos e hinchazón.",
    discountHint: "S/ 175 total • 80 Pts de volumen"
  },
  {
    id: "COMBO_CAPILAR_COMPLETO",
    name: "Combo Anticaída Integral (Línea Capilar + Rejuvenece)",
    primarySku: "LINEA_CAPILAR",
    companionSku: "REJUVENECE",
    description: "Tratamiento dual: El champú y loción estimulan el folículo desde el exterior, mientras el Colágeno y Biotina de Rejuvenece nutren la raíz desde el interior.",
    discountHint: "S/ 140 total • 55 Pts de volumen"
  }
];

export { catalog, COMBOS };
export default catalog;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = catalog;
  module.exports.catalog = catalog;
  module.exports.COMBOS = COMBOS;
}
