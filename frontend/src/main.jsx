import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

// გვერდები
import App from './App.jsx'              // Login
import Admin from './pages/Admin.jsx'    // Admin მთავარი
import Customer from './pages/Customer.jsx'  // კლიენტის გვერდი
import AppUsers from './pages/AppUsers.jsx'  // პარამეტრები → Users (ახალი)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Login */}
        <Route path="/" element={<App />} />
        <Route path="/login" element={<App />} />

        {/* Admin */}
        <Route path="/admin" element={<Admin />} />

        {/* კლიენტის გვერდი */}
        <Route path="/customer/:id" element={<Customer />} />

        {/* პარამეტრები → Users */}
        <Route path="/settings/users" element={<AppUsers />} />

        {/* სხვა ნებისმიერი მისამართი -> Login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)

