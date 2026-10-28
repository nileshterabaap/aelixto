import { useEffect, useState } from "react";
import type { SavedAccount } from "@/lib/accountStore";
import { ACCOUNTS_CHANGED_EVENT, readAccounts } from "@/lib/accountSwitcher";

/** Accounts saved on this device, kept live as they change. */
export function useSavedAccounts(): SavedAccount[] {
  const [accounts, setAccounts] = useState<SavedAccount[]>(() => readAccounts());
  useEffect(() => {
    const update = () => setAccounts(readAccounts());
    window.addEventListener(ACCOUNTS_CHANGED_EVENT, update);
    window.addEventListener("storage", update);
    update();
    return () => {
      window.removeEventListener(ACCOUNTS_CHANGED_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return accounts;
}
