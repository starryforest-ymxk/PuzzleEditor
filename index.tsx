
import React from 'react';
import { createRoot } from 'react-dom/client';
import { StoreProvider } from './store/context';
import { MainLayout } from './components/Layout/MainLayout';
import './styles.css';

const App = () => {
  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
};

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);

