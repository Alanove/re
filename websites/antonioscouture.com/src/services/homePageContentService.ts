import { db } from '../config/database';

export interface HomeServiceColumn {
  title: string;
  bodyHtml: string;
  buttonText: string;
  buttonLink: string;
}

export interface HomePageContent {
  serviceColumns: HomeServiceColumn[];
}

interface HomePageContentRow {
  care_title: string | null;
  care_body_html: string | null;
  care_button_text: string | null;
  care_button_link: string | null;
  appointments_title: string | null;
  appointments_body_html: string | null;
  appointments_button_text: string | null;
  appointments_button_link: string | null;
  bridal_title: string | null;
  bridal_body_html: string | null;
  bridal_button_text: string | null;
  bridal_button_link: string | null;
}

const FALLBACK: HomePageContent = {
  serviceColumns: [
    {
      title: 'Client Services',
      bodyHtml:
        '<p>Our Client Services team is available to assist with enquiries, appointments, and bespoke requests.</p>',
      buttonText: 'Email us',
      buttonLink: '/contact-us'
    },
    {
      title: 'Appointments',
      bodyHtml:
        '<p>Connect with an in-house stylist for a shopping experience tailored for you.</p>',
      buttonText: 'Request an Appointment',
      buttonLink: '/contact-us?subject=appointment'
    },
    {
      title: 'Client Services',
      bodyHtml: '<p>Speak with our team for immediate assistance.</p>',
      buttonText: 'Call us',
      buttonLink: '/contact-us'
    }
  ]
};

function nz(v: string | null | undefined, fb: string): string {
  if (v == null) return fb;
  const s = String(v).trim();
  return s === '' ? fb : v;
}

function mapRow(row: HomePageContentRow): HomePageContent {
  const fb = FALLBACK;
  return {
    serviceColumns: [
      {
        title: nz(row.care_title, fb.serviceColumns[0].title),
        bodyHtml: nz(row.care_body_html, fb.serviceColumns[0].bodyHtml),
        buttonText: nz(row.care_button_text, fb.serviceColumns[0].buttonText),
        buttonLink: nz(row.care_button_link, fb.serviceColumns[0].buttonLink)
      },
      {
        title: nz(row.appointments_title, fb.serviceColumns[1].title),
        bodyHtml: nz(row.appointments_body_html, fb.serviceColumns[1].bodyHtml),
        buttonText: nz(row.appointments_button_text, fb.serviceColumns[1].buttonText),
        buttonLink: nz(row.appointments_button_link, fb.serviceColumns[1].buttonLink)
      },
      {
        title: nz(row.bridal_title, fb.serviceColumns[2].title),
        bodyHtml: nz(row.bridal_body_html, fb.serviceColumns[2].bodyHtml),
        buttonText: nz(row.bridal_button_text, fb.serviceColumns[2].buttonText),
        buttonLink: nz(row.bridal_button_link, fb.serviceColumns[2].buttonLink)
      }
    ]
  };
}

export class HomePageContentService {
  private static instance: HomePageContentService;

  public static getInstance(): HomePageContentService {
    if (!HomePageContentService.instance) {
      HomePageContentService.instance = new HomePageContentService();
    }
    return HomePageContentService.instance;
  }

  public async getHomePageContent(): Promise<HomePageContent> {
    try {
      const [rows] = await db.query(
        `SELECT * FROM home_page_content WHERE id = 1 LIMIT 1`
      );
      const list = rows as HomePageContentRow[];
      if (!list?.length) {
        return {
          ...FALLBACK,
          serviceColumns: FALLBACK.serviceColumns.map((c) => ({ ...c }))
        };
      }
      return mapRow(list[0] as HomePageContentRow);
    } catch (e) {
      console.warn('[homePageContent] falling back to defaults:', e);
      return {
        ...FALLBACK,
        serviceColumns: FALLBACK.serviceColumns.map((c) => ({ ...c }))
      };
    }
  }

  public async saveServiceColumns(columns: HomeServiceColumn[]): Promise<boolean> {
    if (columns.length !== 3) {
      return false;
    }
    const [c0, c1, c2] = columns;
    try {
      await db.execute(
        `UPDATE home_page_content SET
          care_title = ?, care_body_html = ?, care_button_text = ?, care_button_link = ?,
          appointments_title = ?, appointments_body_html = ?, appointments_button_text = ?, appointments_button_link = ?,
          bridal_title = ?, bridal_body_html = ?, bridal_button_text = ?, bridal_button_link = ?
        WHERE id = 1`,
        [
          c0.title,
          c0.bodyHtml,
          c0.buttonText,
          c0.buttonLink,
          c1.title,
          c1.bodyHtml,
          c1.buttonText,
          c1.buttonLink,
          c2.title,
          c2.bodyHtml,
          c2.buttonText,
          c2.buttonLink
        ]
      );
      return true;
    } catch (e) {
      console.error('[homePageContent] save service columns failed:', e);
      return false;
    }
  }

  /** @deprecated Use saveServiceColumns */
  public async saveHomePageContent(data: HomePageContent): Promise<boolean> {
    return this.saveServiceColumns(data.serviceColumns);
  }
}

export default HomePageContentService;
