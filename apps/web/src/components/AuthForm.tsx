import { useEffect, useState } from "react";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { apiFetch } from "../lib/api";
import type { AuthResponse } from "../types";

type AuthMode = "login" | "register";

type AuthFormProps = {
  onAuth: (token: string, user: AuthResponse["user"]) => void;
  language: "ru" | "en";
};

function formatAuthError(error: unknown, fallback: string, language: "ru" | "en"): string {
  if (!(error instanceof Error)) return fallback;

  const message = error.message?.trim();
  if (!message) return fallback;

  if (message.includes("The string did not match the expected pattern")) {
    return language === "ru"
      ? "Не удалось выполнить вход через Touch ID. Попробуй снова."
      : "Could not complete Touch ID sign-in. Please try again.";
  }

  return message;
}

export function AuthForm({ onAuth, language }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touchIdAvailable, setTouchIdAvailable] = useState(false);

  const isRegister = mode === "register";
  const isRu = language === "ru";

  useEffect(() => {
    if (!browserSupportsWebAuthn()) {
      setTouchIdAvailable(false);
      return;
    }

    platformAuthenticatorIsAvailable()
      .then((available) => {
        setTouchIdAvailable(available);
      })
      .catch(() => {
        setTouchIdAvailable(false);
      });
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = isRegister
        ? { email: email.trim(), username: username.trim(), password }
        : { email: email.trim(), password };

      const response = await apiFetch<AuthResponse>(
        isRegister ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      onAuth(response.token, response.user);
    } catch (submitError) {
      setError(formatAuthError(submitError, "Auth failed", language));
    } finally {
      setLoading(false);
    }
  }

  async function handleTouchIdRegister() {
    setError(null);

    if (!email.trim() || !username.trim()) {
      setError(isRu ? "Сначала введи email и username" : "Enter email and username first");
      return;
    }

    setLoading(true);
    try {
      const optionsResponse = await apiFetch<{
        flowId: string;
        options: Parameters<typeof startRegistration>[0]["optionsJSON"];
      }>("/auth/passkey/register/options", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          username: username.trim(),
        }),
      });

      const registrationResponse = await startRegistration({
        optionsJSON: optionsResponse.options,
      });

      const authResponse = await apiFetch<AuthResponse>("/auth/passkey/register/verify", {
        method: "POST",
        body: JSON.stringify({
          flowId: optionsResponse.flowId,
          response: registrationResponse,
        }),
      });

      onAuth(authResponse.token, authResponse.user);
    } catch (submitError) {
      setError(formatAuthError(submitError, "Touch ID registration failed", language));
    } finally {
      setLoading(false);
    }
  }

  async function handleTouchIdLogin() {
    setError(null);

    if (!email.trim()) {
      setError(isRu ? "Сначала введи email" : "Enter email first");
      return;
    }

    setLoading(true);
    try {
      const optionsResponse = await apiFetch<{
        flowId: string;
        options: Parameters<typeof startAuthentication>[0]["optionsJSON"];
      }>("/auth/passkey/login/options", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const authenticationResponse = await startAuthentication({
        optionsJSON: optionsResponse.options,
      });

      const authResponse = await apiFetch<AuthResponse>("/auth/passkey/login/verify", {
        method: "POST",
        body: JSON.stringify({
          flowId: optionsResponse.flowId,
          response: authenticationResponse,
        }),
      });

      onAuth(authResponse.token, authResponse.user);
    } catch (submitError) {
      setError(formatAuthError(submitError, "Touch ID login failed", language));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>brgram</h1>
        <p>
          {isRu ? "Безопасные сообщения с каналами в реальном времени" : "Secure messaging with realtime channels"}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            {isRu ? "Почта" : "Email"}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          {isRegister ? (
            <label>
              {isRu ? "Имя пользователя" : "Username"}
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={isRu ? "br_user или br-user" : "br_user or br-user"}
                minLength={3}
                maxLength={20}
                title={isRu ? "Только буквы, цифры, _ и -" : "Use only letters, numbers, _ and -"}
                required
              />
            </label>
          ) : null}

          <label>
            {isRu ? "Пароль" : "Password"}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          {error ? <div className="error-box">{error}</div> : null}

          <button type="submit" disabled={loading}>
            {loading ? (isRu ? "Подожди..." : "Please wait...") : isRegister ? (isRu ? "Создать аккаунт" : "Create account") : isRu ? "Войти" : "Login"}
          </button>
        </form>

        <div className="auth-passkey">
          <button
            type="button"
            className="touchid-button"
            onClick={isRegister ? handleTouchIdRegister : handleTouchIdLogin}
            disabled={loading || !touchIdAvailable}
          >
            {loading
              ? isRu
                ? "Подожди..."
                : "Please wait..."
              : isRegister
                ? isRu
                  ? "Создать с Touch ID"
                  : "Create with Touch ID"
                : isRu
                  ? "Войти с Touch ID"
                  : "Login with Touch ID"}
          </button>
          <small>
            {touchIdAvailable
              ? isRegister
                ? isRu
                  ? "Mac Touch ID: введи email + username и подтверди отпечаток"
                  : "Mac Touch ID: fill email + username and confirm fingerprint"
                : isRu
                  ? "Mac Touch ID: введи email и подтверди отпечаток"
                  : "Mac Touch ID: fill email and confirm fingerprint"
              : isRu
                ? "Touch ID недоступен в этом браузере/сессии"
                : "Touch ID is unavailable in this browser/session"}
          </small>
        </div>

        <button
          type="button"
          className="ghost-button"
          onClick={() => setMode(isRegister ? "login" : "register")}
        >
          {isRegister
            ? isRu
              ? "Уже есть аккаунт? Войти"
              : "Already have an account? Login"
            : isRu
              ? "Нет аккаунта? Создать"
              : "No account? Create one"}
        </button>
      </div>
    </div>
  );
}
