import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LiveAlerts from './pages/LiveAlerts';
import News from './pages/News';
import Simulator from './pages/Simulator';
import Admin from './pages/Admin';
import { useAuth } from './context/AuthContext';

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<LiveAlerts />} />
          <Route path="/news" element={<News />} />
          <Route path="/simulator" element={<Simulator />} />
          
          {/* Admin Route Protection */}
          <Route 
            path="/admin" 
            element={
              user?.role === 'admin' ? <Admin /> : <Navigate to="/" replace />
            } 
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
