import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Reports from "./pages/Reports";
import Layout from "./components/Layout";
import { clearAuthSession, getAuthSession } from "./utils/authStorage";
import { verifyAdminSession } from "./services/api";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      const session = getAuthSession();

      if (!session?.token) {
        setIsAuthenticated(false);
        setIsCheckingAuth(false);
        return;
      }

      try {
        await verifyAdminSession(session.token);
        setIsAuthenticated(true);
      } catch {
        clearAuthSession();
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    verifySession();
  }, []);

  if (isCheckingAuth) return null;

  return (
    <Routes>
      {/* LOGIN PAGE */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login setIsAuthenticated={setIsAuthenticated} />}
      />
      
      {/* PROTECTED PAGES (Kailangan naka-login para makapasok) */}
      <Route path="/dashboard" element={isAuthenticated ? <Layout setIsAuthenticated={setIsAuthenticated}><Dashboard setIsAuthenticated={setIsAuthenticated} /></Layout> : <Navigate to="/login" replace />} />
      <Route path="/inventory" element={isAuthenticated ? <Layout setIsAuthenticated={setIsAuthenticated}><Inventory setIsAuthenticated={setIsAuthenticated} /></Layout> : <Navigate to="/login" replace />} />
      <Route path="/reports" element={isAuthenticated ? <Layout setIsAuthenticated={setIsAuthenticated}><Reports setIsAuthenticated={setIsAuthenticated} /></Layout> : <Navigate to="/login" replace />} />
      
      {/* DEFAULT ROUTE */}
      <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}
