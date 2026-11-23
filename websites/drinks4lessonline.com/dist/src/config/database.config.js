"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbConfig = void 0;
exports.dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'povdorie-beirut',
    waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS === 'true' || process.env.DB_WAIT_FOR_CONNECTIONS === undefined,
    connectionLimit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT, 10) : 10,
    queueLimit: process.env.DB_QUEUE_LIMIT ? parseInt(process.env.DB_QUEUE_LIMIT, 10) : 0
};
exports.default = exports.dbConfig;
//# sourceMappingURL=database.config.js.map