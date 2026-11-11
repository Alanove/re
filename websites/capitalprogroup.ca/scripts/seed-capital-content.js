const fs = require('fs');
const path = require('path');

const pagesPath = path.join(__dirname, '../data/pages.json');
const menuPath = path.join(__dirname, '../data/menu.json');
const sliderPath = path.join(__dirname, '../data/slider.json');
const newsPath = path.join(__dirname, '../data/news.json');

const pages = JSON.parse(fs.readFileSync(pagesPath, 'utf8'));

function companyHtml(image, title, intro, sections) {
  const blocks = sections.map((section) => {
    const items = (section.items || []).map((item) => `<li>${item}</li>`).join('');
    return `${section.heading ? `<h3 class="h5 mt-4 mb-3">${section.heading}</h3>` : ''}${section.text ? `<p>${section.text}</p>` : ''}${items ? `<ul class="list-style1 mb-0">${items}</ul>` : ''}`;
  }).join('');
  return `<div class="row"><div class="col-12 mb-2-9"><img src="${image}" alt="${title}" class="rounded"></div><div class="col-12 mb-2-9"><h2 class="mb-3">${title}</h2><p>${intro}</p>${blocks}</div></div>`;
}

pages.pages.advisory = {
  key: 'advisory',
  title: 'Advisory',
  url: '/companies/advisory',
  kind: 'company',
  parentKey: 'companies',
  pageImage: '/uploads/pages/advisory-banner.jpg',
  logo: '/images/logos/capital-pro-group.jpg',
  tagline: 'Your Goals, Our Guidance',
  icon: '/images/content/icon-advisory.jpg',
  portalUrl: '',
  menuSort: 1,
  status: 'published',
  includeInMenu: true,
  showInvestiaDisclaimer: false,
  content: companyHtml(
    '/uploads/pages/advisory-body.jpg',
    'New to Canada, Leaving Canada & Non-Resident Services',
    'Whether you are establishing yourself in Canada, growing a business, purchasing an investment property, or preparing to leave Canada, Capital Pro Inc. provides coordinated advisory and consulting services to help you make informed decisions.',
    [
      { text: 'We work with individuals, families, entrepreneurs, corporations, newcomers, emigrants, and non-residents. Our practical approach brings together tax planning, accounting, business consulting, and property management support—all tailored to your circumstances.' },
      { heading: 'Helping You Establish Your Financial Life in Canada and Beyond', text: 'Moving to Canada is a major transition. Canada’s tax system, banking practices, government benefits, and business requirements may be unfamiliar. We help newcomers understand their obligations, organize their finances, and begin their Canadian journey with greater confidence.', items: ['Canadian tax-residency consultation', 'First-year Canadian income-tax returns', 'Foreign income and asset-reporting guidance', 'GST/HST credit and benefit information', 'Canada Child Benefit guidance', 'Tax identification and CRA account support', 'Rental-property tax guidance', 'Coordination with immigration lawyers and other licensed professionals'] },
      { heading: 'Leaving Canada', text: 'Leaving Canada can create important tax, business, property, and reporting obligations. Planning before your departure can help reduce complications and prevent unexpected tax consequences.', items: ['Canadian tax-residency assessment', 'Departure tax planning', 'Identification of assets affected by deemed-disposition rules', 'Final resident income-tax return preparation', 'Foreign-property reporting review', 'Registered-account considerations', 'Canadian rental-property planning', 'CRA notification and account support', 'Coordination with professionals in your destination country'] },
      { heading: 'Non-Resident Tax Services', text: 'If you live outside Canada but earn Canadian income, own Canadian property, or maintain Canadian business interests, you may continue to have Canadian tax and reporting obligations.', items: ['Canadian non-resident tax returns', 'Canadian rental-income reporting', 'Non-resident withholding-tax compliance', 'NR4 reporting support', 'NR6 applications for rental-property owners', 'Section 216 tax returns', 'Sale of Canadian real estate and Section 116 support', 'Clearance-certificate coordination', 'Canadian corporate and business filings', 'CRA correspondence and account assistance'] },
      { heading: 'Property Management for Non-Residents', text: 'Managing a Canadian property while living in another country can be challenging. Capital Pro Inc. provides property management and financial administration support designed for non-resident owners.', items: ['Tenant communication and administrative support', 'Rent collection and payment monitoring', 'Coordination of repairs and maintenance', 'Property inspections', 'Expense tracking and recordkeeping', 'Payment of approved property expenses', 'Monthly or periodic owner statements', 'Rental-income bookkeeping', 'Non-resident tax-withholding administration', 'NR4 information-return support', 'NR6 and Section 216 tax-return coordination', 'Assistance when purchasing or selling a Canadian property'] },
      { heading: 'Important Notice', text: 'Capital Pro Inc. provides tax, accounting, administrative, and business consulting services. Information provided through this website is general in nature and should not be considered legal, immigration, or investment advice. Where regulated professional services are required, clients should consult with an appropriately licensed professional. Services are subject to an engagement agreement and an assessment of each client’s circumstances.' }
    ]
  ),
  seo: {
    pageTitle: 'Advisory | Capital Pro Group',
    pageDescription: 'New to Canada, leaving Canada and non-resident advisory services.',
    pageKeywords: 'advisory, newcomers, non-resident, Ottawa',
    pageImage: '/uploads/pages/advisory-banner.jpg',
    pageType: 'website'
  }
};

