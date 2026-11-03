const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/**
 * Trả về JSON Response tương thích V8 runtime (KHÔNG dùng Response.json)
 * @param {any} data
 * @param {number} status
 * @param {Record<string, string>} extraHeaders
 * @returns {Response}
 */
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...DEFAULT_HEADERS,
      ...extraHeaders
    }
  });
}

/**
 * Phản hồi cho preflight OPTIONS CORS
 * @returns {Response}
 */
export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: DEFAULT_HEADERS
  });
}

/**
 * Phản hồi lỗi chuẩn
 * @param {string} message
 * @param {number} status
 * @param {string} code
 * @param {any} details
 * @returns {Response}
 */
export function errorResponse(message, status = 400, code = 'BAD_REQUEST', details = null) {
  const payload = {
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  };
  return json(payload, status);
}
