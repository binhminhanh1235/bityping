import { render } from 'preact';
import { App } from './App.jsx';
import './styles/index.css';

const rootEl = document.getElementById('app');
if (rootEl) {
  render(<App />, rootEl);
}
