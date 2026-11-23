export interface Slide {
    id: string;
    image: string;
    alt: string;
    order: number;
    active: boolean;
    title?: string;
    link?: string;
    buttonText?: string;
    mediaType?: 'image' | 'video';
    videoUrl?: string;
    posterImage?: string;
    durationSeconds?: number;
    mobileImage?: string | null;
    mobileVideo?: string | null;
}
export declare class SliderService {
    private static instance;
    private constructor();
    static getInstance(): SliderService;
    reloadData(): void;
    private static readonly SLIDER_SELECT_CORE;
    private static readonly SLIDER_SELECT_MEDIA;
    private static readonly SLIDER_SELECT_DURATION;
    private static readonly SLIDER_SELECT_MOBILE;
    private withDefaultDuration;
    private querySlides;
    getAllSlides(): Promise<Slide[]>;
    getActiveSlides(): Promise<Slide[]>;
    private writeSequentialOrders;
    private listSlideIdsInOrder;
    getSlideById(id: string): Promise<Slide | null>;
    addSlide(image: string, alt: string, order?: number, title?: string, link?: string, buttonText?: string, mediaType?: 'image' | 'video', videoUrl?: string, posterImage?: string, durationSeconds?: number, mobileImage?: string | null, mobileVideo?: string | null): Promise<Slide>;
    updateSlide(id: string, updates: Partial<Omit<Slide, 'id'>>): Promise<Slide | null>;
    deleteSlide(id: string): Promise<boolean>;
    private moveSlide;
    moveSlideUp(id: string): Promise<boolean>;
    moveSlideDown(id: string): Promise<boolean>;
    toggleSlideActive(id: string): Promise<boolean>;
    getImageUrl(filename: string): string;
    private generateId;
}
export declare const sliderService: SliderService;
//# sourceMappingURL=sliderService.d.ts.map