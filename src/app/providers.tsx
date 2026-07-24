"use client";

import { PropsWithChildren, useRef } from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { Persistor, persistStore } from "redux-persist";

import { store } from "@/store";
import { DialogHost } from "@/components/ui/DialogHost";

// persistStore(store) starts redux-persist's storage read/rehydrate cycle.
// It must not run at module scope (src/store/index.ts stays SSR-safe on its
// own — see src/store/persistStorage.ts), and it must not run more than once
// per store. Lazy-initializing the ref keeps it to exactly one call, on the
// client, on first render of this component.
export function Providers({ children }: PropsWithChildren) {
  const persistorRef = useRef<Persistor | null>(null);
  if (!persistorRef.current) {
    persistorRef.current = persistStore(store);
  }

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistorRef.current}>
        {children}
        <DialogHost />
      </PersistGate>
    </Provider>
  );
}
