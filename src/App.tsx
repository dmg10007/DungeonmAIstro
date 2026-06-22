import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import Setup from './pages/Setup';
import CharacterLab from './pages/CharacterLab';
import Play from './pages/Play';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <a href="#main-content" className="sr-only">
        Skip to content
      </a>
      <NavBar />
      <main id="main-content">
        <Routes>
          <Route path="/"             element={<Home />} />
          <Route path="/setup"        element={<Setup />} />
          <Route path="/character"    element={<CharacterLab />} />
          <Route path="/play"         element={<Play />} />
          <Route path="/settings"     element={<Settings />} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
