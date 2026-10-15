// All routes. Layouts and guards wrap the pages they apply to.
import { Routes, Route } from 'react-router-dom'
import GuestLayout from './layouts/GuestLayout.jsx'
import AppLayout from './layouts/AppLayout.jsx'
import GuestRoute from './components/guards/GuestRoute.jsx'
import ProtectedRoute from './components/guards/ProtectedRoute.jsx'
import AdminRoute from './components/guards/AdminRoute.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Books from './pages/Books.jsx'
import ComingSoon from './pages/ComingSoon.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      {/* Logged-out pages (logged-in users are sent to /books) */}
      <Route element={<GuestLayout />}>
        <Route element={<GuestRoute />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
      </Route>

      {/* Logged-in pages, inside the sidebar layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/books" element={<Books />} />

          {/* Admin only */}
          <Route element={<AdminRoute />}>
            <Route path="/dashboard" element={<ComingSoon title="Dashboard" />} />
            <Route path="/users" element={<ComingSoon title="Users" />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
