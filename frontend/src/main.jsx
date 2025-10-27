import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Admin from './pages/Admin.jsx'
import Customer from './pages/Customer.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<App />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/customer/:id" element={<Customer />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
