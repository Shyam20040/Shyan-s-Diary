export default function SetupRequiredPage() {
  return (
    <main className="access-page">
      <section className="access-card">
        <div className="brand-mark"><span /></div>
        <p className="eyebrow">SETUP REQUIRED</p>
        <h1>Private by default.</h1>
        <p className="muted">
          This deployment is locked because owner access has not been configured.
          Set <code>APP_ACCESS_PASSWORD</code> and <code>APP_SESSION_SECRET</code>
          on the server, then restart the application.
        </p>
      </section>
    </main>
  );
}
