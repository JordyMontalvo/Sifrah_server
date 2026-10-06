const HERO_ACTIONS = ["welcome", "continue", "modules", "link", "video"];

const DEFAULT_UNIVERSITY_BANNERS = [
  {
    id: "slide_1",
    image: "",
    kicker: "Bienvenido a",
    title: "Universidad SIFRAH",
    text: "Da el primer paso en tu formación.",
    buttonText: "Ver video de bienvenida",
    action: "welcome",
    link: "",
    moduleId: "",
    videoId: "",
    theme: "sunset",
    hideText: false,
    active: true,
    order: 0,
  },
  {
    id: "slide_2",
    image: "",
    kicker: "Sigue tu ruta",
    title: "Plan de compensación",
    text: "Entiende cómo funciona el residual.",
    buttonText: "Continuar módulo 3",
    action: "continue",
    link: "",
    moduleId: "",
    videoId: "",
    theme: "chart",
    hideText: false,
    active: true,
    order: 1,
  },
  {
    id: "slide_3",
    image: "",
    kicker: "Empieza por aquí",
    title: "Cinco módulos",
    text: "De la bienvenida a tu activación.",
    buttonText: "Ver módulos",
    action: "modules",
    link: "",
    moduleId: "",
    videoId: "",
    theme: "city",
    hideText: false,
    active: true,
    order: 2,
  },
];

function normalizeUniversityBanner(raw, index) {
  const source = raw || {};
  const action = HERO_ACTIONS.includes(source.action) ? source.action : "modules";
  return {
    id: source.id || `slide_${index + 1}`,
    image: String(source.image || "").trim(),
    kicker: String(source.kicker || "").trim(),
    title: String(source.title || "").trim(),
    text: String(source.text || "").trim(),
    buttonText: String(source.buttonText || source.cta || "").trim(),
    action,
    link: String(source.link || "").trim(),
    moduleId: String(source.moduleId || "").trim(),
    videoId: String(source.videoId || "").trim(),
    theme: source.theme || (DEFAULT_UNIVERSITY_BANNERS[index] && DEFAULT_UNIVERSITY_BANNERS[index].theme) || "sunset",
    hideText: !!source.hideText,
    active: source.active !== false,
    order: index,
  };
}

function normalizeUniversityBanners(input) {
  const list = Array.isArray(input) ? input : [];
  return list.map((slide, index) => normalizeUniversityBanner(slide, index));
}

function publicUniversityBanners(input) {
  return normalizeUniversityBanners(input).filter(
    (slide) => slide.active && (slide.title || slide.image || slide.buttonText || slide.kicker)
  );
}

export {
  HERO_ACTIONS,
  DEFAULT_UNIVERSITY_BANNERS,
  normalizeUniversityBanners,
  publicUniversityBanners,
};
