"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SliderController = void 0;
const adminMenuService_1 = require("../services/adminMenuService");
const sliderService_1 = require("../services/sliderService");
const siteSettingsService_1 = require("../services/siteSettingsService");
const storageService_1 = require("../services/storageService");
const menuService = adminMenuService_1.AdminMenuService.getInstance();
const sliderService = sliderService_1.SliderService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const storageService = storageService_1.StorageService.getInstance();
const upload = storageService.createSliderUploadConfig();
function parseSlideDurationSecondsInput(body) {
    const keys = ['duration_seconds_backup', 'duration_seconds', 'durationSeconds'];
    let raw;
    for (const key of keys) {
        const v = body[key];
        if (v === undefined || v === null)
            continue;
        const piece = Array.isArray(v) ? v[v.length - 1] : v;
        const s = String(piece).trim();
        if (s !== '') {
            raw = piece;
            break;
        }
    }
    if (raw === undefined || raw === null)
        return undefined;
    const n = parseInt(String(raw).trim(), 10);
    if (isNaN(n) || n < 1)
        return undefined;
    return Math.min(600, n);
}
function parseSlideDurationSecondsForCreate(body) {
    return parseSlideDurationSecondsInput(body) ?? 5;
}
function resolveSlideDurationSecondsForEdit(body, existingSeconds) {
    const parsed = parseSlideDurationSecondsInput(body);
    if (parsed !== undefined)
        return parsed;
    const ex = existingSeconds != null ? Number(existingSeconds) : NaN;
    if (!isNaN(ex) && ex > 0)
        return Math.min(600, Math.floor(ex));
    return 5;
}
class SliderController {
    static handleSliderUpload(req, res, next) {
        const uploadHandler = upload.fields([
            { name: 'image', maxCount: 1 },
            { name: 'video', maxCount: 1 },
            { name: 'mobile_image', maxCount: 1 },
            { name: 'mobile_video', maxCount: 1 }
        ]);
        uploadHandler(req, res, (err) => {
            if (err) {
                console.error('File upload error:', err);
                let errorMessage = 'File upload failed';
                if (err.code === 'LIMIT_FILE_SIZE') {
                    errorMessage = 'File is too large. Maximum size: 10MB for images, 100MB for videos';
                }
                else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    errorMessage = 'Unexpected file field. Please use the correct upload fields';
                }
                else if (err.message) {
                    errorMessage = err.message;
                }
                const redirectUrl = req.params.id
                    ? `/admin/slider/${req.params.id}/edit?error=${encodeURIComponent(errorMessage)}`
                    : '/admin/slider/create?error=' + encodeURIComponent(errorMessage);
                res.redirect(redirectUrl);
                return;
            }
            next();
        });
    }
    static async slider(req, res) {
        try {
            const slides = await sliderService.getAllSlides();
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = res.locals.t || ((key) => key);
            res.render('slider/slider', {
                title: t('slider.title'),
                pageTitle: t('slider.pageTitle'),
                pageSubtitle: t('slider.pageSubtitle'),
                slides: slides,
                siteTitle: siteTitle,
                success: req.query['success'],
                error: req.query['error']
            });
        }
        catch (error) {
            console.error('Error rendering slider:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async createSlide(req, res) {
        try {
            const siteTitle = await siteSettingsService.getSiteTitle();
            const emptySlide = {
                id: '',
                image: '',
                alt: '',
                order: 1,
                active: true,
                title: '',
                link: '',
                buttonText: '',
                mediaType: 'image',
                videoUrl: '',
                durationSeconds: 5,
                mobileImage: '',
                mobileVideo: ''
            };
            const copyFrom = typeof req.query['copyFrom'] === 'string' ? req.query['copyFrom'].trim() : '';
            let slide = emptySlide;
            if (copyFrom) {
                const src = await sliderService.getSlideById(copyFrom);
                if (src) {
                    slide = {
                        id: '',
                        image: '',
                        alt: src.alt || '',
                        order: 1,
                        active: src.active,
                        title: src.title || '',
                        link: src.link || '',
                        buttonText: src.buttonText || '',
                        mediaType: src.mediaType || 'image',
                        videoUrl: '',
                        durationSeconds: src.durationSeconds != null && src.durationSeconds > 0 ? src.durationSeconds : 5,
                        mobileImage: '',
                        mobileVideo: ''
                    };
                }
            }
            const t = res.locals.t || ((key) => key);
            res.render('slider/edit-slide', {
                title: t('slider.addNewSlide'),
                pageTitle: t('slider.addNewSlide'),
                pageSubtitle: t('slider.pageSubtitle'),
                slide: slide,
                siteTitle: siteTitle,
                isEdit: false,
                error: typeof req.query['error'] === 'string' ? req.query['error'] : undefined
            });
        }
        catch (error) {
            console.error('Error rendering create slide:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async createSlidePost(req, res) {
        try {
            console.log('Create slide post - body:', req.body);
            console.log('Create slide post - files:', req.files);
            const { alt, order, title, link, buttonText } = req.body;
            const durationSeconds = parseSlideDurationSecondsForCreate(req.body);
            const files = req.files;
            if (!alt || alt.trim() === '') {
                console.log('Validation failed: Alt text is required');
                res.redirect('/admin/slider/create?error=Alt text is required');
                return;
            }
            const imageFile = files?.image?.[0];
            const videoFile = files?.video?.[0];
            const mobileImageFile = files?.mobile_image?.[0];
            const mobileVideoFile = files?.mobile_video?.[0];
            if (!imageFile && !videoFile) {
                console.log('No files uploaded');
                res.redirect('/admin/slider/create?error=Please upload at least an image or video');
                return;
            }
            try {
                const orderText = order === undefined || order === null ? '' : String(order).trim();
                const parsedOrder = orderText === '' ? NaN : parseInt(orderText, 10);
                const orderNumber = !Number.isNaN(parsedOrder) && parsedOrder !== 1 ? parsedOrder : undefined;
                console.log('Parsed order:', orderNumber === undefined ? 'first' : orderNumber);
                const mediaType = videoFile ? 'video' : 'image';
                console.log('Media type:', mediaType);
                const imageFilename = imageFile ? imageFile.filename : (videoFile ? videoFile.filename : '');
                const videoUrl = videoFile ? videoFile.filename : undefined;
                const posterImage = (videoFile && imageFile) ? imageFile.filename : undefined;
                const cleanTitle = title && title.trim() !== '' ? title.trim() : undefined;
                const cleanLink = link && link.trim() !== '' ? link.trim() : undefined;
                const cleanButtonText = buttonText && buttonText.trim() !== '' ? buttonText.trim() : undefined;
                if (cleanButtonText && !cleanLink) {
                    res.redirect('/admin/slider/create?error=Link URL is required when button text is provided');
                    return;
                }
                const newSlide = await sliderService.addSlide(imageFilename, alt.trim(), orderNumber, cleanTitle, cleanLink, cleanButtonText, mediaType, videoUrl, posterImage, durationSeconds, mobileImageFile ? mobileImageFile.filename : null, mobileVideoFile ? mobileVideoFile.filename : null);
                console.log('Slide created successfully:', newSlide);
                res.redirect('/admin/slider?success=Slide added successfully');
            }
            catch (error) {
                console.error('Error creating slide:', error);
                res.redirect('/admin/slider/create?error=Failed to create slide');
            }
        }
        catch (error) {
            console.error('Error in create slide post:', error);
            res.redirect('/admin/slider/create?error=Internal server error');
        }
    }
    static async editSlide(req, res) {
        try {
            const { id } = req.params;
            const slide = await sliderService.getSlideById(id);
            if (!slide) {
                res.redirect('/admin/slider?error=Slide not found');
                return;
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = res.locals.t || ((key) => key);
            res.render('slider/edit-slide', {
                title: t('slider.editSlide'),
                pageTitle: t('slider.editSlide'),
                pageSubtitle: t('slider.pageSubtitle'),
                slide: slide,
                siteTitle: siteTitle,
                isEdit: true
            });
        }
        catch (error) {
            console.error('Error rendering edit slide:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async editSlidePost(req, res) {
        try {
            const { id } = req.params;
            const { alt, order, title, link, buttonText } = req.body;
            const files = req.files;
            if (!alt || alt.trim() === '') {
                res.redirect(`/admin/slider/${id}/edit?error=Alt text is required`);
                return;
            }
            try {
                const existingSlide = await sliderService.getSlideById(id);
                if (!existingSlide) {
                    res.redirect('/admin/slider?error=Slide not found');
                    return;
                }
                const updates = {
                    alt: alt.trim()
                };
                if (order !== undefined && order !== null && String(order).trim() !== '') {
                    const orderNumber = parseInt(String(order), 10);
                    if (!isNaN(orderNumber)) {
                        updates.order = orderNumber;
                    }
                }
                const cleanTitle = title && title.trim() !== '' ? title.trim() : undefined;
                const cleanLink = link && link.trim() !== '' ? link.trim() : undefined;
                const cleanButtonText = buttonText && buttonText.trim() !== '' ? buttonText.trim() : undefined;
                if (cleanButtonText && !cleanLink) {
                    res.redirect(`/admin/slider/${id}/edit?error=Link URL is required when button text is provided`);
                    return;
                }
                updates.title = cleanTitle;
                updates.link = cleanLink;
                updates.buttonText = cleanButtonText;
                updates.durationSeconds = resolveSlideDurationSecondsForEdit(req.body, existingSlide.durationSeconds);
                updates.active =
                    req.body.active === 'on' ||
                        req.body.active === true ||
                        req.body.active === 'true' ||
                        req.body.active === '1';
                const imageFile = files?.image?.[0];
                const videoFile = files?.video?.[0];
                const mobileImageFile = files?.mobile_image?.[0];
                const mobileVideoFile = files?.mobile_video?.[0];
                if (imageFile || videoFile) {
                    const isVideoSlide = existingSlide.mediaType === 'video' && !!existingSlide.videoUrl;
                    if (imageFile && videoFile) {
                        updates.mediaType = 'video';
                        updates.videoUrl = videoFile.filename;
                        updates.image = imageFile.filename;
                        updates.posterImage = imageFile.filename;
                    }
                    else if (videoFile) {
                        updates.mediaType = 'video';
                        updates.videoUrl = videoFile.filename;
                    }
                    else if (imageFile) {
                        if (isVideoSlide) {
                            updates.mediaType = 'video';
                            updates.image = imageFile.filename;
                            updates.posterImage = imageFile.filename;
                        }
                        else {
                            updates.mediaType = 'image';
                            updates.image = imageFile.filename;
                            updates.videoUrl = null;
                            updates.posterImage = null;
                        }
                    }
                }
                const removeMobileImage = req.body.remove_mobile_image === '1' || req.body.remove_mobile_image === 'on';
                const removeMobileVideo = req.body.remove_mobile_video === '1' || req.body.remove_mobile_video === 'on';
                if (mobileImageFile) {
                    updates.mobileImage = mobileImageFile.filename;
                }
                else if (removeMobileImage) {
                    updates.mobileImage = null;
                }
                if (mobileVideoFile) {
                    updates.mobileVideo = mobileVideoFile.filename;
                }
                else if (removeMobileVideo) {
                    updates.mobileVideo = null;
                }
                const updatedSlide = await sliderService.updateSlide(id, updates);
                if (!updatedSlide) {
                    res.redirect('/admin/slider?error=Slide not found');
                    return;
                }
                res.redirect('/admin/slider?success=Slide updated successfully');
            }
            catch (error) {
                console.error('Error updating slide:', error);
                res.redirect(`/admin/slider/${id}/edit?error=Failed to update slide`);
            }
        }
        catch (error) {
            console.error('Error in edit slide post:', error);
            res.redirect(`/admin/slider/${req.params.id}/edit?error=Internal server error`);
        }
    }
    static async deleteSlide(req, res) {
        try {
            const { id } = req.params;
            const success = await sliderService.deleteSlide(id);
            if (success) {
                res.json({ success: true, message: 'Slide deleted successfully' });
            }
            else {
                res.status(404).json({ success: false, message: 'Slide not found' });
            }
        }
        catch (error) {
            console.error('Error deleting slide:', error);
            res.status(500).json({ success: false, message: 'Failed to delete slide' });
        }
    }
    static async moveSlideUp(req, res) {
        try {
            const { id } = req.params;
            const success = await sliderService.moveSlideUp(id);
            if (success) {
                res.redirect('/admin/slider?success=Slide moved up successfully');
            }
            else {
                res.redirect('/admin/slider?error=Cannot move slide up');
            }
        }
        catch (error) {
            console.error('Error moving slide up:', error);
            res.redirect('/admin/slider?error=Failed to move slide');
        }
    }
    static async moveSlideDown(req, res) {
        try {
            const { id } = req.params;
            const success = await sliderService.moveSlideDown(id);
            if (success) {
                res.redirect('/admin/slider?success=Slide moved down successfully');
            }
            else {
                res.redirect('/admin/slider?error=Cannot move slide down');
            }
        }
        catch (error) {
            console.error('Error moving slide down:', error);
            res.redirect('/admin/slider?error=Failed to move slide');
        }
    }
    static async toggleSlideActive(req, res) {
        try {
            const { id } = req.params;
            const success = await sliderService.toggleSlideActive(id);
            if (success) {
                res.redirect('/admin/slider?success=Slide status updated successfully');
            }
            else {
                res.redirect('/admin/slider?error=Slide not found');
            }
        }
        catch (error) {
            console.error('Error toggling slide active:', error);
            res.redirect('/admin/slider?error=Failed to update slide status');
        }
    }
    static async uploadImage(req, res) {
        try {
            upload.single('image')(req, res, (err) => {
                if (err) {
                    console.error('File upload error:', err);
                    res.status(400).json({ error: 'File upload failed' });
                    return;
                }
                const file = req.file;
                if (!file) {
                    res.status(400).json({ error: 'No file uploaded' });
                    return;
                }
                res.json({
                    success: true,
                    filename: file.filename,
                    url: sliderService.getImageUrl(file.filename)
                });
            });
        }
        catch (error) {
            console.error('Error uploading image:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.SliderController = SliderController;
//# sourceMappingURL=sliderController.js.map