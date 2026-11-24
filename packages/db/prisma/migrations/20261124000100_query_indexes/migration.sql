CREATE INDEX "courses_teacher_id_idx" ON "courses" ("teacher_id");
CREATE INDEX "enrollments_course_id_idx" ON "enrollments" ("course_id");
CREATE INDEX "audit_log_changed_by_idx" ON "audit_log" ("changed_by");
