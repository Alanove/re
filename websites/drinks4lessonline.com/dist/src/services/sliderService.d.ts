import { Slide } from '../../admin/services/sliderService';
export declare class SliderService {
    private static instance;
    static getInstance(): SliderService;
    getActiveSlides(): Promise<Slide[]>;
    getAllSlides(): Promise<Slide[]>;
    getSlideById(id: string): Promise<Slide | null>;
    reloadData(): void;
}
export declare const sliderService: SliderService;
//# sourceMappingURL=sliderService.d.ts.map