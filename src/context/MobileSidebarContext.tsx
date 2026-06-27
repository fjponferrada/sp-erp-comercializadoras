'use client';

import React, { createContext, useContext, useState } from 'react';

interface MobileSidebarContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const MobileSidebarContext = createContext<MobileSidebarContextType>({
  isOpen: false,
  setIsOpen: () => {},
});

export function useMobileSidebar() {
  return useContext(MobileSidebarContext);
}

export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  return (
    <MobileSidebarContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}
