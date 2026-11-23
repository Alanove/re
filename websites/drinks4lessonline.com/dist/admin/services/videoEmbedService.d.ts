interface VideoEmbedData {
    title: string;
    thumbnail: string;
    embed: string;
    description?: string;
    width?: number;
    height?: number;
    provider?: string;
}
export declare class VideoEmbedService {
    private static instance;
    private constructor();
    static getInstance(): VideoEmbedService;
    private extractYouTubeVideoId;
    private extractVimeoVideoId;
    private extractRutubeVideoId;
    private detectProvider;
    private isUrl;
    private isHtml;
    private cleanTitle;
    private fetchYouTubeVideo;
    private fetchVimeoVideo;
    private fetchRutubeVideo;
    fetchVideoMetadata(url: string): Promise<VideoEmbedData | null>;
}
export declare const videoEmbedService: VideoEmbedService;
export {};
//# sourceMappingURL=videoEmbedService.d.ts.map