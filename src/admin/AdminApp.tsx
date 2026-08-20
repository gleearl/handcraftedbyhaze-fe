import { useEffect, type ReactNode } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router";
import { CONFIG } from "../config";
import { AuthProvider, useAuth } from "./useAuth";
import { Login } from "./Login";
import { Orders } from "./Orders";
import { OrderDetail } from "./OrderDetail";
import { Products } from "./Products";
import { ProductForm } from "./ProductForm";
import { Settings } from "./Settings";
import { Loading } from "./components/ui";

/* Default-exported because routes.tsx pulls this in with React.lazy — the
   whole admin arrives as one chunk that customers never request. */
export default function AdminApp() {
  return (
    <AuthProvider>
      <AdminRoutes />
    </AuthProvider>
  );
}

function AdminRoutes() {
  useEffect(() => { document.title = `Admin — ${CONFIG.shopName}`; }, []);

  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/admin/orders" replace />} />
      </Route>
    </Routes>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, checking } = useAuth();
  const location = useLocation();

  // Don't redirect before the first /me has answered, or a signed-in reload
  // would flash the login screen on every visit.
  if (checking) return <Loading label="Checking your session…" />;

  if (!user) {
    /* Remember where they were headed so a deep link to an order survives the
       detour through login. */
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function Shell() {
  const { user, signOut } = useAuth();

  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 text-sm font-semibold no-underline ${
      isActive ? "bg-action text-on-action" : "text-fg-brand hover:bg-surface-brand-soft"
    }`;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-rule bg-[rgba(245,250,242,.92)]
                         px-5 py-3 backdrop-blur-[8px]">
        <div className="mx-auto flex max-w-[720px] flex-wrap items-center gap-3">
          <span className="font-display font-semibold">{CONFIG.shopName}</span>

          <nav className="flex gap-1.5">
            <NavLink to="/admin/orders" className={tab}>Orders</NavLink>
            <NavLink to="/admin/products" className={tab}>Products</NavLink>
            <NavLink to="/admin/settings" className={tab}>Settings</NavLink>
          </nav>

          <span className="ml-auto flex items-center gap-3 text-[.8125rem] text-fg-muted">
            <span className="hidden sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="cursor-pointer border-0 bg-transparent text-[.8125rem] text-fg-muted underline"
            >
              Sign out
            </button>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}