Object.assign(pages.pages.taxes, {
  title: 'Taxes',
  kind: 'company',
  parentKey: 'companies',
  pageImage: '/uploads/pages/taxes-banner.jpg',
  logo: '/images/logos/taxes.png',
  tagline: 'Tax Filing Made Simpler',
  icon: '/images/content/icon-taxes.png',
  portalUrl: '',
  menuSort: 2,
  showInvestiaDisclaimer: false,
  content: companyHtml(
    '/uploads/pages/taxes-body.jpg',
    'Professional Tax Solutions for Individuals and Businesses',
    'We understand that navigating Canada\'s tax system can be challenging. Our tax professionals provide accurate, efficient, and compliant tax services to help you maximize your deductions, minimize your tax liability, and meet all Canada Revenue Agency (CRA) requirements.',
    [
      { text: 'Whether you\'re filing a simple personal tax return or managing complex tax obligations, we\'re committed to delivering reliable guidance tailored to your financial situation.' },
      { heading: 'Personal Income Tax', items: ['T1 Personal Income Tax Returns', 'Tax planning and optimization', 'Investment income reporting', 'Rental property income', 'Capital gains reporting', 'Foreign income reporting', 'Self-employed tax returns', 'Pension income splitting', 'RRSP, FHSA and TFSA tax planning', 'Family tax planning'] },
      { heading: 'Corporate Tax Services', items: ['T2 Corporate Income Tax Returns', 'Corporate tax planning', 'Small business tax planning', 'Shareholder tax strategies', 'Dividend planning', 'Year-end tax preparation', 'Corporate reorganizations', 'Business succession tax planning'] },
      { heading: 'Quebec Tax Services', items: ['Quebec Personal Income Tax Returns (TP-1)', 'Quebec Corporate Tax Returns (CO-17)', 'Revenu Québec compliance', 'Quebec tax credits and incentives', 'Tax planning for Quebec residents', 'Interprovincial tax considerations', 'Assistance with Revenu Québec audits and notices'] },
      { heading: 'Estate, Trust & Succession Tax Services', items: ['Estate tax planning', 'Final (terminal) tax returns', 'Estate (T3) Trust Income Tax Returns', 'Trust tax compliance', 'Executor tax assistance', 'Capital gains planning at death', 'Tax-efficient wealth transfer strategies', 'Charitable giving strategies', 'Family succession planning', 'Business succession tax planning'] },
      { heading: 'CRA & Revenu Québec Representation', items: ['CRA audit support', 'Revenu Québec audit assistance', 'Payment arrangement guidance', 'Tax account reviews', 'Notice of Assessment reviews', 'Voluntary disclosures', 'Tax adjustments and amendments'] }
    ]
  ),
  seo: {
    pageTitle: 'Taxes | Capital Pro Group',
    pageDescription: 'Tax filing made simpler.',
    pageKeywords: 'taxes, tax planning, Ottawa',
    pageImage: '/uploads/pages/taxes-banner.jpg',
    pageType: 'website'
  }
});

