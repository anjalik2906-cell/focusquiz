import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// StrictMode is left off on purpose: its dev-only double effects would fire every AI quiz call twice.
createRoot(document.getElementById('root')).render(<App />);
