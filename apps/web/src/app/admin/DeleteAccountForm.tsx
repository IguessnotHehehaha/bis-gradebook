"use client";

import { deleteUserAction } from "./actions";

export function DeleteAccountForm({ userId, email }: { userId: string; email: string }) {
  return (
    <form
      action={deleteUserAction}
      onSubmit={(event) => {
        if (!window.confirm(`Delete the login for ${email}? Academic records will remain.`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button className="link" type="submit">Delete account</button>
    </form>
  );
}
