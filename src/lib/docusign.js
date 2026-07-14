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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDocuSignAccessToken = getDocuSignAccessToken;
exports.createAndSendEnvelope = createAndSendEnvelope;
var jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Autentica mediante JWT en DocuSign y devuelve el Access Token.
 */
function getDocuSignAccessToken() {
    return __awaiter(this, void 0, void 0, function () {
        var integrationKey, userId, rsaKeyRaw, oauthBasePath, rsaKey, now, payload, token, response, errorText, data, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
                    userId = process.env.DOCUSIGN_USER_ID;
                    rsaKeyRaw = process.env.DOCUSIGN_PRIVATE_KEY;
                    oauthBasePath = process.env.DOCUSIGN_OAUTH_BASE_PATH || 'account-d.docusign.com';
                    if (!integrationKey || !userId || !rsaKeyRaw) {
                        throw new Error('Faltan credenciales de DocuSign en .env (DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_PRIVATE_KEY)');
                    }
                    rsaKey = rsaKeyRaw.replace(/\\n/g, '\n');
                    now = Math.floor(Date.now() / 1000);
                    payload = {
                        iss: integrationKey,
                        sub: userId,
                        aud: oauthBasePath,
                        iat: now,
                        exp: now + 3600,
                        scope: 'signature impersonation'
                    };
                    token = jsonwebtoken_1.default.sign(payload, rsaKey, { algorithm: 'RS256' });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    return [4 /*yield*/, fetch("https://".concat(oauthBasePath, "/oauth/token"), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            body: new URLSearchParams({
                                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                                assertion: token
                            }).toString()
                        })];
                case 2:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, response.text()];
                case 3:
                    errorText = _a.sent();
                    console.error('Error authenticating with DocuSign JWT:', errorText);
                    throw new Error('Error al autenticar con DocuSign JWT.');
                case 4: return [4 /*yield*/, response.json()];
                case 5:
                    data = _a.sent();
                    return [2 /*return*/, data.access_token];
                case 6:
                    error_1 = _a.sent();
                    console.error('Error in DocuSign JWT fetch:', error_1);
                    throw new Error('Error al autenticar con DocuSign.');
                case 7: return [2 /*return*/];
            }
        });
    });
}
function createAndSendEnvelope(contractId, pdfBuffer, signerName, signerEmail, documentName, emailBlurb, signerPhone) {
    return __awaiter(this, void 0, void 0, function () {
        var accessToken, accountId, cleanPhone, payload, basePath, endpoint, response, errorText, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDocuSignAccessToken()];
                case 1:
                    accessToken = _a.sent();
                    accountId = process.env.DOCUSIGN_ACCOUNT_ID;
                    if (!accountId) {
                        throw new Error('Falta DOCUSIGN_ACCOUNT_ID en .env');
                    }
                    cleanPhone = undefined;
                    if (signerPhone) {
                        cleanPhone = signerPhone.replace(/\D/g, '');
                        if (cleanPhone.startsWith('34') && cleanPhone.length === 11) {
                            cleanPhone = cleanPhone.substring(2);
                        }
                    }
                    payload = {
                        status: 'sent',
                        brandId: '054b84c4-93c5-48be-b130-9c62e9b1e973', // Marca visual de AED Energía idéntica a Make
                        emailSubject: documentName,
                        emailBlurb: emailBlurb || '',
                        documents: [
                            {
                                documentBase64: pdfBuffer.toString('base64'),
                                name: documentName,
                                fileExtension: 'pdf',
                                documentId: '1'
                            }
                        ],
                        recipients: {
                            signers: [
                                {
                                    email: signerEmail,
                                    name: signerName,
                                    recipientId: '1',
                                    routingOrder: '1',
                                    tabs: {
                                        signHereTabs: [
                                            {
                                                documentId: '1',
                                                pageNumber: '1',
                                                xPosition: '200',
                                                yPosition: '600'
                                            }
                                        ]
                                    }
                                }
                            ]
                        },
                        customFields: {
                            textCustomFields: [
                                {
                                    name: 'ContractId',
                                    value: contractId,
                                    required: 'false',
                                    show: 'false'
                                }
                            ]
                        }
                    };
                    // Inyectamos la notificación por SMS si hay teléfono válido
                    if (cleanPhone) {
                        payload.recipients.signers[0].additionalNotifications = [
                            {
                                secondaryDeliveryMethod: 'SMS',
                                phoneNumber: {
                                    countryCode: '34',
                                    number: cleanPhone
                                }
                            }
                        ];
                    }
                    basePath = process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi';
                    endpoint = "".concat(basePath, "/v2.1/accounts/").concat(accountId, "/envelopes");
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 7, , 8]);
                    return [4 /*yield*/, fetch(endpoint, {
                            method: 'POST',
                            headers: {
                                'Authorization': "Bearer ".concat(accessToken),
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(payload)
                        })];
                case 3:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 5];
                    return [4 /*yield*/, response.text()];
                case 4:
                    errorText = _a.sent();
                    console.error('Error creating DocuSign Envelope via native fetch:', errorText);
                    throw new Error("Error DocuSign: ".concat(errorText));
                case 5: return [4 /*yield*/, response.json()];
                case 6:
                    result = _a.sent();
                    return [2 /*return*/, result.envelopeId];
                case 7:
                    error_2 = _a.sent();
                    console.error('Excepción al enviar a DocuSign:', error_2);
                    throw new Error('Error de conexión al enviar el contrato a DocuSign.');
                case 8: return [2 /*return*/];
            }
        });
    });
}