Object.assign(pages.pages.bookkeeping, {
  title: 'Bookkeeping',
  kind: 'company',
  parentKey: 'companies',
  pageImage: '/uploads/pages/bookkeeping-banner.jpg',
  logo: '/images/logos/bookkeeping.png',
  tagline: 'Take Control of Your Business',
  icon: '/images/content/icon-bookkeeping.png',
  portalUrl: '',
  menuSort: 3,
  showInvestiaDisclaimer: false,
  content: companyHtml(
    '/uploads/pages/bookkeeping-body.jpg',
    'Reliable Bookkeeping That Helps Your Business Grow',
    'As we all know, accurate bookkeeping is the foundation of every successful business. Our bookkeeping professionals provide organized financial records, timely reporting, and ongoing support so you can focus on running your business smoothly.',
    [
      { text: 'Whether you\'re a startup, sole proprietor, or established corporation, we offer customized bookkeeping solutions designed to fit your operations.' },
      { heading: 'Our Bookkeeping Services Include', items: ['Monthly Bookkeeping', 'Bank Reconciliations', 'Accounts Payable', 'Accounts Receivable', 'Payroll Processing', 'GST/HST Registration and Filing', 'QST (Quebec Sales Tax) registration and filing', 'Financial Statements', 'Budget Preparation', 'Cash Flow Reporting', 'Accounting software Online Support', 'Cloud Accounting Solutions', 'Year-End Preparation for Accountants'] }
    ]
  ),
  seo: {
    pageTitle: 'Bookkeeping | Capital Pro Group',
    pageDescription: 'Take control of your business with professional bookkeeping.',
    pageKeywords: 'bookkeeping, accounting, Ottawa',
    pageImage: '/uploads/pages/bookkeeping-banner.jpg',
    pageType: 'website'
  }
});

Object.assign(pages.pages['wealth-management'], {
  title: 'Wealth',
  kind: 'company',
  parentKey: 'companies',
  pageImage: '/uploads/pages/wealth-banner.jpg',
  logo: '/images/logos/wealth.jpg',
  secondaryLogo: '/images/logos/investia.jpg',
  tagline: 'Maximize Your Wealth',
  icon: '/images/content/icon-wealth.png',
  portalUrl: '',
  helpPhone: '(613) 829-1200',
  helpFax: '(613) 829-1202',
  menuSort: 4,
  showInvestiaDisclaimer: true,
  content: companyHtml(
    '/uploads/pages/wealth-body.jpg',
    'Building Your Wealth to Last',
    'Financial planning to Capital Wealth is about more than investments. Our team believes in creating a strategy that helps you achieve your personal and financial goals with confidence.',
    [
      { text: 'Our wealth advisors work closely with individuals, families, and business owners to develop personalized financial plans focused on long-term growth and financial security.' },
      { heading: 'Our Wealth Management Services Include', items: ['Retirement Planning', 'Investment Planning', 'Financial Planning', 'Estate Planning', 'Education Savings Plans (RESP)', 'Registered Retirement Savings Plans (RRSP)', 'Tax-Free Savings Accounts (TFSA)', 'First Home Saving Accounts (FHSA)', 'Retirement Income Strategies', 'Wealth Preservation', 'Risk Management', 'Business Succession Planning'] },
      { heading: 'We Help You', items: ['Prepare for retirement', 'Grow your investment portfolio', 'Reduce financial risk', 'Create long-term wealth', 'Plan for future generations', 'Achieve financial independence'] }
    ]
  ),
  seo: {
    pageTitle: 'Wealth | Capital Pro Group',
    pageDescription: 'Maximize your wealth with Capital Pro Group.',
    pageKeywords: 'wealth management, Ottawa',
    pageImage: '/uploads/pages/wealth-banner.jpg',
    pageType: 'website'
  }
});

