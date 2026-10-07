// ============================================
// RAYIS BOZORI — PWA Manager
// ============================================

(function() {
  'use strict';

  if (!document.querySelector('link[rel="manifest"]')) {
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = 'manifest.json';
    document.head.appendChild(manifestLink);
  }

  if (!document.querySelector('meta[name="theme-color"]')) {
    const themeMeta = document.createElement('meta');
    themeMeta.name = 'theme-color';
    themeMeta.content = '#0B1119';
    document.head.appendChild(themeMeta);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { scope: './' })
        .then((registration) => console.log('✅ [PWA] SW tayyor:', registration.scope))
        .catch((error) => console.warn('⚠️ [PWA] SW xato:', error));
    });
  }

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButton();
  });

  function showInstallButton() {
    if (document.getElementById('pwaInstallBtn')) return;
    if (localStorage.getItem('rayis_pwa_dismissed') === '1') return;

    const btn = document.createElement('div');
    btn.id = 'pwaInstallBtn';
    btn.innerHTML = '<div style="position:fixed;bottom:100px;left:16px;right:16px;max-width:600px;margin:0 auto;background:linear-gradient(135deg,#10B981,#059669);color:#fff;padding:14px 18px;border-radius:16px;box-shadow:0 8px 24px rgba(16,185,129,.4);z-index:250;display:flex;align-items:center;gap:12px;cursor:pointer;font-family:inherit"><div style="font-size:28px">📲</div><div style="flex:1"><div style="font-size:14px;font-weight:900;margin-bottom:2px">RAYIS ni o\'rnatish</div><div style="font-size:11px;opacity:.9">Tez ochiladi, offline ishlaydi</div></div></div>';
    btn.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      btn.remove();
    };
    document.body.appendChild(btn);
  }

  function hideInstallButton() {
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) btn.remove();
  }

  window.addEventListener('online', () => {
    if (typeof toast === 'function') toast('🟢 Online', 'o');
  });

  window.addEventListener('offline', () => {
    if (typeof toast === 'function') toast('🔴 Offline rejim', 'e');
  });

  console.log('✅ [PWA] Manager tayyor');
})();