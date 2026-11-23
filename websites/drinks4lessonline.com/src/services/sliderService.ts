// Public-facing slider service - delegates to admin service
import { SliderService as AdminSliderService, Slide } from '../../admin/services/sliderService';

const adminSliderService = AdminSliderService.getInstance();

export class SliderService {
  private static instance: SliderService;

  public static getInstance(): SliderService {
    if (!SliderService.instance) {
      SliderService.instance = new SliderService();
    }
    return SliderService.instance;
  }

  async getActiveSlides(): Promise<Slide[]> {
    return await adminSliderService.getActiveSlides();
  }

  async getAllSlides(): Promise<Slide[]> {
    return await adminSliderService.getAllSlides();
  }

  async getSlideById(id: string): Promise<Slide | null> {
    return await adminSliderService.getSlideById(id);
  }

  reloadData(): void {
    adminSliderService.reloadData();
  }
}

export const sliderService = SliderService.getInstance();
