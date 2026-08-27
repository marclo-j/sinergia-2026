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
  materialsPickedUpAt: string | null;
  materialsDeliveredBy: string | null;
  checkedInAt: string | null;
  createdAt: string;
  paymentSubmittedAt: string | null;
  approvedAt: string | null;
  physicalPaymentApprovedAt: string | null;
  role: "attendee" | "admin";
  tipoDocumento: "dni" | "pasaporte";
  numeroDocumento: string;
  fechaNacimiento: string | null;
  iglesia: string | null;
  ministerio: string | null;
};

export type Settings = {
  pricePreventa: number;
  precioVenta: number;
  preventaHasta: string;
  whatsapp: string;
  currentPrice: { amount: number; label: "preventa" | "venta" };
};

export type CatalogType = "iglesias" | "ministerios";

export type CatalogItem = {
  id: string;
  name: string;
};

export type PaymentMethodItem = {
  id: string;
  name: string;
  instructions: string;
  hasQr: boolean;
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

export function setRegistrationStatus(
  id: string,
  status: RegistrationStatus,
  payment?: { paymentMethod?: string; paymentReference?: string },
) {
  return request<{ registration: AdminRegistrationRow }>(`/admin/registrations/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, ...payment }),
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

export function updateSettings(payload: {
  pricePreventa: number;
  precioVenta: number;
  preventaHasta: string;
  whatsapp?: string;
}) {
  return request<{ settings: Settings }>("/admin/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function fetchCatalog(type: CatalogType) {
  return request<{ items: CatalogItem[] }>(`/catalog/${type}`);
}

export function createCatalogItem(type: CatalogType, name: string) {
  return request<{ item: CatalogItem }>(`/admin/catalog/${type}`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function deleteCatalogItem(type: CatalogType, id: string) {
  return request<{ ok: true }>(`/admin/catalog/${type}/${id}`, { method: "DELETE" });
}

export function fetchPaymentMethods() {
  return request<{ methods: PaymentMethodItem[] }>("/payment-methods");
}

export type PaymentMethodInput = {
  name: string;
  instructions?: string;
  qrFile?: File | null;
};

function paymentMethodFormData({ name, instructions, qrFile }: PaymentMethodInput) {
  const form = new FormData();
  form.set("name", name);
  if (instructions) form.set("instructions", instructions);
  if (qrFile) form.set("qr", qrFile);
  return form;
}

export function createPaymentMethod(input: PaymentMethodInput) {
  return request<{ method: PaymentMethodItem }>("/admin/payment-methods", {
    method: "POST",
    body: paymentMethodFormData(input),
  });
}

export function updatePaymentMethod(id: string, input: PaymentMethodInput) {
  return request<{ method: PaymentMethodItem }>(`/admin/payment-methods/${id}`, {
    method: "PATCH",
    body: paymentMethodFormData(input),
  });
}

export function deletePaymentMethod(id: string) {
  return request<{ ok: true }>(`/admin/payment-methods/${id}`, { method: "DELETE" });
}

export function paymentMethodQrUrl(id: string) {
  return `${API_URL}/payment-methods/${id}/qr`;
}

export function registerPhysicalPayment(id: string, reference?: string) {
  return request<{ registration: AdminRegistrationRow }>(`/admin/registrations/${id}/physical-payment`, {
    method: "POST",
    body: JSON.stringify({ reference }),
  });
}

export async function fetchReceipt(id: string): Promise<{ url: string; type: string }> {
  const token = getToken();
  const res = await fetch(`${API_URL}/admin/registrations/${id}/receipt`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new ApiError("No pudimos abrir el comprobante");
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}
