import { useEffect, useState } from "react";
import "./App.css";
import ReceiptInvoice from "./ReceiptInvoice.jsx";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const TOKEN_STORAGE_KEY = "receiptAuthToken";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed.");
  }

  return data;
}

function AuthForm({ mode, onSwitchMode, onAuthSuccess }) {
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = isSignup ? "/signup" : "/login";
      const result = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

    if (isSignup) {
      onSwitchMode();
      setPassword("");
      setConfirmPassword("");
      setError("Account created successfully. Please log in.");
      return;
    }

    const token = result?.token || result?.sessionToken || result?.accessToken;

    if (!token) {
      throw new Error("Login succeeded, but no session token was returned.");
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    onAuthSuccess(token);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Receipt Splitter</p>
        <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-subtitle">
          {isSignup
            ? "Sign up to access your receipt splitting workspace."
            : "Log in to continue splitting receipts and generating invoices."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder="Enter your password"
            />
          </label>

          {isSignup && (
            <label>
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Re-enter your password"
              />
            </label>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : isSignup ? "Sign Up" : "Log In"}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "Need an account?"}{" "}
          <button type="button" onClick={onSwitchMode}>
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </p>
      </section>
    </main>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [isCheckingSession, setIsCheckingSession] = useState(Boolean(token));

  useEffect(() => {
    let ignore = false;

    const checkSession = async () => {
      if (!token) {
        setIsCheckingSession(false);
        setUser(null);
        return;
      }

      setIsCheckingSession(true);

      try {
        const result = await apiRequest("/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!ignore) {
          setUser(result?.user || result);
        }
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);

        if (!ignore) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!ignore) {
          setIsCheckingSession(false);
        }
      }
    };

    checkSession();

    return () => {
      ignore = true;
    };
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setAuthMode("login");
  };

  if (isCheckingSession) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-card-small">
          <p className="eyebrow">Receipt Splitter</p>
          <h1>Checking session...</h1>
        </section>
      </main>
    );
  }

  if (!token) {
    return (
      <AuthForm
        mode={authMode}
        onSwitchMode={() => setAuthMode((prev) => (prev === "login" ? "signup" : "login"))}
        onAuthSuccess={setToken}
      />
    );
  }

  return <ReceiptInvoice currentUser={user} onLogout={handleLogout} />;
}