Object.assign(pages.pages['income-replacement'], {
  title: 'Insure',
  kind: 'company',
  parentKey: 'companies',
  pageImage: '/uploads/pages/insure-banner.jpg',
  logo: '/images/logos/insure.png',
  tagline: 'Protect Your Family',
  icon: '/images/content/icon-insure.png',
  portalUrl: '',
  menuSort: 5,
  showInvestiaDisclaimer: true,
  content: companyHtml(
    '/uploads/pages/insure-body.jpg',
    'Protect What Matters Most',
    'Life is full of uncertainties, but the right protection can provide confidence and peace of mind.',
    [
      { text: 'Our insurance advisors help individuals, families, and business owners find customized insurance solutions that protect the people, assets, and futures that matter most.' },
      { text: 'Because we\'re all under one roof, your insurance strategy can be fully aligned with your tax, retirement, estate, and wealth planning goals.' },
      { heading: 'Personal Insurance', items: ['Life Insurance', 'Critical Illness Insurance', 'Disability Insurance', 'Health and Dental Insurance', 'Travel Insurance', 'Mortgage Protection Insurance'] },
      { heading: 'Business Insurance', items: ['Key Person Insurance', 'Buy-Sell Agreement Funding', 'Employee Benefits', 'Group Health Plans', 'Business Continuity Planning'] },
      { heading: 'Why Work With Us?', items: ['Personalized recommendations', 'Access to multiple insurance providers', 'Competitive rates', 'Ongoing policy reviews', 'Professional claims support', 'Trusted financial guidance'] }
    ]
  ),
  seo: {
    pageTitle: 'Insure | Capital Pro Group',
    pageDescription: 'Protect your family with insurance solutions.',
    pageKeywords: 'insurance, Ottawa',
    pageImage: '/uploads/pages/insure-banner.jpg',
    pageType: 'website'
  }
});

Object.assign(pages.pages.companies, {
  seo: {
    pageTitle: 'Companies | Capital Pro Group',
    pageDescription: 'Advisory, taxes, bookkeeping, wealth and insurance under one roof.',
    pageKeywords: 'companies, advisory, taxes, bookkeeping, wealth, insurance',
    pageImage: '',
    pageType: 'website'
  }
});

Object.assign(pages.pages['contact-us'], {
  pageImage: '/uploads/pages/contact-banner.jpg',
  seo: { ...pages.pages['contact-us'].seo, pageImage: '/uploads/pages/contact-banner.jpg' }
});

Object.assign(pages.pages['our-team'], {
  pageImage: '/uploads/pages/our-team-banner.jpg',
  seo: { ...pages.pages['our-team'].seo, pageImage: '/uploads/pages/our-team-banner.jpg' }
});

Object.assign(pages.pages.testimonials, {
  pageImage: '/uploads/pages/testimonials-banner.jpg',
  seo: { ...pages.pages.testimonials.seo, pageImage: '/uploads/pages/testimonials-banner.jpg' }
});

pages.pages['news-and-events'] = {
  key: 'news-and-events',
  title: 'News and Events',
  url: '/news',
  kind: 'news',
  pageImage: '/uploads/pages/news-banner.jpg',
  content: '',
  status: 'published',
  includeInMenu: false,
  menuSort: 3,
  seo: {
    pageTitle: 'News and Events | Capital Pro Group',
    pageDescription: 'Latest news and events from Capital Pro Group.',
    pageKeywords: 'news, events',
    pageImage: '/uploads/pages/news-banner.jpg',
    pageType: 'website'
  }
};

