"use client";
/**
 * SessionTimeout — auto-logs out after 30 minutes of inactivity.
 * Shows a 2-minute warning modal before logging out so the user can stay.
 * Resets timer on any mouse move, click, key press, or scroll.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Clock, AlertTriangle } from "lucide-react";

const INACTIVE_MS     = 30 * 60 * 1000;  // 30 minutes
const WARNING_MS      = 28 * 60 * 1000;  // show warning at 28 min
const COUNTDOWN_START = 120;             // 2 min countdown in seconds

export default function SessionTimeout() {
  const router    = useRouter();
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown]     = useState(COUNTDOWN_START);
  const countRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const logout = useCallback(async () => {
    setShowWarning(false);
    await createClient().auth.signOut();
    router.push("/login?reason=timeout");
  }, [router]);

  const resetTimer = useCallback(() => {
    if (showWarning) return; // don't reset if warning is showing
    if (timerRef.current)  clearTimeout(timerRef.current);
    if (warnRef.current)   clearTimeout(warnRef.current);

    warnRef.current  = setTimeout(() => {
      setShowWarning(true);
      setCountdown(COUNTDOWN_START);
      countRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countRef.current!);
            logout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, WARNING_MS);

    timerRef.current = setTimeout(logout, INACTIVE_MS);
  }, [showWarning, logout]);

  const stayLoggedIn = () => {
    setShowWarning(false);
    if (countRef.current) clearInterval(countRef.current);
    resetTimer();
  };

  useEffect(() => {
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // start timer on mount

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnRef.current)  clearTimeout(warnRef.current);
      if (countRef.current) clearInterval(countRef.current);
    };
  }, [resetTimer]);

  if (!showWarning) return null;

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <Clock size={28} className="text-amber-600" />
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-2">Still there?</h2>
        <p className="text-gray-500 text-sm mb-4">
          For security, you'll be logged out due to inactivity.
        </p>

        <div className="text-3xl font-black font-mono mb-6"
          style={{ color: countdown < 30 ? "#ef4444" : "#f97316" }}>
          {String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}
        </div>

        <div className="flex gap-3">
          <button onClick={logout}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">
            Log out now
          </button>
          <button onClick={stayLoggedIn}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all"
            style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}>
            Stay logged in
          </button>
        </div>
      </div>
    </div>
  );
}
