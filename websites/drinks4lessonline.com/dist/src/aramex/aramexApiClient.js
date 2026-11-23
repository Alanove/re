"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCreateShipmentsUrl = getCreateShipmentsUrl;
exports.fetchCountries = fetchCountries;
exports.fetchCities = fetchCities;
exports.fetchStates = fetchStates;
exports.calculateRate = calculateRate;
exports.createShipments = createShipments;
exports.parseCreateShipmentsResponse = parseCreateShipmentsResponse;
exports.trackShipments = trackShipments;
exports.createPickup = createPickup;
const fast_xml_parser_1 = require("fast-xml-parser");
const clientInfo_1 = require("./clientInfo");
const TRANSACTION = {
    Reference1: '',
    Reference2: '',
    Reference3: '',
    Reference4: '',
    Reference5: ''
};
const LOCATION_BASE = process.env.ARAMEX_LOCATION_BASE_URL || 'https://ws.aramex.net/ShippingAPI.V2/Location/Service_1_0.svc/json';
const RATE_CALCULATOR_URL = process.env.ARAMEX_RATE_CALCULATOR_URL || 'https://ws.aramex.net/ShippingAPI.V2/RateCalculator/Service_1_0.svc/json/CalculateRate';
const SHIPPING_BASE = process.env.ARAMEX_SHIPPING_BASE_URL || 'https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json';
function getCreateShipmentsUrl() {
    return `${SHIPPING_BASE}/CreateShipments`;
}
const TRACKING_URL = process.env.ARAMEX_TRACKING_URL || 'https://ws.aramex.net/ShippingAPI.V2/Tracking/Service_1_0.svc/json/TrackShipments';
async function postJson(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body)
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Aramex API ${res.status}: ${text}`);
    }
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
function normalizeFetchCountriesResponse(raw) {
    let out;
    if (typeof raw === 'string' && raw.trim().startsWith('<')) {
        const parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(raw);
        const root = parsed.FetchCountriesResponse ?? parsed.Body ?? parsed;
        out = (root && typeof root === 'object' ? root : parsed);
    }
    else {
        out = (raw && typeof raw === 'object' ? raw : {});
    }
    const c = out.Countries;
    if (c && !c.Country && (Array.isArray(c) || (typeof c === 'object' && Object.keys(c).some((k) => /^\d+$/.test(k))))) {
        const arr = Array.isArray(c) ? c : Object.keys(c)
            .filter((k) => /^\d+$/.test(k))
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => c[k]);
        out.Countries = { Country: arr };
    }
    else if (c && c.Country != null && !Array.isArray(c.Country)) {
        out.Countries.Country = [c.Country];
    }
    return out;
}
async function fetchCountries() {
    const ClientInfo = (0, clientInfo_1.getClientInfo)();
    const raw = await postJson(`${LOCATION_BASE}/FetchCountries`, {
        ClientInfo,
        Transaction: TRANSACTION
    });
    return normalizeFetchCountriesResponse(raw);
}
function normalizeFetchCitiesResponse(raw) {
    let out;
    if (typeof raw === 'string' && raw.trim().startsWith('<')) {
        const parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(raw);
        const root = parsed.FetchCitiesResponse ?? parsed.Body ?? parsed;
        out = (root && typeof root === 'object' ? root : parsed);
    }
    else {
        out = (raw && typeof raw === 'object' ? raw : {});
    }
    const c = out.Cities;
    if (Array.isArray(c)) {
        const arr = c.filter((v) => typeof v === 'string');
        out.Cities = { string: arr };
    }
    else if (c && typeof c === 'object' && !Array.isArray(c)) {
        const obj = c;
        if (obj.string == null && Object.keys(obj).some((k) => /^\d+$/.test(k))) {
            const arr = Object.keys(obj)
                .filter((k) => /^\d+$/.test(k))
                .sort((a, b) => Number(a) - Number(b))
                .map((k) => obj[k])
                .filter((v) => typeof v === 'string');
            out.Cities = { string: arr };
        }
        else if (obj.string != null && !Array.isArray(obj.string)) {
            out.Cities = { string: [obj.string] };
        }
    }
    return out;
}
async function fetchCities(countryCode, _state, nameStartsWith) {
    const ClientInfo = (0, clientInfo_1.getClientInfo)();
    const raw = await postJson(`${LOCATION_BASE}/FetchCities`, {
        ClientInfo,
        CountryCode: countryCode.toUpperCase(),
        NameStartsWith: (nameStartsWith ?? '').trim(),
        State: '',
        Transaction: TRANSACTION
    });
    return normalizeFetchCitiesResponse(raw);
}
function normalizeFetchStatesResponse(raw) {
    let out;
    if (typeof raw === 'string' && raw.trim().startsWith('<')) {
        const parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(raw);
        const root = parsed.FetchStatesResponse ?? parsed.Body ?? parsed;
        out = (root && typeof root === 'object' ? root : parsed);
    }
    else {
        out = (raw && typeof raw === 'object' ? raw : {});
    }
    const s = out.States;
    if (!s)
        return out;
    let arr = [];
    if (Array.isArray(s)) {
        const list = s;
        const first = list[0];
        if (typeof first === 'string') {
            arr = list.filter((v) => typeof v === 'string');
        }
        else if (first && typeof first === 'object' && !Array.isArray(first)) {
            return out;
        }
    }
    else if (typeof s === 'object' && Object.keys(s).some((k) => /^\d+$/.test(k))) {
        arr = Object.keys(s)
            .filter((k) => /^\d+$/.test(k))
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => s[k])
            .filter((v) => typeof v === 'string');
    }
    if (arr.length > 0) {
        out.States = { string: arr };
        return out;
    }
    if (s.string != null) {
        arr = Array.isArray(s.string) ? s.string : [s.string];
    }
    if (arr.length > 0) {
        out.States = { string: arr };
        return out;
    }
    const stateList = s.State;
    if (stateList != null) {
        const items = Array.isArray(stateList) ? stateList : [stateList];
        arr = items
            .map((o) => {
            if (o && typeof o === 'object' && !Array.isArray(o)) {
                const ob = o;
                return (ob.Code ?? ob.code ?? ob.Name ?? ob.name ?? '');
            }
            return typeof o === 'string' ? o : '';
        })
            .filter((v) => v.length > 0);
        if (arr.length > 0)
            out.States = { string: arr };
    }
    return out;
}
async function fetchStates(countryCode) {
    const ClientInfo = (0, clientInfo_1.getClientInfo)();
    const code = countryCode.toUpperCase();
    const raw = await postJson(`${LOCATION_BASE}/FetchStates`, {
        ClientInfo,
        CountryCode: code,
        Transaction: TRANSACTION
    });
    return normalizeFetchStatesResponse(raw);
}
function normalizeRateAddress(addr) {
    return {
        Line1: addr.Line1 ?? '',
        Line2: '',
        Line3: '',
        City: addr.City,
        StateOrProvinceCode: addr.StateOrProvinceCode ?? '',
        PostCode: addr.PostCode ?? '',
        CountryCode: addr.CountryCode
    };
}
async function calculateRate(params) {
    const ClientInfo = (0, clientInfo_1.getClientInfo)();
    const body = {
        ClientInfo,
        OriginAddress: normalizeRateAddress(params.originAddress),
        DestinationAddress: normalizeRateAddress(params.destinationAddress),
        ShipmentDetails: params.shipmentDetails,
        PreferredCurrencyCode: params.preferredCurrencyCode || 'USD',
        Transaction: TRANSACTION
    };
    const shouldLog = process.env.NODE_ENV === 'development' ||
        process.env.ARAMEX_LOG_REQUEST === 'true' ||
        process.env.ARAMEX_LOG_REQUEST === '1';
    if (shouldLog) {
        const safeBody = {
            ...body,
            ClientInfo: {
                UserName: '[redacted]',
                Password: '[redacted]',
                Version: ClientInfo.Version,
                AccountNumber: '[redacted]',
                AccountPin: '[redacted]',
                AccountEntity: ClientInfo.AccountEntity,
                AccountCountryCode: ClientInfo.AccountCountryCode
            }
        };
        process.stdout.write('\n========== Aramex CalculateRate (copy to Postman) ==========\n');
        process.stdout.write('POST ' + RATE_CALCULATOR_URL + '\n');
        process.stdout.write('Content-Type: application/json\n\n');
        process.stdout.write(JSON.stringify(safeBody, null, 2) + '\n');
        process.stdout.write('==========\n\n');
    }
    return postJson(RATE_CALCULATOR_URL, body);
}
async function createShipments(body) {
    const ClientInfo = (0, clientInfo_1.getClientInfo)();
    const fullBody = { ...body, ClientInfo };
    const res = await fetch(`${SHIPPING_BASE}/CreateShipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, application/xml, text/plain' },
        body: JSON.stringify(fullBody)
    });
    const text = await res.text();
    if (!res.ok)
        throw new Error(`Aramex CreateShipments ${res.status}: ${text}`);
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
function extractNotificationMessages(notifications) {
    const messages = [];
    const list = Array.isArray(notifications)
        ? notifications
        : notifications && typeof notifications === 'object' && notifications.Notification != null
            ? Array.isArray(notifications.Notification)
                ? notifications.Notification
                : [notifications.Notification]
            : [];
    for (const n of list) {
        const code = n?.Code ?? n?.code ?? '';
        const msg = n?.Message ?? n?.message ?? '';
        if (code || msg)
            messages.push(msg ? `${code ? code + ': ' : ''}${msg}` : String(n));
    }
    return messages;
}
function parseCreateShipmentsResponse(raw) {
    const rawStr = typeof raw === 'string' ? raw : JSON.stringify(raw);
    let hasErrors = false;
    let trackingId = null;
    let labelUrl = null;
    const errorMessages = [];
    if (typeof raw === 'string' && raw.trim().startsWith('<')) {
        const parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(raw);
        const resp = parsed?.ShipmentCreationResponse ?? parsed?.CreateShipmentsResponse ?? parsed;
        if (resp?.HasErrors === true || resp?.hasErrors === true)
            hasErrors = true;
        errorMessages.push(...extractNotificationMessages(resp?.Notifications ?? resp?.notifications));
        const shipments = resp?.Shipments ?? resp?.shipments;
        const processed = Array.isArray(shipments?.ProcessedShipment)
            ? shipments.ProcessedShipment[0]
            : shipments?.ProcessedShipment;
        if (Array.isArray(shipments?.ProcessedShipment) && shipments.ProcessedShipment.length > 0 && !processed) {
            const first = shipments.ProcessedShipment[0];
            trackingId = first?.ID ?? first?.id ?? null;
            const label = first?.ShipmentLabel ?? first?.shipmentLabel;
            labelUrl = label?.LabelURL ?? label?.labelURL ?? null;
            errorMessages.push(...extractNotificationMessages(first?.Notifications ?? first?.notifications));
        }
        else if (processed) {
            trackingId = processed.ID ?? processed.id ?? null;
            const label = processed.ShipmentLabel ?? processed.shipmentLabel;
            labelUrl = label?.LabelURL ?? label?.labelURL ?? null;
            errorMessages.push(...extractNotificationMessages(processed?.Notifications ?? processed?.notifications));
        }
    }
    else {
        const obj = typeof raw === 'object' ? raw : JSON.parse(rawStr);
        hasErrors = obj.HasErrors === true;
        const notifications = obj.Notifications ?? obj.notifications;
        errorMessages.push(...extractNotificationMessages(notifications));
        const shipments = obj.Shipments;
        const processed = shipments?.ProcessedShipment;
        if (Array.isArray(processed) && processed.length > 0) {
            const first = processed[0];
            trackingId = first?.ID ?? null;
            labelUrl = first?.ShipmentLabel?.LabelURL ?? null;
            const notif = first.Notifications ?? first.notifications;
            errorMessages.push(...extractNotificationMessages(notif));
        }
        else if (processed && typeof processed === 'object' && 'ID' in processed) {
            trackingId = processed.ID ?? null;
            labelUrl = processed.ShipmentLabel?.LabelURL ?? null;
            const notif = processed.Notifications ?? processed.notifications;
            errorMessages.push(...extractNotificationMessages(notif));
        }
    }
    return { trackingId, labelUrl, hasErrors, rawResponse: rawStr, errorMessages };
}
async function trackShipments(shipmentNumbers, getLastTrackingUpdateOnly = false) {
    const ClientInfo = (0, clientInfo_1.getClientInfo)();
    return postJson(TRACKING_URL, {
        ClientInfo,
        GetLastTrackingUpdateOnly: getLastTrackingUpdateOnly,
        Shipments: shipmentNumbers,
        LabelInfo: null
    });
}
async function createPickup(body) {
    const ClientInfo = (0, clientInfo_1.getClientInfo)();
    return postJson(`${SHIPPING_BASE}/CreatePickup`, { ...body, ClientInfo });
}
//# sourceMappingURL=aramexApiClient.js.map