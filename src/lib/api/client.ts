// Cliente para la API propia (backend/) — auth, datos personales/ministeriales y pago.
// Reemplaza a Supabase solo en este flujo; Merch sigue usando Supabase aparte.

const API_URL = import.meta.env.PUBLIC_API_URL ?? "http://localhost:4000/api";
const TOKEN_KEY = "sinergia_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export type PublicUser = {
  id: string;
  email: string;
  role: "attendee" | "admin";
  nombres: string;
  apellidos: string;
  tipoDocumento: "dni" | "pasaporte";
  numeroDocumento: string;
  fechaNacimiento: string | null;
  telefono: string;
  iglesia: string | null;
  ministerio: string | null;
};

export type RegistrationStatus = "pending" | "review" | "paid" | "rejected";

export type PublicRegistration = {
  id: string;
  ticketCode: string;
  amount: number;
  status: RegistrationStatus;
  paymentMethod: string | null;
  paymentReference: string | null;
  hasReceipt: boolean;
  materialsPickedUp: boolean;
  materialsPickedUpAt: string | null;
  checkedInAt: string | null;
};

export type AdminRegistrationRow = {
  id: string;
  ticketCode: string;
  fullName: string;
  email: string;
  phone: string;
  status: RegistrationStatus;
  paymentMethod: string | null;
  paymentReference: string | null;
  hasReceipt: boolean;
  materialsPickedUp: boolean;
  checkedInAt: string | null;
};

export type Settings = {
  pricePreventa: number;
  precioVenta: number;
  preventaHasta: string;
  currentPrice: { amount: number; label: "preventa" | "venta" };
  hasYapeQr: boolean;
};

class ApiError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = new Headers(options.headers);
  if (!isFormData) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body?.message ?? "Ocurrió un error inesperado");
  }
  return body as T;
}

export type RegisterPayload = {
  email: string;
  password: string;
  nombres: string;
  apellidos: string;
  tipoDocumento: "dni" | "pasaporte";
  numeroDocumento: string;
  fechaNacimiento: string;
  telefono: string;
  iglesia?: string;
  ministerio?: string;
};

export function registerAccount(payload: RegisterPayload) {
  return request<{ token: string; user: PublicUser; registration: PublicRegistration }>(
    "/auth/register",
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function login(payload: { email: string; password: string }) {
  return request<{ token: string; user: PublicUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchMe() {
  return request<{ user: PublicUser; registration: PublicRegistration | null }>("/auth/me");
}

export function submitPayment(form: FormData) {
  return request<{ registration: PublicRegistration }>("/registration/pay", {
    method: "POST",
    body: form,
  });
}

export function markMaterialsPickedUp() {
  return request<{ registration: PublicRegistration }>("/registration/materials", {
    method: "POST",
  });
}

export function fetchAdminRegistrations() {
  return request<{ registrations: AdminRegistrationRow[] }>("/admin/registrations");
}

export function setRegistrationStatus(id: string, status: RegistrationStatus) {
  return request<{ registration: AdminRegistrationRow }>(`/admin/registrations/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function toggleRegistrationMaterials(id: string) {
  return request<{ registration: AdminRegistrationRow }>(`/admin/registrations/${id}/materials`, {
    method: "PATCH",
  });
}

export function checkinTicket(ticketCode: string) {
  return request<{ registration: AdminRegistrationRow }>("/admin/checkin", {
    method: "POST",
    body: JSON.stringify({ ticketCode }),
  });
}

export function fetchSettings() {
  return request<{ settings: Settings }>("/settings");
}

export function yapeQrUrl() {
  return `${API_URL}/settings/qr`;
}

export function updateSettings(payload: { pricePreventa: number; precioVenta: number; preventaHasta: string }) {
  return request<{ settings: Settings }>("/admin/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function uploadYapeQr(file: File) {
  const form = new FormData();
  form.set("qr", file);
  return request<{ settings: Settings }>("/admin/settings/qr", { method: "POST", body: form });
}

export async function openReceipt(id: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}/admin/registrations/${id}/receipt`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new ApiError("No pudimos abrir el comprobante");
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), "_blank", "noopener");
}
