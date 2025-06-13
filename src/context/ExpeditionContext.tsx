import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ExpeditionContextType {
  expedition: string;
  setExpedition: (exp: string) => void;
}

const ExpeditionContext = createContext<ExpeditionContextType | undefined>(undefined);

export const ExpeditionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [expedition, setExpedition] = useState<string>("");

  return (
    <ExpeditionContext.Provider value={{ expedition, setExpedition }}>
      {children}
    </ExpeditionContext.Provider>
  );
};

export const useExpedition = () => {
  const context = useContext(ExpeditionContext);
  if (context === undefined) {
    throw new Error('useExpedition must be used within an ExpeditionProvider');
  }
  return context;
};