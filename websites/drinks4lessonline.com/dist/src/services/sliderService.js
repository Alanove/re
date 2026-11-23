"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sliderService = exports.SliderService = void 0;
const sliderService_1 = require("../../admin/services/sliderService");
const adminSliderService = sliderService_1.SliderService.getInstance();
class SliderService {
    static getInstance() {
        if (!SliderService.instance) {
            SliderService.instance = new SliderService();
        }
        return SliderService.instance;
    }
    async getActiveSlides() {
        return await adminSliderService.getActiveSlides();
    }
    async getAllSlides() {
        return await adminSliderService.getAllSlides();
    }
    async getSlideById(id) {
        return await adminSliderService.getSlideById(id);
    }
    reloadData() {
        adminSliderService.reloadData();
    }
}
exports.SliderService = SliderService;
exports.sliderService = SliderService.getInstance();
//# sourceMappingURL=sliderService.js.map