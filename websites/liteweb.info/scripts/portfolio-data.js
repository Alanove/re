/**
 * Live client sites shown on the portfolio page and product “related work” strips.
 * Screenshots live at html/images/portfolio/{id}.jpg (see capture-portfolio.js).
 */
const CATEGORIES = [
  { id: "e-commerce", label: "E-commerce" },
  { id: "company", label: "Company" },
  { id: "compound", label: "Compound" },
  { id: "dynamic", label: "Dynamic" },
  { id: "religious", label: "Religious" },
  { id: "cms", label: "Multilingual CMS" },
];

const sites = [
  {
    id: "antonios-couture",
    url: "https://antonioscouture.liteweb.info/",
    name: "Antonios Couture",
    category: "e-commerce",
    description:
      "Haute couture house with seasonal collections, bridal, ready-to-wear, and cruise — plus appointments and a full online storefront.",
  },
  {
    id: "guerra-sports",
    url: "https://guerrasports.com/",
    name: "Guerra Sports",
    category: "e-commerce",
    description:
      "Global martial arts and athleisure brand selling gloves, gi, protection gear, and training equipment under the Fit For Champions line.",
  },
  {
    id: "fleurealle",
    url: "https://fleurealle.liteweb.info/",
    name: "Fleurealle",
    category: "e-commerce",
    description:
      "Flower delivery for every occasion — bouquets, plants, cakes, and gifts — with location-based checkout and same-day arrangements.",
  },
  {
    id: "emdc-group",
    url: "https://www.emdcgroup.com/",
    name: "EMDC Group",
    category: "company",
    description:
      "MEP, ICT, energy, and BIM engineering firm founded in 2008, delivering design and construction support from Beirut, Dubai, Cairo, and Riyadh.",
  },
  {
    id: "e-medical-cyprus",
    url: "https://e-medicalcyprus.com/",
    name: "E-Medical Cyprus",
    category: "company",
    description:
      "Medical technology partner in Larnaca offering dental equipment rental, training, ISO certification, and a certified-clinic directory.",
  },
  {
    id: "feed-lebanon",
    url: "https://feed-lb.org/",
    name: "FEED Lebanon",
    category: "company",
    description:
      "Nonprofit working to break the poverty cycle through food, medical support, education, housing, and community programs across Lebanon.",
  },
  {
    id: "bypec",
    url: "https://bypec-lb.com/",
    name: "Bypec",
    category: "company",
    description:
      "Byblos Petroleum Company — fuel and lubricant distribution with stations in Amchit and Byblos, plus car wash and lube services.",
  },
  {
    id: "santa-maria-bouar",
    url: "https://santamariabouar.com/",
    name: "Santa Maria Bouar",
    category: "compound",
    description:
      "Gated residential compound in Bouar with apartments for sale and rent, on-site amenities, and a public listings site for residents and buyers.",
  },
  {
    id: "arar",
    url: "https://arar-co.com/",
    name: "A.R.A.R co.",
    category: "dynamic",
    description:
      "Architecture and restoration practice conserving historical sites and monuments in Lebanon, from design through construction.",
  },
  {
    id: "throne-trading",
    url: "https://www.thronetrading.com/",
    name: "Throne Trading",
    category: "dynamic",
    description:
      "Lebanese distributor of hotel, jewelry, bank, gun, and home safes — serving banks and businesses since 2002.",
  },
  {
    id: "solutec",
    url: "https://solutec-lb.com/",
    name: "Solutec",
    category: "dynamic",
    description:
      "POS hardware specialist for hospitality, retail, and industry — receipt printers, scanners, touch terminals, and money counters.",
  },
  {
    id: "re-petroleum",
    url: "https://www.re-petroleum.com/",
    name: "R&E Petroleum",
    category: "dynamic",
    description:
      "Kuwait-based oil, gas, and facilities contractor covering engineering, solar, fire fighting, scaffolding, and manpower supply.",
  },
  {
    id: "hajj-group",
    url: "https://hajjgroup.co/",
    name: "Hajj Group",
    category: "dynamic",
    description:
      "Beqaa construction and trading group supplying building materials, ready-mix, sanitary ware, and related site services.",
  },
  {
    id: "zena-assi",
    url: "https://zenaassi.com/",
    name: "Zena Assi",
    category: "dynamic",
    description:
      "Contemporary artist portfolio spanning cityscapes, portraits, ceramics, and exhibitions, with virtual tours and press.",
  },
  {
    id: "gebco-steel",
    url: "https://gebcosteel.com/",
    name: "Gebco Steel Industry",
    category: "dynamic",
    description:
      "Steel construction and engineering company delivering complete structure solutions from design through fabrication.",
  },
  {
    id: "bright-properties",
    url: "https://brightproperties.uk/",
    name: "Bright Properties UK",
    category: "dynamic",
    description:
      "London property developers and consultants who joint-venture on carefully selected £3M–£30M GDV projects.",
  },
  {
    id: "mar-antonios",
    url: "https://www.marantoniosalkabir.com/",
    name: "Mar Antonios al Kabir",
    category: "religious",
    description:
      "Parish site for Saint Anthony the Great in Jdeideh, Metn — liturgy, daily readings, news, and media in Arabic.",
  },
  {
    id: "podvorie-livan",
    url: "https://podvorie-livan.com/",
    name: "Podvorie Livan",
    category: "religious",
    description:
      "Representation of the Russian Orthodox Church in Lebanon, with news, gallery, pilgrimage, and parish life in Jal El Dib.",
  },
  {
    id: "gwip",
    url: "https://gwip.liteweb.info/",
    name: "GWIP",
    category: "cms",
    description:
      "Global Water Innovation Platform — a bilingual Arabic/English CMS connecting researchers, partners, and programs across the water sector.",
  },
];

function sitesByCategory(categoryIds) {
  const ids = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
  return sites.filter((site) => ids.includes(site.category));
}

function categoryLabel(id) {
  const match = CATEGORIES.find((cat) => cat.id === id);
  return match ? match.label : id;
}

module.exports = { CATEGORIES, sites, sitesByCategory, categoryLabel };
