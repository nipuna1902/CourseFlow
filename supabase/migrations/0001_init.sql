--1. PROFILES
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'student'
        CHECK (role IN ('student', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. AUTOMATIC PROFILE CREATION
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name'
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 3. COURSES
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    price_paise INTEGER NOT NULL CHECK (price_paise > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. COURSE LESSONS
CREATE TABLE public.course_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL
        REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    position INTEGER NOT NULL DEFAULT 0
);

-- 5. PAYMENTS (money record; never merged with enrollments)
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    course_id UUID NOT NULL REFERENCES public.courses(id),
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    razorpay_order_id TEXT NOT NULL UNIQUE,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_signature TEXT,
    status TEXT NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'pending', 'paid', 'failed', 'cancelled')),
    needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    failure_reason TEXT
);

-- 6. ENROLLMENTS (access record)
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    course_id UUID NOT NULL REFERENCES public.courses(id),
    payment_id UUID REFERENCES public.payments(id),
    source TEXT NOT NULL DEFAULT 'purchase'
        CHECK (source IN ('purchase', 'admin_grant')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- THE KEY CONSTRAINT: at most one ACTIVE enrollment per student per course
CREATE UNIQUE INDEX one_active_enrollment_per_course
    ON public.enrollments (user_id, course_id)
    WHERE status = 'active';

-- one payment can create at most one enrollment
CREATE UNIQUE INDEX one_enrollment_per_payment
    ON public.enrollments (payment_id)
    WHERE payment_id IS NOT NULL;

-- 7. ENROLLMENT AUDIT (append-only history of grants, revokes and restores)
CREATE TABLE public.enrollment_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID REFERENCES public.enrollments(id),
    student_id UUID NOT NULL REFERENCES public.profiles(id),
    course_id UUID NOT NULL REFERENCES public.courses(id),
    admin_id UUID REFERENCES public.profiles(id),   -- NULL = automatic (payment flow)
    action TEXT NOT NULL CHECK (action IN ('granted', 'revoked', 'restored')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. WEBHOOK EVENTS (one row per Razorpay event id)
CREATE TABLE public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razorpay_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'processed', 'failed')),
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 1,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- 9. ADMIN CHECK (used by the security rules below)
CREATE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- 10. ROW LEVEL SECURITY: deny by default, then allow reads
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events   ENABLE ROW LEVEL SECURITY;  -- no policy: server only

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Anyone can view published courses" ON public.courses
    FOR SELECT USING (is_published OR public.is_admin());

CREATE POLICY "Users can view own payments" ON public.payments
    FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can view own enrollments" ON public.enrollments
    FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- lessons are visible only with an ACTIVE enrollment
CREATE POLICY "Enrolled students can view lessons" ON public.course_lessons
    FOR SELECT USING (
        public.is_admin() OR EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.course_id = course_lessons.course_id
              AND e.user_id = auth.uid()
              AND e.status = 'active'
        )
    );

CREATE POLICY "Admins can view enrollment audit" ON public.enrollment_audit
    FOR SELECT USING (public.is_admin());