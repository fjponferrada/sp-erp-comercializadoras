"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFileToR2 = uploadFileToR2;
exports.generatePresignedUrl = generatePresignedUrl;
exports.getFileStreamFromR2 = getFileStreamFromR2;
var client_s3_1 = require("@aws-sdk/client-s3");
var s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
var _r2Client = null;
function getR2Client() {
    if (!_r2Client) {
        var accountId = process.env.R2_ACCOUNT_ID || '';
        var accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
        var secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
        _r2Client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint: "https://".concat(accountId, ".r2.cloudflarestorage.com"),
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey,
            },
        });
    }
    return _r2Client;
}
/**
 * Uploads a file buffer to Cloudflare R2 and returns the public URL.
 * @param path The key (path) inside the bucket where the file will be stored.
 * @param fileBuffer The binary content of the file.
 * @param contentType The MIME type of the file.
 * @returns The public URL to access the file.
 */
function uploadFileToR2(path, fileBuffer, contentType) {
    return __awaiter(this, void 0, void 0, function () {
        var bucketName, publicUrl, command, client, baseUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    bucketName = process.env.R2_BUCKET_NAME || '';
                    publicUrl = process.env.R2_PUBLIC_URL || '';
                    if (!bucketName) {
                        throw new Error('R2_BUCKET_NAME is not configured.');
                    }
                    command = new client_s3_1.PutObjectCommand({
                        Bucket: bucketName,
                        Key: path,
                        Body: fileBuffer,
                        ContentType: contentType,
                    });
                    client = getR2Client();
                    return [4 /*yield*/, client.send(command)];
                case 1:
                    _a.sent();
                    baseUrl = publicUrl.replace(/\/$/, '');
                    return [2 /*return*/, "".concat(baseUrl, "/").concat(path)];
            }
        });
    });
}
function generatePresignedUrl(path, contentType) {
    return __awaiter(this, void 0, void 0, function () {
        var bucketName, publicUrlBase, command, client, uploadUrl, baseUrl, publicUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    bucketName = process.env.R2_BUCKET_NAME || '';
                    publicUrlBase = process.env.R2_PUBLIC_URL || '';
                    if (!bucketName)
                        throw new Error('R2_BUCKET_NAME is not configured.');
                    command = new client_s3_1.PutObjectCommand({
                        Bucket: bucketName,
                        Key: path,
                        ContentType: contentType,
                    });
                    client = getR2Client();
                    return [4 /*yield*/, (0, s3_request_presigner_1.getSignedUrl)(client, command, { expiresIn: 3600 })];
                case 1:
                    uploadUrl = _a.sent();
                    baseUrl = publicUrlBase.replace(/\/$/, '');
                    publicUrl = "".concat(baseUrl, "/").concat(path);
                    return [2 /*return*/, { uploadUrl: uploadUrl, publicUrl: publicUrl }];
            }
        });
    });
}
function getFileStreamFromR2(path) {
    return __awaiter(this, void 0, void 0, function () {
        var bucketName, command, client, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    bucketName = process.env.R2_BUCKET_NAME || '';
                    if (!bucketName)
                        throw new Error('R2_BUCKET_NAME is not configured.');
                    command = new client_s3_1.GetObjectCommand({
                        Bucket: bucketName,
                        Key: path,
                    });
                    client = getR2Client();
                    return [4 /*yield*/, client.send(command)];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, {
                            stream: response.Body,
                            contentType: response.ContentType || 'application/octet-stream',
                        }];
            }
        });
    });
}
