const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

export const loginPage = (opts: {
  reqToken: string;
  webUrl: string;
  clientName?: string;
  error?: string;
}): string => {
  const app = opts.clientName ? esc(opts.clientName) : "an application";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sign in to Savetrix</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background:#0b1220; color:#e7eefc; padding:24px; }
  .card { width:100%; max-width:380px; background:#131c30; border:1px solid #223052;
    border-radius:16px; padding:28px; box-shadow:0 12px 40px rgba(0,0,0,.4); }
  h1 { font-size:20px; margin:0 0 4px; }
  p.sub { margin:0 0 20px; font-size:13px; color:#93a4c7; }
  label { display:block; font-size:13px; margin:14px 0 6px; color:#c3d0ea; }
  input { width:100%; padding:11px 12px; border-radius:10px; border:1px solid #2b3a5e;
    background:#0e1526; color:#e7eefc; font-size:14px; }
  input:focus { outline:2px solid #3b82f6; border-color:transparent; }
  button { width:100%; margin-top:22px; padding:12px; border:0; border-radius:10px;
    background:#3b82f6; color:#fff; font-size:15px; font-weight:600; cursor:pointer; }
  button:hover { background:#2f6fe0; }
  .err { margin-top:16px; padding:10px 12px; border-radius:10px; font-size:13px;
    background:#3a1620; border:1px solid #7f2438; color:#ffb4c2; }
  .foot { margin-top:18px; font-size:12px; color:#93a4c7; text-align:center; }
  a { color:#7fa8ff; }
</style>
</head>
<body>
  <form class="card" method="POST" action="/login">
    <h1>Sign in to Savetrix</h1>
    <p class="sub">${app} wants to connect to your Savetrix account.</p>
    ${opts.error ? `<div class="err">${esc(opts.error)}</div>` : ""}
    <input type="hidden" name="req" value="${esc(opts.reqToken)}" />
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" required autofocus />
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required />
    <button type="submit">Authorize</button>
    <div class="foot">No account? <a href="${esc(opts.webUrl)}/" target="_blank" rel="noopener">Sign up at scantrix.ai</a></div>
  </form>
</body>
</html>`;
};
