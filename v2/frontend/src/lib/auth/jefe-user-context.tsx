"use client";

import { createContext, useContext } from "react";
import type { CurrentUser } from "./use-current-user";

const defaultValue: CurrentUser = {
  user: null,
  isAdmin: false,
  isJefe: false,
  authorizedBranchIds: [],
  loading: true,
  error: null,
};

export const JefeUserContext = createContext<CurrentUser>(defaultValue);

export function useJefeUser(): CurrentUser {
  return useContext(JefeUserContext);
}
