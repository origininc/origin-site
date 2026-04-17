"use client";

type StudioGateProps = {
  errorMessage: string | null;
  isConfigured: boolean;
};

export default function StudioGate({
  errorMessage,
  isConfigured,
}: StudioGateProps) {
  return (
    <main className="studioShell">
      <section className="gateCard">
        <p className="eyebrow">Pipeline Studio</p>
        <h1 className="title">Origin Studio</h1>
        <p className="body">
          Unlock image uploads, a live creature system, and live cymatics in one hidden
          studio surface, then tune the shared shader stack and export PNGs.
        </p>

        {isConfigured ? (
          <form action="/client/studio/auth" method="post" className="gateForm">
            <label className="label" htmlFor="studio-passphrase">
              Passphrase
            </label>
            <input
              id="studio-passphrase"
              name="passphrase"
              type="password"
              autoComplete="current-password"
              className="input"
              placeholder="Enter Origin Studio passphrase"
              required
            />
            <button type="submit" className="button">
              Enter Studio
            </button>
          </form>
        ) : (
          <div className="configNotice">
            Set <code>ORIGIN_STUDIO_PASSPHRASE</code> and{" "}
            <code>ORIGIN_STUDIO_COOKIE_SECRET</code> to enable this route.
          </div>
        )}

        {errorMessage ? <p className="error">{errorMessage}</p> : null}
      </section>

      <style jsx>{`
        .studioShell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
          background: #000;
          color: #fff;
        }

        .gateCard {
          width: min(100%, 560px);
          padding: 32px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(18px);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
        }

        .eyebrow {
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.56);
          margin-bottom: 12px;
        }

        .title {
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 500;
          line-height: 0.96;
          margin-bottom: 14px;
        }

        .body {
          font-size: 15px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.72);
          margin-bottom: 28px;
          max-width: 42ch;
        }

        .gateForm {
          display: grid;
          gap: 12px;
        }

        .label {
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.58);
        }

        .input {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(0, 0, 0, 0.38);
          color: #fff;
          font: inherit;
          padding: 14px 16px;
          outline: none;
        }

        .input:focus {
          border-color: rgba(255, 255, 255, 0.4);
        }

        .button {
          width: fit-content;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: #fff;
          color: #000;
          padding: 12px 16px;
          font: inherit;
          font-size: 14px;
          cursor: pointer;
        }

        .error,
        .configNotice {
          margin-top: 16px;
          font-size: 14px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.68);
        }

        .error {
          color: #ff8f8f;
        }

        code {
          font-family: inherit;
          color: #fff;
        }
      `}</style>
    </main>
  );
}