Object.assign(pages.pages.home, {
  showInvestiaDisclaimer: true
});

Object.assign(pages.pages['our-goals'], {
  content: '<p>To bring <b>friendly, professional</b> and <b>personal</b> financial services to individuals and businesses <b>under one roof</b>. Just like a <b>strong</b> family supporting its members in different life situations, we work hard and <b>smart</b> to support our clients and offer them <b>comprehensive</b> services in one place, Just like <b>home</b>.</p>',
  pageImage: '/images/about/our-concept.jpg'
});

Object.assign(pages.pages['our-companies'], {
  content: '<p>Numerous independent companies have nurtured through the years together with Capital Pro Group. The aim is to provide you with various services, all under one roof.</p>'
});

Object.assign(pages.pages['why-choose-us'], {
  pageImage: '/images/content/why-choose-fixed.jpg',
  carouselImages: [
    '/images/content/why-choose1.jpg',
    '/images/content/why-choose2.jpg',
    '/images/content/why-choose3.jpg'
  ],
  content: `<p class="text-white">All Under One Roof. Supporting You Like Family.</p>
<p class="text-white">At Capital Pro Group, we believe financial services should be professional, personalized, and coordinated around your needs.</p>
<p class="text-white">Whether you're managing your personal finances, growing a business, planning retirement, protecting your family, or preparing for the future, we're here to support you every step of the way—just like family.</p>
<p class="text-white">At Capital Pro Group, we understand that financial decisions are personal. That's why we never believe in a one-size-fits-all approach.</p>
<p class="text-white">For many clients, that means accessing comprehensive financial services all under one roof. For others, it means working alongside trusted professionals they have built relationships with over the years.</p>
<p class="text-white">We respect the value of loyalty and long-standing professional relationships. Whether you're looking for a complete financial team or simply expert guidance in one specific area, we're here to help.</p>
<p class="text-white">Our role is to support you, provide knowledgeable advice, and work collaboratively with the professionals you trust, while offering in-house solutions whenever they're needed.</p>
<p class="text-white">One place. Just like home.</p>
<p class="text-white">Life is complex, but managing your finances shouldn't be. Instead of working with multiple advisors and service providers, Capital Pro Group offers comprehensive financial services all under one roof, making it easier to coordinate every aspect of your financial life.</p>
<p class="text-white">Our integrated approach allows us to create financial strategies that work together seamlessly, helping individuals, families, and businesses make informed decisions with confidence.</p>
<p class="text-white mb-0">Your Team. Your Choice. We believe strong relationships matter.</p>`
});

['jeremy-scob', 'taylah-tolmie', 'harry-lower', 'paige-grandi', 'pierre-antoniades', 'ramez-r', 'wiss', 'samah-s', 'pierre-a'].forEach((key) => {
  if (pages.pages[key]) delete pages.pages[key];
});

pages.site.logo = '/images/capital-group-logo.jpg';
pages.site.social.twitter = 'https://x.com/capitalprogroup';

fs.writeFileSync(pagesPath, JSON.stringify(pages, null, 2));

