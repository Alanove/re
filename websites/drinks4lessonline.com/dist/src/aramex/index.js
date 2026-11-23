"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPickupJson = exports.trackShipmentsJson = exports.parseCreateShipmentsResponse = exports.getCreateShipmentsUrl = exports.createShipmentsJson = exports.calculateRateJson = exports.fetchStates = exports.fetchCities = exports.fetchCountries = exports.getClientInfo = exports.DEFAULT_DOMESTIC_METHODS = exports.DEFAULT_INTERNATIONAL_METHODS = void 0;
exports.getAramexService = getAramexService;
const path_1 = __importDefault(require("path"));
const aramexServicePath = path_1.default.join(process.cwd(), 'src', 'aramex', 'aramex-service.js');
const AramexServiceClass = require(aramexServicePath);
exports.DEFAULT_INTERNATIONAL_METHODS = {
    DPX: 'Value Express Parcels',
    EDX: 'Economy Document Express',
    EPX: 'Economy Parcel Express',
    GDX: 'Ground Document Express',
    GPX: 'Ground Parcel Express',
    IBD: 'International deferred',
    PDX: 'Priority Document Express',
    PLX: 'Priority Letter Express (<.5 kg Docs)',
    PPX: 'Priority Parcel Express',
    ABX: 'ABX',
    PXP: 'Premium Express',
    DGX: 'Dangerous Goods Express',
    DGG: 'Dangerous Goods Ground'
};
exports.DEFAULT_DOMESTIC_METHODS = {
    BLK: 'Special: Bulk Mail Delivery',
    BLT: 'Domestic - Bullet Delivery',
    CDA: 'Special Delivery',
    CDS: 'E-commerce/Special Credit Card Delivery',
    OND: 'Overnight (Document)',
    ONP: 'Overnight (Parcel)',
    P24: 'Road Freight 24 hours service',
    P48: 'Road Freight 48 hours service',
    PEC: 'Economy Delivery',
    PEX: 'Road Express',
    SMD: 'Same Day (Document)',
    SMP: 'Same Day (Parcel)',
    SDD: 'Same Day Delivery',
    HVY: 'Heavy (20kgs and more)',
    LEX: 'LEX product type'
};
function getAramexService(config) {
    return new AramexServiceClass(config);
}
var clientInfo_1 = require("./clientInfo");
Object.defineProperty(exports, "getClientInfo", { enumerable: true, get: function () { return clientInfo_1.getClientInfo; } });
var aramexApiClient_1 = require("./aramexApiClient");
Object.defineProperty(exports, "fetchCountries", { enumerable: true, get: function () { return aramexApiClient_1.fetchCountries; } });
Object.defineProperty(exports, "fetchCities", { enumerable: true, get: function () { return aramexApiClient_1.fetchCities; } });
Object.defineProperty(exports, "fetchStates", { enumerable: true, get: function () { return aramexApiClient_1.fetchStates; } });
Object.defineProperty(exports, "calculateRateJson", { enumerable: true, get: function () { return aramexApiClient_1.calculateRate; } });
Object.defineProperty(exports, "createShipmentsJson", { enumerable: true, get: function () { return aramexApiClient_1.createShipments; } });
Object.defineProperty(exports, "getCreateShipmentsUrl", { enumerable: true, get: function () { return aramexApiClient_1.getCreateShipmentsUrl; } });
Object.defineProperty(exports, "parseCreateShipmentsResponse", { enumerable: true, get: function () { return aramexApiClient_1.parseCreateShipmentsResponse; } });
Object.defineProperty(exports, "trackShipmentsJson", { enumerable: true, get: function () { return aramexApiClient_1.trackShipments; } });
Object.defineProperty(exports, "createPickupJson", { enumerable: true, get: function () { return aramexApiClient_1.createPickup; } });
//# sourceMappingURL=index.js.map