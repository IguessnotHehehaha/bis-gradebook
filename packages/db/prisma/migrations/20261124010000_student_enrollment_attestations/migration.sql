BEGIN;
-- Course catalogue: students may see course metadata before enrolling.
-- Other students' enrollments and grades remain protected by their own RLS.
CREATE POLICY courses_student_catalogue ON courses FOR SELECT TO authenticated
  USING (public.app_role() = 'student');
CREATE POLICY enrollments_student_insert ON enrollments FOR INSERT TO authenticated
  WITH CHECK (public.app_role() = 'student' AND student_id = public.my_student_id());

CREATE TABLE attestation_results (
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  attestation_number INTEGER NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  changed_by UUID NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attestation_results_pkey PRIMARY KEY (student_id, course_id, attestation_number),
  CONSTRAINT attestation_number_1_or_2 CHECK (attestation_number IN (1,2)),
  CONSTRAINT attestation_score_0_to_100 CHECK (score >= 0 AND score <= 100),
  CONSTRAINT attestation_results_student_id_course_id_fkey FOREIGN KEY (student_id,course_id)
    REFERENCES enrollments(student_id,course_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT attestation_results_changed_by_fkey FOREIGN KEY (changed_by)
    REFERENCES app_users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX attestation_results_course_id_idx ON attestation_results(course_id);
ALTER TABLE attestation_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY attestations_read ON attestation_results FOR SELECT TO authenticated
  USING (public.app_role() = 'admin' OR student_id = public.my_student_id() OR public.teaches_course(course_id));
CREATE POLICY attestations_insert ON attestation_results FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid() AND (public.app_role() = 'admin' OR public.teaches_course(course_id)));
CREATE POLICY attestations_update ON attestation_results FOR UPDATE TO authenticated
  USING (public.app_role() = 'admin' OR public.teaches_course(course_id))
  WITH CHECK (changed_by = auth.uid() AND (public.app_role() = 'admin' OR public.teaches_course(course_id)));
CREATE POLICY attestations_delete ON attestation_results FOR DELETE TO authenticated
  USING (public.app_role() = 'admin');
GRANT SELECT, INSERT, UPDATE, DELETE ON attestation_results TO authenticated;
REVOKE ALL ON attestation_results FROM anon;
COMMIT;
