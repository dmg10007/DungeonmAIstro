import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import Setup from './pages/Setup';
import CharacterLab from './pages/CharacterLab';
import Play from './pages/Play';
import Combat from './pages/Combat';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <main style={{ minHeight: '100dvh', paddingTop: 'var(--space-16)' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/characters" element={<CharacterLab />} />
          <Route path="/play" element={<Play />} />
          <Route path="/combat" element={<Combat />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
