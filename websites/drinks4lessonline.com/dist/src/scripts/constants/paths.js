"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCRIPTS_PATHS = void 0;
exports.getScriptsDataFilePath = getScriptsDataFilePath;
const constants_1 = require("../../../src/constants");
exports.SCRIPTS_PATHS = {
    DATA_DIR: constants_1.DATA_PATHS.DATA_DIR,
    PROJECTS_FILE: constants_1.DATA_PATHS.PROJECTS_FILE
};
function getScriptsDataFilePath(filename) {
    return (0, constants_1.getDataFilePath)(filename);
}
//# sourceMappingURL=paths.js.map