import { useState } from 'react';
import { login as loginApi, logout as logoutApi, signup as signupApi } from '../api/auth';
import type { AuthUser } from '../types/auth';

/**
 * 백엔드 인증은 세션(JSESSIONID) 방식이고 "지금 누구냐"를 묻는 엔드포인트가 없다.
 * 그래서 로그인 결과를 localStorage 에 표시용으로만 두고, 서버가 COMMON401 을
 * 주면 그때 지운다(= 세션 만료). 세션의 실제 주인은 언제나 쿠키다.
 */
const USER_KEY = 'meetroute.user.v1';

export function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function writeStoredUser(user: AuthUser | null): void {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* 시크릿 모드·용량 초과면 이번 세션에서만 유지된다 */
  }
}

interface Props {
  user: AuthUser | null;
  onChange: (user: AuthUser | null) => void;
  disabled: boolean;
}

export default function AuthBar({ user, onChange, disabled }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<AuthUser | null>, okText: (u: AuthUser | null) => string) {
    setBusy(true);
    try {
      const next = await fn();
      onChange(next);
      setMsg({ text: okText(next), ok: true });
      setPassword('');
    } catch (error) {
      setMsg({ text: (error as Error).message, ok: false });
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <div className="authbar">
        {msg && <span className={`msg${msg.ok ? ' ok' : ''}`}>{msg.text}</span>}
        <span className="who">
          <b>{user.name}</b> · {user.email}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              // 세션이 이미 끊겼어도 화면은 비운다.
              await logoutApi().catch(() => undefined);
              return null;
            }, () => '로그아웃되었습니다.')
          }
        >
          로그아웃
        </button>
      </div>
    );
  }

  const canSubmit = !disabled && !busy && email.trim() !== '' && password !== '';

  return (
    <div className="authbar">
      {msg && <span className={`msg${msg.ok ? ' ok' : ''}`}>{msg.text}</span>}
      <input placeholder="이름 (가입 시)" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        type="email"
        placeholder="이메일"
        value={email}
        autoComplete="email"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        autoComplete="current-password"
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSubmit) {
            void run(() => loginApi({ email: email.trim(), password }), (u) => `${u?.name}님, 로그인되었습니다.`);
          }
        }}
      />
      <button
        type="button"
        className="primary"
        disabled={!canSubmit}
        onClick={() =>
          run(() => loginApi({ email: email.trim(), password }), (u) => `${u?.name}님, 로그인되었습니다.`)
        }
      >
        로그인
      </button>
      <button
        type="button"
        disabled={!canSubmit || name.trim() === ''}
        onClick={() =>
          run(async () => {
            await signupApi({ name: name.trim(), email: email.trim(), password });
            return loginApi({ email: email.trim(), password }); // 가입 직후 바로 로그인
          }, (u) => `${u?.name}님, 가입 후 로그인되었습니다.`)
        }
      >
        회원가입
      </button>
    </div>
  );
}
