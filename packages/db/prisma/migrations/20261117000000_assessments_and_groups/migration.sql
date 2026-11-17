-- Run with Prisma migrate deploy, while the application is stopped.
-- Preserve existing names exactly; do not merge case/whitespace variants silently.
BEGIN;
LOCK TABLE students, grades IN ACCESS EXCLUSIVE MODE;
CREATE TABLE student_groups (
  group_id SERIAL PRIMARY KEY,
  group_name TEXT NOT NULL UNIQUE
);
INSERT INTO student_groups (group_name)
SELECT DISTINCT group_name FROM students ORDER BY group_name;
ALTER TABLE students ADD COLUMN group_id INTEGER;
UPDATE students s SET group_id = g.group_id FROM student_groups g WHERE g.group_name = s.group_name;
ALTER TABLE students ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE students ADD CONSTRAINT students_group_id_fkey FOREIGN KEY (group_id)
  REFERENCES student_groups(group_id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX students_group_id_idx ON students(group_id);

CREATE TABLE assessments (
  assessment_id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL,
  assessment_name TEXT NOT NULL,
  CONSTRAINT assessments_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT assessments_course_id_assessment_name_key UNIQUE (course_id, assessment_name),
  CONSTRAINT assessments_assessment_id_course_id_key UNIQUE (assessment_id, course_id)
);
INSERT INTO assessments (course_id, assessment_name)
SELECT course_id, assessment_name FROM grades GROUP BY course_id, assessment_name ORDER BY course_id, min(grade_id);
ALTER TABLE grades ADD COLUMN assessment_id INTEGER;
UPDATE grades g SET assessment_id = a.assessment_id FROM assessments a
WHERE a.course_id = g.course_id AND a.assessment_name = g.assessment_name;
ALTER TABLE grades ALTER COLUMN assessment_id SET NOT NULL;
-- The composite FK prevents assigning an assessment from a different course.
ALTER TABLE grades ADD CONSTRAINT grades_assessment_id_course_id_fkey
  FOREIGN KEY (assessment_id, course_id) REFERENCES assessments(assessment_id, course_id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX grades_student_id_assessment_id_key ON grades(student_id, assessment_id);
DROP INDEX grades_student_id_course_id_assessment_name_key;
ALTER TABLE grades DROP COLUMN assessment_name;
ALTER TABLE students DROP COLUMN group_name;
-- Audit names are historical snapshots and deliberately remain unchanged.

ALTER TABLE student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_groups_read ON student_groups FOR SELECT TO authenticated USING (
  public.app_role() = 'admin' OR EXISTS (
    SELECT 1 FROM students s WHERE s.group_id = student_groups.group_id
  )
);
CREATE POLICY student_groups_admin_write ON student_groups FOR ALL TO authenticated
  USING (public.app_role() = 'admin') WITH CHECK (public.app_role() = 'admin');
CREATE POLICY assessments_read ON assessments FOR SELECT TO authenticated
  USING (public.app_role() = 'admin' OR public.teaches_course(course_id) OR public.is_enrolled(course_id));
CREATE POLICY assessments_insert ON assessments FOR INSERT TO authenticated
  WITH CHECK (public.app_role() = 'admin' OR public.teaches_course(course_id));
CREATE POLICY assessments_update ON assessments FOR UPDATE TO authenticated
  USING (public.app_role() = 'admin' OR public.teaches_course(course_id))
  WITH CHECK (public.app_role() = 'admin' OR public.teaches_course(course_id));
CREATE POLICY assessments_delete ON assessments FOR DELETE TO authenticated
  USING (public.app_role() = 'admin');
GRANT SELECT, INSERT, UPDATE, DELETE ON student_groups, assessments TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE student_groups_group_id_seq, assessments_assessment_id_seq TO authenticated;
REVOKE ALL ON student_groups, assessments FROM anon;
COMMIT;
