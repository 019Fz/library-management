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
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import AdminBooks from './pages/AdminBooks.jsx'
import Insights from './pages/Insights.jsx'
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
          {/* Every role: users see their own insights, admins get a Platform / A user switch */}
          <Route path="/insights" element={<Insights />} />

          {/* Admin only */}
          <Route element={<AdminRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/admin/books" element={<AdminBooks />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
