"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";

type Student = { studentId: number; fullName: string; email: string; groupName: string };

export function StudentDirectory({ students }: { students: Student[] }) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const groups = useMemo(() => [...new Set(students.map((student) => student.groupName))].sort((a, b) => a.localeCompare(b)), [students]);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return students.filter((student) => {
      const matchesQuery = !needle || `${student.fullName} ${student.email} ${student.studentId}`.toLocaleLowerCase().includes(needle);
      return matchesQuery && (!group || student.groupName === group);
    });
  }, [students, query, group]);

  return (
    <div className="stack">
      <div className="toolbar card">
        <label className="grow">
          {t("admin.students.search")}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("admin.students.searchPlaceholder")}
          />
        </label>
        <label>
          {t("admin.students.group")}
          <select value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="">{t("admin.students.allGroups")}</option>
            {groups.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <span className="muted small" aria-live="polite">
          {t("admin.students.showing", { shown: visible.length, total: students.length })}
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t("admin.students.id")}</th><th>{t("admin.students.name")}</th><th>{t("admin.students.email")}</th><th>{t("admin.students.group")}</th></tr></thead>
          <tbody>
            {visible.map((student) => (
              <tr key={student.studentId}>
                <td>{student.studentId}</td><td>{student.fullName}</td><td className="muted">{student.email}</td><td>{student.groupName}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={4} className="muted">{students.length ? t("admin.students.noMatch") : t("admin.students.empty")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
