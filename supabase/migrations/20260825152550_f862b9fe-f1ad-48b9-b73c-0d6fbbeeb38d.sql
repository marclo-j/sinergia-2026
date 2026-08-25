-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'attendee');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- UPDATED AT
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  church text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'attendee') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- REGISTRATIONS
CREATE TYPE public.payment_status AS ENUM ('pending','review','paid','rejected');

CREATE TABLE public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  ticket_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  church text,
  amount numeric(10,2) NOT NULL DEFAULT 10,
  payment_method text,
  payment_reference text,
  receipt_url text,
  status public.payment_status NOT NULL DEFAULT 'pending',
  materials_picked_up boolean NOT NULL DEFAULT false,
  materials_picked_up_at timestamptz,
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own registration select" ON public.registrations FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own registration insert" ON public.registrations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own registration update" ON public.registrations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin registration update" ON public.registrations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER registrations_updated_at BEFORE UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SCHEDULE
CREATE TABLE public.schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number int NOT NULL,
  day_label text NOT NULL,
  start_time text NOT NULL,
  end_time text,
  title text NOT NULL,
  description text,
  speaker text,
  location text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.schedule_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_items TO authenticated;
GRANT ALL ON public.schedule_items TO service_role;
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule public read" ON public.schedule_items FOR SELECT USING (true);
CREATE POLICY "schedule admin write" ON public.schedule_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- MERCH
CREATE TABLE public.merch_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  image_url text,
  sizes text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.merch_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merch_products TO authenticated;
GRANT ALL ON public.merch_products TO service_role;
ALTER TABLE public.merch_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merch public read" ON public.merch_products FOR SELECT USING (true);
CREATE POLICY "merch admin write" ON public.merch_products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.merch_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total numeric(10,2) NOT NULL DEFAULT 0,
  status public.payment_status NOT NULL DEFAULT 'pending',
  payment_method text,
  payment_reference text,
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.merch_orders TO authenticated;
GRANT ALL ON public.merch_orders TO service_role;
ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own order select" ON public.merch_orders FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own order insert" ON public.merch_orders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own order update" ON public.merch_orders FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER merch_orders_updated_at BEFORE UPDATE ON public.merch_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.merch_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.merch_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.merch_products(id),
  product_name text NOT NULL,
  size text,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.merch_order_items TO authenticated;
GRANT ALL ON public.merch_order_items TO service_role;
ALTER TABLE public.merch_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own order items select" ON public.merch_order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.merch_orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "own order items insert" ON public.merch_order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.merch_orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- SEED SCHEDULE
INSERT INTO public.schedule_items (day_number, day_label, start_time, end_time, title, description, speaker, location, sort_order) VALUES
(1,'30 de Octubre','16:00','17:00','Acreditación y entrega de materiales','Recoge tu kit del asistente presentando tu QR.',NULL,'Hall principal',1),
(1,'30 de Octubre','17:00','17:30','Apertura: A través del tiempo','Bienvenida y presentación del Vol. II.','Equipo Sinergia','Auditorio',2),
(1,'30 de Octubre','17:30','19:00','Sesión 1 — Las raíces de nuestra adoración','Una mirada al pasado que formó lo que hoy cantamos.','Ps. Invitado','Auditorio',3),
(1,'30 de Octubre','19:00','20:30','Noche de adoración','Primer encuentro de adoración congregacional.','Banda Sinergia','Auditorio',4),
(2,'31 de Octubre','09:00','10:00','Devocional matutino','Comenzamos el día en la presencia de Dios.',NULL,'Auditorio',1),
(2,'31 de Octubre','10:00','12:00','Talleres simultáneos','Voces, banda, producción, sonido y creatividad.','Equipos de ministerio','Salas A-D',2),
(2,'31 de Octubre','12:00','14:00','Almuerzo y conexión','Espacio para conocer a otros ministerios.',NULL,'Patio',3),
(2,'31 de Octubre','14:00','16:00','Sesión 2 — Una generación que adora','Pasado, presente y futuro unidos para glorificar a Jesús.','Ps. Invitado','Auditorio',4),
(2,'31 de Octubre','19:00','21:30','Gran noche de adoración','La noche central de la conferencia.','Banda Sinergia','Auditorio',5),
(3,'01 de Noviembre','09:00','10:00','Devocional de cierre','Miramos hacia adelante.',NULL,'Auditorio',1),
(3,'01 de Noviembre','10:00','12:00','Sesión 3 — Adoramos con propósito','Llevar su nombre más allá de nuestras paredes.','Ps. Invitado','Auditorio',2),
(3,'01 de Noviembre','12:00','13:00','Envío y comisión','Oración final y envío de los equipos.','Equipo Pastoral','Auditorio',3);

-- SEED MERCH
INSERT INTO public.merch_products (name, description, price, sizes, sort_order) VALUES
('Polo Sinergia Vol. II','Polo algodón premium con el arte oficial de la conferencia.',45,'{"S","M","L","XL"}',1),
('Hoodie A través del tiempo','Buzo con capucha, bordado frontal y arte en la espalda.',95,'{"S","M","L","XL"}',2),
('Tote bag Sinergia','Bolsa de lona serigrafiada, ideal para tus materiales.',25,'{}',3),
('Pack stickers + cuaderno','Cuaderno de notas del asistente y set de 6 stickers.',20,'{}',4);