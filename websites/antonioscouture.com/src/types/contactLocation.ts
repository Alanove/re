/** Storefront / admin contact location (boutique, flagship, partner, etc.) */
export interface ContactLocation {
  label: string;
  addressLines: string[];
  phones: string[];
  emails: string[];
  mapUrl?: string;
}
