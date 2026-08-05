"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Transaction, TransactionType } from "@/types/finance";

interface TransactionModalState {
  isOpen: boolean;
  type: TransactionType;
  editing: Transaction | null;
}

interface UIContextValue {
  transactionModal: TransactionModalState;
  openNewTransaction: (type: TransactionType) => void;
  openEditTransaction: (transaction: Transaction) => void;
  closeTransactionModal: () => void;
}

const UIContext = createContext<UIContextValue | null>(null);

const initialModalState: TransactionModalState = {
  isOpen: false,
  type: "expense",
  editing: null,
};

export function UIProvider({ children }: { children: ReactNode }) {
  const [transactionModal, setTransactionModal] = useState<TransactionModalState>(initialModalState);

  const openNewTransaction = useCallback((type: TransactionType) => {
    setTransactionModal({ isOpen: true, type, editing: null });
  }, []);

  const openEditTransaction = useCallback((transaction: Transaction) => {
    setTransactionModal({ isOpen: true, type: transaction.type, editing: transaction });
  }, []);

  const closeTransactionModal = useCallback(() => {
    setTransactionModal(initialModalState);
  }, []);

  const value = useMemo(
    () => ({ transactionModal, openNewTransaction, openEditTransaction, closeTransactionModal }),
    [transactionModal, openNewTransaction, openEditTransaction, closeTransactionModal]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI debe usarse dentro de UIProvider");
  return ctx;
}
