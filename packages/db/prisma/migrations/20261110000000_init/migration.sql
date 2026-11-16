-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('student', 'teacher', 'admin');

-- CreateTable
CREATE TABLE "app_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "student_id" INTEGER,
    "teacher_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "student_id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "teacher_id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("teacher_id")
);

-- CreateTable
CREATE TABLE "courses" (
    "course_id" SERIAL NOT NULL,
    "course_name" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "teacher_id" INTEGER NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("course_id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "student_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("student_id","course_id")
);

-- CreateTable
CREATE TABLE "grades" (
    "grade_id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "assessment_name" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "grade_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("grade_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "audit_id" SERIAL NOT NULL,
    "grade_id" INTEGER,
    "course_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "assessment_name" TEXT NOT NULL,
    "old_score" DECIMAL(5,2),
    "new_score" DECIMAL(5,2),
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("audit_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_users_email_key" ON "app_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_student_id_key" ON "app_users"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_teacher_id_key" ON "app_users"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_email_key" ON "students"("email");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_email_key" ON "teachers"("email");

-- CreateIndex
CREATE INDEX "grades_course_id_idx" ON "grades"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "grades_student_id_course_id_assessment_name_key" ON "grades"("student_id", "course_id", "assessment_name");

-- CreateIndex
CREATE INDEX "audit_log_course_id_idx" ON "audit_log"("course_id");

-- AddForeignKey
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("teacher_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("teacher_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_course_id_fkey" FOREIGN KEY ("student_id", "course_id") REFERENCES "enrollments"("student_id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
