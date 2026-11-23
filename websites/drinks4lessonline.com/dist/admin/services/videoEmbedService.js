"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoEmbedService = exports.VideoEmbedService = void 0;
class VideoEmbedService {
    constructor() { }
    static getInstance() {
        if (!VideoEmbedService.instance) {
            VideoEmbedService.instance = new VideoEmbedService();
        }
        return VideoEmbedService.instance;
    }
    extractYouTubeVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/watch\?.*v=([^&\n?#]+)/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }
    extractVimeoVideoId(url) {
        const patterns = [
            /vimeo\.com\/(\d+)/,
            /vimeo\.com\/channels\/[^\/]+\/(\d+)/,
            /vimeo\.com\/groups\/[^\/]+\/videos\/(\d+)/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }
    extractRutubeVideoId(url) {
        const patterns = [
            /rutube\.ru\/video\/([a-zA-Z0-9]+)/,
            /rutube\.ru\/play\/embed\/([a-zA-Z0-9]+)/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }
    detectProvider(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return 'youtube';
        }
        if (url.includes('vimeo.com')) {
            return 'vimeo';
        }
        if (url.includes('rutube.ru')) {
            return 'rutube';
        }
        return null;
    }
    isUrl(str) {
        if (!str || typeof str !== 'string') {
            return false;
        }
        try {
            if (str.trim().match(/^(https?:\/\/|www\.|[a-z0-9-]+\.(com|ru|org|net|io|be))/i)) {
                return true;
            }
            new URL(str);
            return true;
        }
        catch {
            return false;
        }
    }
    isHtml(str) {
        if (!str || typeof str !== 'string') {
            return false;
        }
        const htmlPattern = /<[^>]+>|&[a-z]+;|&#[0-9]+;/i;
        const embedPattern = /<div|<iframe|<embed|<object|class="video-wrapper"|style="position: relative/i;
        return htmlPattern.test(str) || embedPattern.test(str);
    }
    cleanTitle(title, fallback) {
        if (!title || typeof title !== 'string') {
            return fallback;
        }
        const trimmed = title.trim();
        if (this.isUrl(trimmed)) {
            return fallback;
        }
        if (this.isHtml(trimmed)) {
            return fallback;
        }
        return trimmed;
    }
    async fetchYouTubeVideo(url, videoId) {
        try {
            const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            const response = await fetch(oEmbedUrl);
            if (!response.ok) {
                throw new Error(`YouTube oEmbed API returned ${response.status}`);
            }
            const data = await response.json();
            const embedUrl = `https://www.youtube.com/embed/${videoId}`;
            const embed = `<div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;"><iframe width="560" height="315" src="${embedUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
            return {
                title: this.cleanTitle(data.title, 'YouTube Video'),
                thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                embed: embed,
                width: data.width || 560,
                height: data.height || 315,
                provider: 'youtube'
            };
        }
        catch (error) {
            console.error('Error fetching YouTube video:', error);
            return null;
        }
    }
    async fetchVimeoVideo(url, videoId) {
        try {
            const oEmbedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
            const response = await fetch(oEmbedUrl);
            if (!response.ok) {
                throw new Error(`Vimeo oEmbed API returned ${response.status}`);
            }
            const data = await response.json();
            const embed = `<div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;"><iframe src="${data.embed_url}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
            return {
                title: this.cleanTitle(data.title, 'Vimeo Video'),
                thumbnail: data.thumbnail_url || '',
                embed: embed,
                description: data.description || undefined,
                width: data.width || 640,
                height: data.height || 360,
                provider: 'vimeo'
            };
        }
        catch (error) {
            console.error('Error fetching Vimeo video:', error);
            return null;
        }
    }
    async fetchRutubeVideo(url, videoId) {
        try {
            const apiUrl = `https://rutube.ru/api/video/${videoId}/`;
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`Rutube API returned ${response.status}`);
            }
            const data = await response.json();
            let thumbnail = '';
            if (data.thumbnail_url) {
                if (data.thumbnail_url.startsWith('http')) {
                    thumbnail = data.thumbnail_url;
                }
                else {
                    thumbnail = `https://pic.rutube.ru${data.thumbnail_url}`;
                }
            }
            const embed = `<div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;"><iframe src="https://rutube.ru/play/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
            return {
                title: this.cleanTitle(data.title, 'Rutube Video'),
                thumbnail: thumbnail,
                embed: embed,
                description: data.description || undefined,
                width: data.width || 640,
                height: data.height || 360,
                provider: 'rutube'
            };
        }
        catch (error) {
            console.error('Error fetching Rutube video:', error);
            const embed = `<div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;"><iframe src="https://rutube.ru/play/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
            return {
                title: 'Rutube Video',
                thumbnail: '',
                embed: embed,
                width: 640,
                height: 360,
                provider: 'rutube'
            };
        }
    }
    async fetchVideoMetadata(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }
        const provider = this.detectProvider(url);
        if (!provider) {
            return null;
        }
        if (provider === 'youtube') {
            const videoId = this.extractYouTubeVideoId(url);
            if (!videoId) {
                return null;
            }
            return await this.fetchYouTubeVideo(url, videoId);
        }
        if (provider === 'vimeo') {
            const videoId = this.extractVimeoVideoId(url);
            if (!videoId) {
                return null;
            }
            return await this.fetchVimeoVideo(url, videoId);
        }
        if (provider === 'rutube') {
            const videoId = this.extractRutubeVideoId(url);
            if (!videoId) {
                return null;
            }
            return await this.fetchRutubeVideo(url, videoId);
        }
        return null;
    }
}
exports.VideoEmbedService = VideoEmbedService;
exports.videoEmbedService = VideoEmbedService.getInstance();
//# sourceMappingURL=videoEmbedService.js.map