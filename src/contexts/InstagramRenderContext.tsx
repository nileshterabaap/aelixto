import { createContext, useContext, useState, ReactNode } from 'react';

type InstagramRenderMode = 'official' | 'clean';

interface InstagramRenderContextType {
  renderMode: InstagramRenderMode;
  setRenderMode: (mode: InstagramRenderMode) => void;
}

const InstagramRenderContext = createContext<InstagramRenderContextType | undefined>(undefined);

export const InstagramRenderProvider = ({ children }: { children: ReactNode }) => {
  const [renderMode, setRenderMode] = useState<InstagramRenderMode>('official');

  return (
    <InstagramRenderContext.Provider value={{ renderMode, setRenderMode }}>
      {children}
    </InstagramRenderContext.Provider>
  );
};

export const useInstagramRender = () => {
  const context = useContext(InstagramRenderContext);
  if (!context) {
    throw new Error('useInstagramRender must be used within InstagramRenderProvider');
  }
  return context;
};
