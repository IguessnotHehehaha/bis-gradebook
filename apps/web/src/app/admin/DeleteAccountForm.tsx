"use client";

import { useT } from "@/lib/i18n/client";
import { deleteUserAction } from "./actions";

export function DeleteAccountForm({ userId, email }: { userId: string; email: string }) {
  const { t } = useT();
  return (
    <form
      action={deleteUserAction}
      onSubmit={(event) => {
        if (!window.confirm(t("admin.delete.confirm", { email }))) event.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button className="link" type="submit">{t("admin.delete.button")}</button>
    </form>
  );
}
