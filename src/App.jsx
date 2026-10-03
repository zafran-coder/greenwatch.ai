import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { Compass } from "lucide-react";
import { ToastProvider } from "./components/Toast";
import Navbar from "./components/Navbar";
import EmptyState from "./components/EmptyState";
import { Card, Btn } from "./components/ui";
import Landing from "./pages/Landing";
import ReportIssue from "./pages/ReportIssue";
import TrackReport from "./pages/TrackReport";
import Dashboard from "./pages/Dashboard";
import ReportDetail from "./pages/ReportDetail";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Card>
        <EmptyState
          icon={Compass}
          title="Page not found"
          message="That link doesn't lead anywhere. Let's get you back on track."
          action={
            <Link to="/">
              <Btn variant="secondary" size="sm">
                Back to home
              </Btn>
            </Link>
          }
        />
      </Card>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-14 border-t border-slate-200/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:px-6">
        <p>GreenWatch AI — demo frontend. All data stays in your browser.</p>
        <p className="font-medium text-slate-500">AI suggested · human approved</p>
      </div>
    </footer>
  );
}

function Shell() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />
      <main key={pathname} className="flex-1 animate-page-in">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/report" element={<ReportIssue />} />
          <Route path="/track" element={<TrackReport />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/reports/:id" element={<ReportDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </BrowserRouter>
  );
}
