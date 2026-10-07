// ============================================
// RAYIS BOZORI — DB Module
// Firebase + localStorage fallback
// ============================================

(function() {
  'use strict';

  let FB_DB = null;
  let FB_AUTH = null;
  let FB_USER = null;
  let FB_READY = false;
  let FB_ONLINE = false;
  const CACHE = {};
  const LISTENERS = {};

  function initFirebase() {
    if (typeof firebase === 'undefined') {
      console.warn('[DB] Firebase SDK topilmadi');
      return false;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      FB_DB = firebase.database();
      FB_AUTH = firebase.auth();

      FB_AUTH.signInAnonymously()
        .then((cred) => {
          FB_USER = cred.user;
          FB_READY = true;
          FB_ONLINE = true;
          console.log('✅ [DB] Firebase tayyor, uid:', FB_USER.uid);
          Object.keys(LISTENERS).forEach((key) => attachListener(key));
          window.dispatchEvent(new CustomEvent('db:ready', { detail: { uid: FB_USER.uid } }));
        })
        .catch((err) => {
          console.warn('[DB] Auth xato:', err);
          FB_ONLINE = false;
        });

      FB_DB.ref('.info/connected').on('value', (snap) => {
        FB_ONLINE = snap.val() === true;
        console.log('[DB] Ulanish:', FB_ONLINE ? '✅ Online' : '⚠️ Offline');
        window.dispatchEvent(new CustomEvent('db:connection', { detail: { online: FB_ONLINE } }));
      });
      return true;
    } catch (err) {
      console.error('[DB] Firebase init xato:', err);
      return false;
    }
  }

  function lsKey(key) { return DB_PREFIX + key; }
  function readLocal(key) {
    try {
      const raw = localStorage.getItem(lsKey(key));
      return raw === null ? null : JSON.parse(raw);
    } catch (e) { return null; }
  }
  function writeLocal(key, value) {
    try {
      if (value === null || value === undefined) localStorage.removeItem(lsKey(key));
      else localStorage.setItem(lsKey(key), JSON.stringify(value));
    } catch (e) { console.warn('[DB] localStorage xato:', e); }
  }
  function fbPath(key) { return 'rayis/' + key; }

  function attachListener(key) {
    if (!FB_DB) return;
    const ref = FB_DB.ref(fbPath(key));
    const callback = LISTENERS[key];
    ref.on('value', (snap) => {
      const val = snap.val();
      CACHE[key] = val;
      writeLocal(key, val);
      if (typeof callback === 'function') callback(val);
      window.dispatchEvent(new CustomEvent('db:change', { detail: { key, value: val } }));
    }, (err) => console.warn('[DB] Listen xato:', key, err));
  }

  const DB = {
    init() { initFirebase(); return this; },
    isReady() { return FB_READY; },
    isOnline() { return FB_ONLINE; },
    getUid() { return FB_USER ? FB_USER.uid : null; },

    get(key, defaultValue) {
      if (CACHE[key] !== undefined) return CACHE[key];
      const val = readLocal(key);
      if (val !== null) { CACHE[key] = val; return val; }
      return defaultValue !== undefined ? defaultValue : null;
    },

    async set(key, value) {
      CACHE[key] = value;
      writeLocal(key, value);
      if (FB_DB && FB_USER) {
        try {
          await FB_DB.ref(fbPath(key)).set(value);
          if (DEBUG) console.log('[DB] ✅ Set:', key);
          return true;
        } catch (err) {
          console.warn('[DB] ❌ Firebase set xato:', key, err);
          return false;
        }
      }
      return false;
    },

    async update(key, partial) {
      const current = this.get(key) || {};
      const merged = Object.assign({}, current, partial);
      return this.set(key, merged);
    },

    async push(key, item) {
      const arr = this.get(key) || [];
      if (!Array.isArray(arr)) { console.warn('[DB] Push: massiv emas', key); return false; }
      arr.push(item);
      return this.set(key, arr);
    },

    async remove(key) {
      delete CACHE[key];
      writeLocal(key, null);
      if (FB_DB && FB_USER) {
        try {
          await FB_DB.ref(fbPath(key)).remove();
          if (DEBUG) console.log('[DB] 🗑 Removed:', key);
          return true;
        } catch (err) {
          console.warn('[DB] ❌ Firebase remove xato:', key, err);
          return false;
        }
      }
      return false;
    },

    getAll() {
      const result = {};
      Object.keys(CACHE).forEach((key) => { result[key] = CACHE[key]; });
      return result;
    },

    async clearAll() {
      Object.keys(CACHE).forEach((key) => { delete CACHE[key]; });
      try {
        const keys = Object.keys(localStorage);
        keys.forEach((k) => { if (k.startsWith(DB_PREFIX)) localStorage.removeItem(k); });
      } catch (e) {}
      if (FB_DB && FB_USER) {
        try { await FB_DB.ref('rayis').remove(); return true; }
        catch (err) { console.warn('[DB] Firebase clearAll xato:', err); return false; }
      }
      return false;
    },

    on(key, callback) {
      LISTENERS[key] = callback;
      if (FB_DB && FB_READY) attachListener(key);
      const val = this.get(key);
      if (val !== null && typeof callback === 'function') setTimeout(() => callback(val), 0);
      return () => { delete LISTENERS[key]; if (FB_DB) FB_DB.ref(fbPath(key)).off('value'); };
    },

    off(key) {
      delete LISTENERS[key];
      if (FB_DB) FB_DB.ref(fbPath(key)).off('value');
    },

    async syncAll() {
      if (!FB_DB || !FB_USER) { console.warn('[DB] Sync: Firebase tayyor emas'); return false; }
      try {
        const snap = await FB_DB.ref('rayis').once('value');
        const data = snap.val() || {};
        Object.keys(data).forEach((key) => { CACHE[key] = data[key]; writeLocal(key, data[key]); });
        if (DEBUG) console.log('[DB] ✅ Sync bajarildi:', Object.keys(data).length, 'kalit');
        return true;
      } catch (err) { console.warn('[DB] Sync xato:', err); return false; }
    },

    auth: {
      getUser() { return FB_USER; },
      signOut() {
        if (FB_AUTH) FB_AUTH.signOut().then(() => { FB_USER = null; console.log('[DB] Auth signed out'); });
      }
    },

    async uploadImage(file, folder = 'general') {
      if (!file) throw new Error('Fayl yo\'q');
      if (file.size > 10 * 1024 * 1024) throw new Error('Rasm 10MB dan katta');
      const b64 = await compressImage(file, 1200, 0.8);
      const blob = await fetch(b64).then(r => r.blob());
      const fd = new FormData();
      fd.append('file', blob);
      fd.append('upload_preset', CLOUDINARY.uploadPreset);
      fd.append('folder', folder);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`, {
        method: 'POST', body: fd
      });
      if (!res.ok) throw new Error('Yuklanmadi: ' + res.status);
      const data = await res.json();
      return { url: data.secure_url, id: data.public_id };
    }
  };

  function compressImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            let w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
              else { w = Math.round(w * maxDim / h); h = maxDim; }
            }
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(c.toDataURL('image/jpeg', quality));
          } catch (err) { reject(err); }
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  window.DB = DB;
  window.RAYIS_CONFIG = { FIREBASE_CONFIG, CLOUDINARY };
  console.log('✅ [DB] Modul yuklandi');
})();