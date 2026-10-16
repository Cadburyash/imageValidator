import React from 'react';
import ReactDOM from 'react-dom/client';
import ImageUpload from './components/ImageUpload';
import './index.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Image Validation Platform</h1>
      </header>
      <main>
        <ImageUpload />
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
