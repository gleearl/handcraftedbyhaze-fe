import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { App as Shop } from "./shop/App";
import { OrderProvider } from "./shop/store/order";

/* Lazy on purpose, and the reason the admin lives in its own directory: a
   customer opening the shop must never download the admin bundle. Vite splits
   this into a chunk fetched only when someone navigates to /admin.

   It is not a security boundary — anyone can request that chunk. Every read
   and write behind it is gated server-side; see README, "About /admin". */
const AdminApp = lazy(() => import("./admin/AdminApp"));

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <OrderProvider>
            <Shop />
          </OrderProvider>
        }
      />

      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<AdminLoading />}>
            <AdminApp />
          </Suspense>
        }
      />

      {/* Anything else is a mistyped URL, not a 404 page worth designing. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AdminLoading() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-sm text-fg-muted" aria-busy="true">
      Loading…
    </div>
  );
}
