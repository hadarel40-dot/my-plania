import { createContext, useContext } from 'react';

// Lets any row in the admin open the client card without passing it down through every list.
const AdminActionsContext = createContext({ openClient: () => {} });

export const AdminActionsProvider = AdminActionsContext.Provider;

export function useAdminActions() {
  return useContext(AdminActionsContext);
}
