# Chat Chime — plugin DSH

Suara lonceng pendek + kartu selesai yang bisa diklik setiap kali satu turn chat
selesai. Semua bunyi disintesis di browser (Web Audio), jadi tidak ada file audio
dan tidak ada dependensi npm sama sekali.

## Isi paket

```
dsh-chat-chime/
  package.json       manifest bundle + bagian `dsh.client`
  cordis.patch.yml   patch yang menyisipkan row `chat-chime`
  index.js           half Host (sengaja kosong: semua kerja di browser)
  client.js          half browser: chime, kartu selesai, baris Settings
  locale/en.json     judul + deskripsi untuk Plugin Manager (Inggris)
  locale/id.json     versi Indonesia
  locale/zh.json     versi Mandarin
  icon.svg           ikon plugin
```

Tidak ada `dependencies` maupun `peerDependencies`: React disediakan oleh tabel
modul browser, dan semua data sesi datang lewat standard props slot. Karena itu
tidak ada yang perlu di-install lebih dulu.

## Cara pasang

### A. Dari repo git (disarankan untuk banyak mesin)

```powershell
git clone https://github.com/RafiMM0609/dsh-chat-chime-push.git
```

Lalu minta agent DSH di mesin itu menjalankan `plugin_manager` dengan
`action: install_bundle` dan `target` = path absolut folder hasil klon.

Untuk memperbarui di kemudian hari:

```powershell
cd dsh-chat-chime
git pull
```

`install_bundle` menautkan folder (junction/symlink), bukan menyalin, jadi
perubahan `client.js` langsung terpakai setelah halaman di-reload.

### B. Dari arsip zip

1. Ekstrak `dsh-chat-chime-1.0.0.zip` jadi folder `dsh-chat-chime`.
2. Pasang seperti di atas dengan `target` = path folder itu.

### C. Salin folder apa adanya

Salin foldernya ke mesin tujuan di mana saja (jangan di dalam
`~/.dsh/profiles/...`; biarkan DSH yang membuat tautannya), lalu pasang.

## Setelah terpasang

1. Pastikan hasilnya `application: applied`, lalu reload halaman Web GUI.
2. **Klik di mana saja di halaman** sebelum menguji suara. Browser menolak audio
   sebelum ada interaksi pengguna; setelah klik pertama, nada siap berbunyi.
3. Buka Settings → General → **Chat Chime** untuk mengatur suara dan kartu, atau
   tekan **Coba nada** untuk memastikan audio tidak diblokir.

## Cara kerja singkat

Sinyal "selesai" adalah transisi `running: true -> false` pada satu Session
biasa di Session list. Plugin memakai `useSessionStatus` dari slot props, jadi
tidak ada polling dan tidak ada event baru yang ditulis ke session log:

- **Chime**: triad lonceng ~0,4 detik lewat Web Audio, tanpa aset.
- **Kartu**: muncul di kanan bawah bila kamu tidak sedang melihat chat itu,
  berisi judul chat + tombol **Buka chat** (memanggil `uiWorkspace.openSession`)
  dan **Tutup**. Hilang sendiri setelah 15 detik, maksimal 3 kartu bertumpuk.
- Chat subagent dan Session kosong yang belum dipakai tidak memicu notifikasi.
- Beberapa chat selesai berbarengan → lonceng berbunyi sekali, kartunya satu per chat.
- Animasi dimatikan bila OS memakai `prefers-reduced-motion`.

## Catatan kompatibilitas

- Tidak terikat versi DSH tertentu. Hanya memakai dua slot (`shell.overlay`,
  `settings.general.item`) dan standard props (`useSessionStatus`, `useSessions`, `t`).
- Kalau sebuah slot tidak ada di komposisi mesin tujuan, registrasinya menjadi
  no-op dan sisa DSH tetap jalan — tidak melempar error. Bila
  `settings.general.item` tidak tersedia, kartu dan suara tetap bekerja; hanya
  baris pengaturannya yang tidak muncul.
- Preferensi (suara/kartu) disimpan di `localStorage` browser, per-origin
  `http://127.0.0.1:<port>`. Bila port Web GUI berubah, pengaturan kembali ke
  default (`Selalu` + kartu aktif).

## Lisensi

MIT — lihat [LICENSE](LICENSE).
