const rawBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BACKEND_BASE_URL ||
  "http://localhost:5000";

const apiBaseUrl = rawBaseUrl.replace(/\/$/, "");
const apiRoot = apiBaseUrl.endsWith("/api") ? apiBaseUrl : `${apiBaseUrl}/api`;

const toQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.append(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
};

const parseBody = async (response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: text };
  }
};

const request = async (path, options = {}) => {
  const response = await fetch(`${apiRoot}${path}`, options);
  const result = await parseBody(response);

  if (!response.ok || result?.success === false) {
    const error = new Error(result?.message || "Request failed");
    error.status = response.status;
    error.body = result;
    throw error;
  }

  return result;
};

const authHeader = (token) => ({
  Authorization: `Bearer ${token}`,
});

export const adminLogin = ({ email, password }) =>
  request("/auth/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

export const verifyAdminSession = (token) =>
  request("/auth/admin/verify", {
    headers: authHeader(token),
  });

export const getInventory = (token, params = {}) =>
  request(`/inventory${toQueryString(params)}`, {
    headers: authHeader(token),
  });

export const createInventoryItem = (token, payload) =>
  request("/inventory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(payload),
  });

export { apiRoot };

