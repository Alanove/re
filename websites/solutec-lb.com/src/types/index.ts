// SEO Data Types
export interface SeoData {
  pageTitle: string;
  pageDescription: string;
  pageKeywords: string;
  pageUrl: string;
  pageImage: string;
  pageType: string;
  pageRobots?: string;
}

// Page Data Types
export interface PageData {
  key: string;
  title: string;
  url: string;
  content?: string;
  pageImage?: string;
  seo: SeoData;
}

export interface MenuItem {
  key: string;
  title: string;
  url: string;
  active?: boolean;
  children?: MenuItem[];
}

// Site Data Types
export interface SocialMedia {
  linkedin?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
}

export interface SiteData {
  name: string;
  domain: string;
  description: string;
  logo: string;
  favicon: string;
  social: SocialMedia;
}

export interface PagesData {
  pages: Record<string, PageData>;
  site: SiteData;
}

// Project Data Types
export interface ProjectDetails {
  project: string;
  architect?: string;
  developer?: string;
  contractor?: string;
  client?: string;
  location: string;
  year: string;
}

export interface ProjectWork {
  description: string;
  folder_name: string;
  details: ProjectDetails;
  scope_of_work: string[];
  images: string[];
  categories: string[];
}

export interface Project {
  title: string;
  folder_name?: string;
  project_image: string;
  works: ProjectWork[];
  categories: string[];
  url: string;
  // New project detail fields
  bau?: string;
  area?: string;
  size?: string;
  quantity?: string;
  contractor?: string;
  architect?: string;
  client?: string;
  scope?: string;
  country?: string;
  mapLocation?: string;
  land?: string;
  capacity?: string;
  districts?: string;
  owner?: string;
  consultant?: string;
  all_text?: string;
  priority?: number;
}

export interface ProjectsData {
  projects: Project[];
}

// Analytics Data Types
export interface CategoryAnalytics {
  name: string;
  url: string;
  real: string[];
}

export interface CountryAnalytics {
  name: string;
  url: string;
  real: string[];
}

export interface ProjectAnalytics {
  categories: CategoryAnalytics[];
  countries: CountryAnalytics[];
}

// Filter Types
export interface ProjectFilters {
  categoryUrl?: string | undefined;
  countryUrl?: string | undefined;
}

// Express Request/Response Extensions
export interface RequestWithLocals extends Express.Request {
  locals: {
    items: MenuItem[];
    selected: string;
    siteData: SiteData;
    pageTitle: string;
    pageDescription: string;
    pageKeywords: string;
    pageUrl: string;
    pageImage: string;
    pageType: string;
    pageRobots: string;
    bodyClass: string;
  };
}

// Service Interfaces
export interface IPagesService {
  getPagesData(): PagesData;
  getMenuItems(): MenuItem[];
  getPageData(pageKey: string): PageData | null;
  getSiteData(): SiteData;
  getSeoData(pageKey: string, customData?: Partial<SeoData>): SeoData;
  getPageKeyFromPath(path: string): string;
}

export interface IProjectsService {
  getProjects(): ProjectsData;
  getAnalytics(): ProjectAnalytics;
  getCategories(): string[];
  getCountries(): string[];
  getCategoryByUrl(url: string): CategoryAnalytics | undefined;
  getCountryByUrl(url: string): CountryAnalytics | undefined;
  getFilteredProjects(filters: ProjectFilters): Project[];
  getTopCategories(limit?: number): string[];
  getTopLocations(limit?: number): string[];
  getProjectByUrl(url: string): Project | undefined;
} 