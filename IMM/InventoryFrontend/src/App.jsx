import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {
 
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <Routes>
      {/*  page */}
      <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
      <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/" element={<Navigate to="/login" />} />
    </Routes>
  );
}