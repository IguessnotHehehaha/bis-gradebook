-- =====================================================================
-- Roles and Row Level Security (RLS)
--
-- Who may do what (enforced by PostgreSQL itself, not only by the app):
--   student : read their own grades, courses and enrollments. Cannot change anything.
--   teacher : read their own courses and the students enrolled in them; add and
--             change grades ONLY in their own courses (and only for enrolled students).
--   admin   : read everything, manage users, courses and enrollments, fix grades.
--   anon    : (not signed in) no access at all.
-- =====================================================================

-- 1) Data rule: a score is always between 0 and 100.
ALTER TABLE "grades" ADD CONSTRAINT "grade_score_0_to_100" CHECK ("score" >= 0 AND "score" <= 100);

-- 2) Supabase compatibility. On Supabase these already exist and this block does nothing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('auth.uid()') IS NULL THEN
    CREATE SCHEMA IF NOT EXISTS auth;
    EXECUTE $f$
      CREATE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $body$
        SELECT coalesce(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        )::uuid
      $body$
    $f$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  END IF;
END
$$;

-- 3) Helper functions. SECURITY DEFINER so the policies can look things up
--    without triggering the policies they are part of.
CREATE OR REPLACE FUNCTION public.app_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.app_users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_student_id() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT student_id FROM public.app_users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_teacher_id() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT teacher_id FROM public.app_users WHERE id = auth.uid()
$$;

-- true when the signed-in teacher is the assigned teacher of this course
CREATE OR REPLACE FUNCTION public.teaches_course(cid integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.course_id = cid AND c.teacher_id = public.my_teacher_id()
  )
$$;

-- true when the signed-in student is enrolled in this course
CREATE OR REPLACE FUNCTION public.is_enrolled(cid integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = cid AND e.student_id = public.my_student_id()
  )
$$;

-- true when the signed-in teacher teaches at least one course this student is enrolled in
CREATE OR REPLACE FUNCTION public.teaches_student(sid integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.courses c ON c.course_id = e.course_id
    WHERE e.student_id = sid AND c.teacher_id = public.my_teacher_id()
  )
$$;

REVOKE ALL ON FUNCTION public.app_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_student_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_teacher_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teaches_course(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_enrolled(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teaches_student(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_teacher_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.teaches_course(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enrolled(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teaches_student(integer) TO authenticated;

-- 4) Turn RLS on. With RLS on and no matching policy, access is denied.
ALTER TABLE "app_users"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teachers"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "courses"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grades"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log"   ENABLE ROW LEVEL SECURITY;

-- 5) Policies
-- app_users: everyone sees their own row; admin manages all
CREATE POLICY "app_users_read" ON "app_users" FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.app_role() = 'admin');
CREATE POLICY "app_users_admin_write" ON "app_users" FOR ALL TO authenticated
  USING (public.app_role() = 'admin') WITH CHECK (public.app_role() = 'admin');

-- students: admin; the student themself; a teacher for students enrolled in their courses
CREATE POLICY "students_read" ON "students" FOR SELECT TO authenticated
  USING (public.app_role() = 'admin' OR student_id = public.my_student_id() OR public.teaches_student(student_id));
CREATE POLICY "students_admin_write" ON "students" FOR ALL TO authenticated
  USING (public.app_role() = 'admin') WITH CHECK (public.app_role() = 'admin');

-- teachers: any signed-in user may see teacher names (students need them); admin edits
CREATE POLICY "teachers_read" ON "teachers" FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "teachers_admin_write" ON "teachers" FOR ALL TO authenticated
  USING (public.app_role() = 'admin') WITH CHECK (public.app_role() = 'admin');

-- courses: admin; the course's teacher; enrolled students
CREATE POLICY "courses_read" ON "courses" FOR SELECT TO authenticated
  USING (public.app_role() = 'admin' OR teacher_id = public.my_teacher_id() OR public.is_enrolled(course_id));
CREATE POLICY "courses_admin_write" ON "courses" FOR ALL TO authenticated
  USING (public.app_role() = 'admin') WITH CHECK (public.app_role() = 'admin');

-- enrollments: admin; the student themself; the course's teacher
CREATE POLICY "enrollments_read" ON "enrollments" FOR SELECT TO authenticated
  USING (public.app_role() = 'admin' OR student_id = public.my_student_id() OR public.teaches_course(course_id));
CREATE POLICY "enrollments_admin_write" ON "enrollments" FOR ALL TO authenticated
  USING (public.app_role() = 'admin') WITH CHECK (public.app_role() = 'admin');

-- grades: students read only their own; teachers read and write only in their own courses
CREATE POLICY "grades_read" ON "grades" FOR SELECT TO authenticated
  USING (public.app_role() = 'admin' OR student_id = public.my_student_id() OR public.teaches_course(course_id));
CREATE POLICY "grades_insert" ON "grades" FOR INSERT TO authenticated
  WITH CHECK (public.app_role() = 'admin' OR public.teaches_course(course_id));
CREATE POLICY "grades_update" ON "grades" FOR UPDATE TO authenticated
  USING (public.app_role() = 'admin' OR public.teaches_course(course_id))
  WITH CHECK (public.app_role() = 'admin' OR public.teaches_course(course_id));
CREATE POLICY "grades_delete" ON "grades" FOR DELETE TO authenticated
  USING (public.app_role() = 'admin');

-- audit_log: append-only. Staff may add entries about their own actions; nobody edits or deletes.
CREATE POLICY "audit_read" ON "audit_log" FOR SELECT TO authenticated
  USING (public.app_role() = 'admin' OR public.teaches_course(course_id));
CREATE POLICY "audit_insert" ON "audit_log" FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid() AND (public.app_role() = 'admin' OR public.teaches_course(course_id)));

-- 6) Table privileges (RLS above decides which rows). Nothing for the anonymous role.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
REVOKE UPDATE, DELETE ON "audit_log" FROM authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Prisma's own bookkeeping table must never be reachable from the browser API.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public._prisma_migrations FROM anon, authenticated;
  END IF;
END
$$;
