
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { StoreProvider, useEditorDispatch, loadProjectData } from './store/context';
import { MainLayout } from './components/Layout/MainLayout';
import './styles.css';

const AppContent = () => {
  const dispatch = useEditorDispatch();

  // Bootstrap application data
  useEffect(() => {
    loadProjectData(dispatch);
  }, [dispatch]);

  return <MainLayout />;
};

const App = () => {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
};

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
