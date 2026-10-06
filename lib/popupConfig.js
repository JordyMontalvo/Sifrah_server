export const POPUP_TYPES = ["unaffiliated", "institutional", "welcome"];

export const POPUP_IDS = {
  unaffiliated: "popup_unaffiliated",
  institutional: "popup_institutional",
  welcome: "popup_welcome",
};

export const WELCOME_ACTIONS = [
  "close",
  "tools",
  "rango",
  "dashboard",
  "profile",
  "link",
];

export const DEFAULT_POPUPS = {
  unaffiliated: {
    type: "unaffiliated",
    active: false,
    image: "",
  },
  institutional: {
    type: "institutional",
    active: false,
    image: "",
  },
  welcome: {
    type: "welcome",
    active: false,
    title: "¡Bienvenido a SIFRAH!",
    message: "Felicitaciones por dar el primer paso hacia una nueva etapa llena de oportunidades.",
    video: "",
    icon: "",
    footerText: "Hemos preparado una breve bienvenida para que conozcas lo esencial y empieces con el pie derecho dentro de SIFRAH.",
    primaryButton: {
      text: "Completar mi plan de acción",
      action: "tools",
      link: "",
    },
    secondaryButton: {
      text: "Ver más tarde",
      action: "close",
      link: "",
    },
  },
};

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

function normalizeButton(source, fallback) {
  const action = WELCOME_ACTIONS.includes(source && source.action)
    ? source.action
    : fallback.action;
  return {
    text: clip((source && source.text) || fallback.text, 40),
    action,
    link: clip((source && source.link) || "", 500),
  };
}

export function normalizeImagePopup(type, source = {}) {
  return {
    type,
    active: !!source.active,
    image: clip(source.image, 2000),
    updatedAt: source.updatedAt || null,
  };
}

export function normalizeWelcomePopup(source = {}) {
  const fallback = DEFAULT_POPUPS.welcome;
  return {
    type: "welcome",
    active: !!source.active,
    title: clip(source.title || fallback.title, 60),
    message: clip(source.message || fallback.message, 200),
    video: clip(source.video, 2000),
    icon: clip(source.icon, 2000),
    footerText: clip(source.footerText || fallback.footerText, 200),
    primaryButton: normalizeButton(source.primaryButton, fallback.primaryButton),
    secondaryButton: normalizeButton(source.secondaryButton, fallback.secondaryButton),
    updatedAt: source.updatedAt || null,
  };
}

export function publicImagePopup(doc) {
  if (!doc || !doc.active || !doc.image) return null;
  return {
    type: doc.type,
    image: doc.image,
  };
}

export function publicWelcomePopup(doc) {
  if (!doc || !doc.active) return null;
  if (!doc.title && !doc.message && !doc.video) return null;
  return {
    type: "welcome",
    title: doc.title,
    message: doc.message,
    video: doc.video || "",
    icon: doc.icon || "",
    footerText: doc.footerText || "",
    primaryButton: doc.primaryButton,
    secondaryButton: doc.secondaryButton,
  };
}

export function pickPopupForUser(user, configs) {
  if (!user) return null;
  if (!user.affiliated) {
    return publicImagePopup(configs.unaffiliated);
  }
  if (user.welcomePopupPending && !user.welcomePopupSeen) {
    const welcome = publicWelcomePopup(configs.welcome);
    if (welcome) return welcome;
  }
  return publicImagePopup(configs.institutional);
}