const menu = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
menu.menus[0].items = [
  { id: 'home', title: 'Home', type: 'page', link: 'home', sort: 1, active: true, children: [] },
  {
    id: 'companies',
    title: 'Companies',
    type: 'page',
    link: 'companies',
    sort: 2,
    active: true,
    children: [
      { id: 'advisory', title: 'Advisory', type: 'page', link: 'advisory', sort: 1, active: true, children: [] },
      { id: 'taxes', title: 'Taxes', type: 'page', link: 'taxes', sort: 2, active: true, children: [] },
      { id: 'bookkeeping', title: 'Bookkeeping', type: 'page', link: 'bookkeeping', sort: 3, active: true, children: [] },
      { id: 'wealth-management', title: 'Wealth', type: 'page', link: 'wealth-management', sort: 4, active: true, children: [] },
      { id: 'income-replacement', title: 'Insure', type: 'page', link: 'income-replacement', sort: 5, active: true, children: [] }
    ]
  },
  { id: 'news-and-events', title: 'News and Events', type: 'external', link: '/news', sort: 3, active: true, children: [] },
  { id: 'testimonials', title: 'Testimonials', type: 'page', link: 'testimonials', sort: 4, active: true, children: [] },
  {
    id: 'our-team',
    title: 'Our Team',
    type: 'page',
    link: 'our-team',
    sort: 5,
    active: true,
    children: [
      { id: 'our-team-advisory', title: 'Advisory', type: 'external', link: '/our-team/advisory', sort: 1, active: true, children: [] },
      { id: 'our-team-taxes', title: 'Taxes', type: 'external', link: '/our-team/taxes', sort: 2, active: true, children: [] },
      { id: 'our-team-bookkeeping', title: 'Bookkeeping', type: 'external', link: '/our-team/bookkeeping', sort: 3, active: true, children: [] },
      { id: 'our-team-wealth', title: 'Wealth', type: 'external', link: '/our-team/wealth-management', sort: 4, active: true, children: [] },
      { id: 'our-team-insure', title: 'Insure', type: 'external', link: '/our-team/income-replacement', sort: 5, active: true, children: [] }
    ]
  },
  { id: 'contact-us', title: 'Contact Us', type: 'page', link: 'contact-us', sort: 6, active: true, children: [] }
];

const footer = menu.menus.find((m) => m.id === 'footer-menu');
if (footer) {
  footer.items = [
    { id: 'f-news', title: 'News & Events', type: 'external', link: '/news', sort: 1, active: true, children: [] },
    { id: 'f-testimonials', title: 'Testimonials', type: 'page', link: 'testimonials', sort: 2, active: true, children: [] },
    { id: 'f-team', title: 'Our Team', type: 'page', link: 'our-team', sort: 3, active: true, children: [] },
    { id: 'f-contact', title: 'Contact Us', type: 'page', link: 'contact-us', sort: 4, active: true, children: [] }
  ];
}
fs.writeFileSync(menuPath, JSON.stringify(menu, null, 2));

fs.writeFileSync(sliderPath, JSON.stringify({
  slides: [
    { id: 'slide-advisory', image: '/images/slides/advisory-1.jpg', alt: 'Advisory', order: 1, active: true, title: 'Advisory', headlineLine1: 'Your Goals, Our Guidance' },
    { id: 'slide-taxes', image: '/images/slides/taxes-4.jpg', alt: 'Taxes', order: 2, active: true, title: 'Taxes', headlineLine1: 'Tax Filing Made Simpler' },
    { id: 'slide-bookkeeping', image: '/images/slides/bookkeeping-3.jpg', alt: 'Bookkeeping', order: 3, active: true, title: 'Bookkeeping', headlineLine1: 'Take Control of Your Business' },
    { id: 'slide-wealth', image: '/images/slides/wealth-management-1.jpg', alt: 'Wealth', order: 4, active: true, title: 'Wealth', headlineLine1: 'Maximize Your Wealth' },
    { id: 'slide-insure', image: '/images/slides/income-replacement-2.jpg', alt: 'Insure', order: 5, active: true, title: 'Insure', headlineLine1: 'Protect Your Family' }
  ]
}, null, 2));

const news = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
Object.values(news.news).forEach((item) => {
  if (!item.pageImage || item.pageImage.includes('insurance')) {
    item.pageImage = '/uploads/pages/news-banner.jpg';
    if (item.seo) item.seo.pageImage = '/uploads/pages/news-banner.jpg';
  }
});
news.site.logo = '/images/capital-group-logo.jpg';
fs.writeFileSync(newsPath, JSON.stringify(news, null, 2));

console.log('Seeded pages, menu, slider, news');
