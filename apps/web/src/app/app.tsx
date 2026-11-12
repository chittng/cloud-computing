import { useState } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/features/auth/auth-context";
import { LoginPage } from "@/features/auth/login-page";
import { RegisterPage } from "@/features/auth/register-page";
import { GuestOnly, RequireAuth } from "@/features/auth/route-guards";
import { TasksPage } from "@/features/tasks/tasks-page";
import { QueryProvider } from "./query-provider";

function createRouter() {
  return createBrowserRouter([
    {
      element: <GuestOnly />,
      children: [
        { path: "/login", element: <LoginPage /> },
        { path: "/register", element: <RegisterPage /> },
      ],
    },
    {
      element: <RequireAuth />,
      children: [{ path: "/", element: <TasksPage /> }],
    },
    { path: "*", element: <Navigate to="/" replace /> },
  ]);
}

export function App() {
  const [router] = useState(createRouter);

  return (
    <AuthProvider>
      <QueryProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" />
      </QueryProvider>
    </AuthProvider>
  );
}
