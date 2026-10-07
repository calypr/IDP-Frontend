export const decodeJwt = jest.fn();
export const decodeProtectedHeader = jest.fn();
export const importSPKI = jest.fn();
export const jwtVerify = jest.fn();
export const errors = { JWTExpired: class JWTExpired extends Error {} };
