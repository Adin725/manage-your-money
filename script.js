const App = (() => {
    const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
    const parseRp = (str) => parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
    const formatK = (num) => num >= 1000 ? (num/1000).toFixed(num%1000 !== 0 ? 1 : 0) + 'k' : num;
    
    let db, charts = {};
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.color = '#94A3B8';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.elements.line.tension = 0.4;
    Chart.defaults.animation.duration = 400; // Super fast animation
    Chart.register(ChartDataLabels);

    const Data = {
        async init() {
            localforage.config({ name: 'MumyWalletAI', storeName: 'appData' });
            db = localforage;
            if (!(await db.getItem('wallets'))) await db.setItem('wallets', { tunai: 0, bank: 0 });
            if (!(await db.getItem('history'))) await db.setItem('history', []);
            if (!(await db.getItem('budget'))) await db.setItem('budget', 0);
            if (!(await db.getItem('goals'))) await db.setItem('goals', []);
            if (!(await db.getItem('subs'))) await db.setItem('subs', []);
        },
        async get(key) { return await db.getItem(key); },
        async set(key, val) { await db.setItem(key, val); },
        async clearData() {
            if (confirm('Anda yakin ingin mereset seluruh data?')) {
                await db.clear(); await this.init();
                App.UI.toast('Data direset'); window.location.reload();
            }
        },
        async exportBackup() {
            const data = { wallets: await this.get('wallets'), history: await this.get('history'), budget: await this.get('budget'), goals: await this.get('goals'), subs: await this.get('subs') };
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `Mumy_Finance_Backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
        },
        importBackup(e) {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (data.wallets && data.history) {
                        for(let k in data) await this.set(k, data[k]);
                        App.UI.toast('Restore berhasil!'); App.Core.refresh();
                    }
                } catch(err) { App.UI.toast('File backup tidak valid!'); }
            };
            reader.readAsText(file);
        },
        async generateDummyData() {
            const now = new Date();
            const currYear = now.getFullYear();
            const currMonth = now.getMonth();
            const prevMonth = currMonth === 0 ? 11 : currMonth - 1;
            const prevYear = currMonth === 0 ? currYear - 1 : currYear;

            let history = [];
            
            // Generate Prev Month Data
            for(let i = 1; i <= 28; i+=2) {
                const dateStr = new Date(prevYear, prevMonth, i, 12, 0).toISOString();
                history.push({ id: Date.now()+Math.random(), type: 'expense', amount: 50000 + Math.random()*50000, note: 'Makan Siang', wallet: 'bank', category: 'Makanan & Minuman', date: dateStr });
                history.push({ id: Date.now()+Math.random(), type: 'expense', amount: 10000, note: 'Parkir / Admin', wallet: 'tunai', category: 'Lainnya', date: dateStr });
            }
            history.push({ id: Date.now()+Math.random(), type: 'expense', amount: 300000, note: 'Bensin Bulanan', wallet: 'bank', category: 'Transportasi', date: new Date(prevYear, prevMonth, 5).toISOString() });
            
            // Generate Current Month Data up to day 21
            history.push({ id: Date.now()+Math.random(), type: 'income', amount: 6000000, note: 'Gaji Bulanan', wallet: 'bank', category: 'Pemasukan', date: new Date(currYear, currMonth, 1).toISOString() });
            
            for(let i = 1; i <= 21; i++) {
                const dateStr = new Date(currYear, currMonth, i, 13, 0).toISOString();
                history.push({ id: Date.now()+Math.random(), type: 'expense', amount: 60000 + Math.random()*40000, note: 'Makan', wallet: 'bank', category: 'Makanan & Minuman', date: dateStr });
                if(i % 3 === 0) history.push({ id: Date.now()+Math.random(), type: 'expense', amount: 15000, note: 'Parkir / Admin', wallet: 'tunai', category: 'Lainnya', date: dateStr });
            }
            
            // Inject Anomaly (Current Month)
            history.push({ id: Date.now()+Math.random(), type: 'expense', amount: 350000, note: 'Starbucks Bareng Teman', wallet: 'bank', category: 'Makanan & Minuman', date: new Date(currYear, currMonth, 15).toISOString() });
            history.push({ id: Date.now()+Math.random(), type: 'expense', amount: 1200000, note: 'Beli Sepatu', wallet: 'bank', category: 'Belanja', date: new Date(currYear, currMonth, 18).toISOString() });

            // Sort history desc
            history.sort((a,b) => new Date(b.date) - new Date(a.date));

            await this.set('history', history);
            await this.set('wallets', { bank: 3500000, tunai: 500000 });
            await this.set('budget', 4000000);
            
            App.UI.toast('Data Dummy Berhasil Diinjeksi!');
            window.location.reload();
        }
    };

    const Auth = {
        activeScreen: 'screen-onboarding',
        navTo(targetId) {
            const current = document.getElementById(this.activeScreen);
            const target = document.getElementById(targetId);
            if(!current || !target) return;
            
            let outAnim = 'slide-out-left', inAnim = 'slide-in-right';
            if (targetId === 'screen-onboarding') { outAnim = 'slide-out-right'; inAnim = 'slide-in-left'; }
            if (targetId === 'screen-app' || targetId === 'screen-story') { outAnim = 'slide-out-up'; inAnim = 'slide-in-up'; }

            current.classList.add(outAnim);
            target.classList.add('active', inAnim);

            setTimeout(() => {
                current.classList.remove('active', outAnim);
                target.classList.remove(inAnim);
                this.activeScreen = targetId;
            }, 600);
        },
        async check() {
            const pin = await Data.get('auth_pin');
            const profile = await Data.get('user_profile');
            
            if (!pin || !profile) {
                document.getElementById('screen-onboarding').classList.add('active');
                this.activeScreen = 'screen-onboarding';
            } else {
                document.getElementById('login-greeting').textContent = `Selamat Datang, ${profile.name}!`;
                document.getElementById('screen-login').classList.add('active');
                this.activeScreen = 'screen-login';
                this.updateAppHeader(profile);
            }
        },
        async handleRegisterProfile(e) {
            e.preventDefault();
            const profile = { 
                name: document.getElementById('reg-name').value, 
                email: document.getElementById('reg-email').value, 
                dob: document.getElementById('reg-dob').value 
            };
            await Data.set('user_profile', profile);
            this.updateAppHeader(profile);
            this.navTo('screen-register-pin');
        },
        async handleCreatePin(e) {
            e.preventDefault();
            const input = document.getElementById('create-pin-input');
            await Data.set('auth_pin', input.value);
            input.classList.add('success-pulse');
            setTimeout(() => { App.Story.start(); App.Core.refresh(); }, 500);
        },
        async handleLogin(e) {
            e.preventDefault();
            const input = document.getElementById('login-pin-input');
            const savedPin = await Data.get('auth_pin');
            if (input.value === savedPin) {
                input.classList.add('success-pulse');
                setTimeout(() => { App.Story.start(); App.Core.refresh(); }, 500);
            } else {
                input.classList.add('shake'); App.UI.toast('PIN Salah!');
                setTimeout(() => { input.classList.remove('shake'); input.value=''; }, 400);
            }
        },
        updateAppHeader(profile) {
            if(!profile) return;
            document.getElementById('header-name-greeting').textContent = 'Halo,';
            document.getElementById('header-name-display').textContent = profile.name;
            document.getElementById('profile-name-large').textContent = profile.name;
            document.getElementById('profile-email-large').textContent = profile.email;
        },
        logout() { window.location.reload(); }
    };

    const Story = {
        step: 0,
        texts: [],
        async start() {
            const profile = await Data.get('user_profile');
            const name = profile ? profile.name : 'Kamu';
            const pinStr = profile ? profile.pin : '';
            
            const history = await Data.get('history') || [];
            const budget = await Data.get('budget') || 0;
            const expThisMonth = history.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === new Date().getMonth()).reduce((a, b) => a + b.amount, 0);
            
            let budgetText = '';
            if (budget > 0) {
                const pct = Math.round((expThisMonth / budget) * 100);
                budgetText = `Bulan ini kamu sudah pakai ${pct}% dari batas anggaranmu. `;
            }
            
            this.texts = [
                `Halo ${name}! Aku Mumy, asisten finansial cerdasmu! ✨`,
                `Pengeluaranmu bulan ini sudah mencapai Rp ${expThisMonth.toLocaleString('id-ID')}. ${budgetText}Yuk kelola keuangan lebih bijak! 💸`
            ];
            
            document.getElementById('screen-register-profile').classList.remove('active');
            document.getElementById('screen-register-pin').classList.remove('active');
            document.getElementById('screen-login').classList.remove('active');     
            Auth.navTo('screen-story');
            this.step = 0;
            this.typeText();
        },
        typeText() {
            const bubble = document.getElementById('story-bubble');
            const btn = document.getElementById('btn-story-next');
            btn.style.display = 'none';
            bubble.innerHTML = '';
            const txt = this.texts[this.step];
            let i = 0;
            
            const typing = setInterval(() => {
                if (i < txt.length) { bubble.innerHTML += txt.charAt(i); i++; }
                else { clearInterval(typing); btn.style.display = 'block'; }
            }, 30); // Typewriter speed
        },
        async next() {
            this.step++;
            if(this.step < this.texts.length) { this.typeText(); }
            else { Auth.navTo('screen-app'); }
        }
    };

    const ML = {
        keywords: {
            'Makanan & Minuman': ['makan', 'minum', 'kopi', 'kfc', 'mcd', 'indomie', 'sate', 'nasi', 'roti', 'bakso', 'ayam', 'teh'],
            'Transportasi': ['bensin', 'gojek', 'grab', 'tol', 'parkir', 'krl', 'mrt', 'kereta', 'shell', 'ojek'],
            'Belanja': ['baju', 'sepatu', 'shopee', 'tokopedia', 'supermarket', 'alfamart', 'indomaret', 'sabun', 'belanja'],
            'Tagihan': ['listrik', 'air', 'internet', 'wifi', 'pulsa', 'kuota', 'kos', 'cicilan', 'token', 'pajak'],
            'Hiburan': ['bioskop', 'netflix', 'spotify', 'game', 'tiket', 'main', 'jalan', 'nonton'],
            'Kesehatan': ['obat', 'dokter', 'rs', 'apotek', 'vitamin', 'sakit', 'klinik'],
            'Pendidikan': ['buku', 'spp', 'kursus', 'kuliah', 'sekolah', 'les']
        },
        async predictCategory(text) {
            if(!text || text.length < 3) return;
            text = text.toLowerCase();
            let bestCat = 'Lainnya'; let maxMatch = 0;
            for(let cat in this.keywords) {
                let match = 0;
                this.keywords[cat].forEach(kw => { if(text.includes(kw)) match++; });
                if(match > maxMatch) { maxMatch = match; bestCat = cat; }
            }
            const select = document.getElementById('exp-category');
            if(select && select.value !== bestCat) {
                select.value = bestCat;
                const badge = document.getElementById('ai-badge');
                if(badge) {
                    badge.style.display = 'inline-block';
                    setTimeout(() => badge.style.display = 'none', 3000);
                }
            }
            return bestCat;
        }
    };

    const UI = {
        toast(msg) {
            const el = document.getElementById('toast');
            el.textContent = msg; el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), 3000);
        },
        switchView(id) {
            document.querySelectorAll('.view, .nav-item').forEach(el => el.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            const nav = document.querySelector(`[data-target="${id}"]`);
            if (nav) nav.classList.add('active');
            if (id === 'view-analytics') App.Analytics.init();
            if (id === 'view-history') App.History.initFilter();
            if (id === 'view-profile') { App.UI.updateStorageProgress(); App.Profile.renderHistory(); }
        },
        async updateStorageProgress() {
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                const usage = estimate.usage || 0;
                const quota = estimate.quota || 1;
                const percent = Math.min(100, (usage / quota) * 100);
                const el = document.getElementById('storage-usage');
                if(el) el.textContent = `${percent.toFixed(2)}% (${(usage/1024).toFixed(1)} KB)`;
                const pEl = document.getElementById('storage-progress');
                if(pEl) pEl.style.width = `${Math.max(1, percent)}%`;
            }
        },
        fullscreenChart(sourceId) {
            const chart = charts[sourceId];
            if(!chart) return;
            const titleMap = {
                'chart-harian': 'Grafik Pengeluaran',
                'chart-kategori': 'Komposisi Kategori',
                'chart-anomali': 'Sebaran Anomali',
                'chart-prediksi': 'Tren Proyeksi'
            };
            document.getElementById('preview-chart-title').textContent = titleMap[sourceId] || 'Pratinjau Grafik';
            this.openSheet('sheet-chart-preview');
            setTimeout(() => {
                App.Analytics.createChart('chart-preview-canvas', chart.config.type, chart.config.data, Object.assign({}, chart.config.options, { maintainAspectRatio: false }));
            }, 300);
        },
        openSheet(id) {
            document.getElementById('overlay').classList.add('show');
            document.getElementById(id).classList.add('show');
            if (id === 'sheet-add-expense' || id === 'sheet-add-income') {
                const now = new Date();
                const pad = n => n.toString().padStart(2, '0');
                const pre = id === 'sheet-add-expense' ? 'exp' : 'inc';
                const elDate = document.getElementById(`${pre}-date`);
                const elTime = document.getElementById(`${pre}-time`);
                if(elDate) elDate.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                if(elTime) elTime.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
            }
        },
        closeAllSheets() {
            document.getElementById('overlay').classList.remove('show');
            document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('show'));
            document.querySelectorAll('form').forEach(f => {
                if(!f.id.includes('login') && !f.id.includes('profile') && !f.id.includes('create-pin')) f.reset();
            });
        },
        formatMoneyInput(input) {
            let val = input.value.replace(/[^0-9]/g, '');
            input.value = val ? formatRp(val).replace(',00', '') : '';
        },
        toggleTheme() {
            const b = document.body;
            b.classList.toggle('dark-theme'); b.classList.toggle('light-theme');
            const i = document.getElementById('theme-icon');
            i.className = b.classList.contains('dark-theme') ? 'ph-fill ph-sun' : 'ph-fill ph-moon';
            if(document.getElementById('view-analytics').classList.contains('active')) App.Analytics.init();
        },

        async handleProfileUpload(e) {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const base64 = ev.target.result;
                await Data.set('user_avatar', base64);
                this.loadAvatar();
                this.toast('Foto Profil diperbarui!');
            };
            reader.readAsDataURL(file);
        },
        async loadAvatar() {
            const profile = await Data.get('user_profile');
            const avatar = await Data.get('user_avatar');
            const img1 = document.getElementById('header-avatar');
            const img2 = document.getElementById('profile-avatar-large');
            if(!img1 || !img2) return;
            
            if(avatar) {
                img1.src = avatar; img2.src = avatar;
            } else if(profile) {
                const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=4F46E5&color=fff`;
                img1.src = fallback; img2.src = fallback;
            }
        },
        async viewProfilePhotoFullscreen() {
            const avatar = await Data.get('user_avatar');
            const profile = await Data.get('user_profile');
            const imgSrc = avatar || (profile ? `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=4F46E5&color=fff` : '');
            if(imgSrc) {
                document.getElementById('fs-photo-img').src = imgSrc;
                document.getElementById('modal-photo').classList.add('show');
            }
        },
        closeFullscreenPhoto() {
            document.getElementById('modal-photo').classList.remove('show');
        },
        async saveCustomCategory() {
            const input = document.getElementById('new-cat-name');
            const catName = input.value;
            if (catName && catName.trim() !== '') {
                let customCats = await Data.get('custom_categories') || [];
                if (!customCats.includes(catName.trim())) customCats.push(catName.trim());
                await Data.set('custom_categories', customCats);
                await App.Core.renderCategories();
                document.getElementById('exp-category').value = catName.trim();
                input.value = '';
                this.closeAllSheets();
                this.toast('Kategori Berhasil Dibuat');
            }
        },
        async deleteProfilePhoto() {
            await Data.set('user_avatar', null);
            this.loadAvatar();
            this.closeAllSheets();
            this.toast('Foto Profil dihapus!');
        }
    };

    const Transactions = {
        async add(e, type) {
            e.preventDefault();
            const p = type === 'income' ? 'inc' : 'exp';
            const amt = parseRp(document.getElementById(`${p}-amount`).value);
            const note = document.getElementById(`${p}-note`).value;
            const wallet = document.getElementById(`${p}-wallet`).value;
            const cat = type === 'expense' ? document.getElementById('exp-category').value : 'Pemasukan';
            let dVal = document.getElementById(`${p}-date`).value;
            let tVal = document.getElementById(`${p}-time`).value;
            const date = dVal && tVal ? new Date(`${dVal}T${tVal}`).toISOString() : new Date().toISOString();
            if (amt <= 0) return UI.toast('Nominal tidak valid');
            const w = await Data.get('wallets');
            if (type === 'expense') {
                if (w[wallet] < amt) return UI.toast('Saldo dompet tidak cukup!');
                w[wallet] -= amt;
            } else w[wallet] += amt;
            const h = await Data.get('history');
            h.unshift({ id: Date.now(), type, amount:amt, note, wallet, category:cat, date });
            await Data.set('wallets', w); await Data.set('history', h);
            UI.closeAllSheets(); UI.toast('Berhasil dicatat!'); App.Core.refresh();
        },
        async transfer(e) {
            e.preventDefault();
            const amt = parseRp(document.getElementById('trf-amount').value);
            const from = document.getElementById('trf-from').value;
            const to = document.getElementById('trf-to').value;
            if (from === to) return UI.toast('Pilih dompet berbeda');
            if (amt <= 0) return UI.toast('Nominal tidak valid');
            const w = await Data.get('wallets');
            if (w[from] < amt) return UI.toast('Saldo tidak cukup');
            w[from] -= amt; w[to] += amt;
            const h = await Data.get('history');
            h.unshift({ id: Date.now(), type: 'transfer', amount:amt, note: `Mutasi ${from} ke ${to}`, wallet: from, category: 'Transfer', date: new Date().toISOString() });
            await Data.set('wallets', w); await Data.set('history', h);
            UI.closeAllSheets(); UI.toast('Mutasi berhasil'); App.Core.refresh();
        }
    };

    const Goals = {
        async add(e) {
            e.preventDefault();
            const name = document.getElementById('goal-name').value;
            const target = parseRp(document.getElementById('goal-target').value);
            const current = parseRp(document.getElementById('goal-current').value);
            const g = await Data.get('goals');
            g.push({ id: Date.now(), name, target, current });
            await Data.set('goals', g); UI.closeAllSheets(); UI.toast('Target dibuat'); App.Core.refresh();
        },
        async addFunds(e) {
            e.preventDefault();
            const id = parseInt(document.getElementById('goal-fund-id').value);
            const amt = parseRp(document.getElementById('goal-fund-amount').value);
            const wallet = document.getElementById('goal-fund-wallet').value;
            const w = await Data.get('wallets');
            if (w[wallet] < amt) return UI.toast('Saldo dompet kurang!');
            w[wallet] -= amt;
            const g = await Data.get('goals'); const idx = g.findIndex(x => x.id === id);
            if(idx > -1) g[idx].current += amt;
            const h = await Data.get('history');
            h.unshift({ id: Date.now(), type: 'expense', amount:amt, note: `Tabungan: ${g[idx].name}`, wallet, category: 'Tabungan', date: new Date().toISOString() });
            await Data.set('wallets', w); await Data.set('goals', g); await Data.set('history', h);
            UI.closeAllSheets(); UI.toast('Berhasil menabung!'); App.Core.refresh();
        },
        openFundSheet(id) { document.getElementById('goal-fund-id').value = id; UI.openSheet('sheet-add-goal-fund'); },
        async render() {
            const g = await Data.get('goals');
            const el = document.getElementById('goals-list'); if(!el) return;
            el.innerHTML = g.length ? '' : '<p class="text-muted text-sm">Belum ada target tabungan.</p>';
            g.forEach(item => {
                const pct = Math.min(100, (item.current / item.target) * 100);
                el.innerHTML += `<div class="activity-item mb-2" onclick="App.Goals.openFundSheet(${item.id})"><div class="w-100"><div class="flex-between mb-2"><strong>${item.name}</strong><span class="text-sm text-primary font-weight-bold">${Math.round(pct)}%</span></div><div class="progress-bar-bg"><div class="progress-bar-fill bg-secondary" style="width:${pct}%"></div></div><div class="flex-between text-sm text-muted mt-2"><span>Terkumpul: ${formatRp(item.current).replace(',00','')}</span><span>Target: ${formatRp(item.target).replace(',00','')}</span></div></div></div>`;
            });
        }
    };

    const Subs = {
        async add(e) {
            e.preventDefault();
            const s = await Data.get('subs');
            s.push({ id: Date.now(), name: document.getElementById('sub-name').value, amount:parseRp(document.getElementById('sub-amount').value), date:parseInt(document.getElementById('sub-date').value), wallet:document.getElementById('sub-wallet').value, lastPaid: null });
            await Data.set('subs', s); UI.closeAllSheets(); UI.toast('Tagihan disimpan'); App.Core.refresh();
        },
        async checkDues() {
            const s = await Data.get('subs'); let w = await Data.get('wallets'); let h = await Data.get('history');
            const today = new Date(); let changed = false;
            s.forEach(sub => {
                if (today.getDate() >= sub.date) {
                    const currentMonthStr = `${today.getFullYear()}-${today.getMonth()}`;
                    if (sub.lastPaid !== currentMonthStr) {
                        w[sub.wallet] -= sub.amount;
                        h.unshift({ id: Date.now(), type: 'expense', amount:sub.amount, note: `Auto-Bayar: ${sub.name}`, wallet: sub.wallet, category: 'Tagihan', date: new Date().toISOString() });
                        sub.lastPaid = currentMonthStr; changed = true; UI.toast(`Tagihan ${sub.name} terbayar otomatis!`);
                    }
                }
            });
            if(changed) { await Data.set('subs', s); await Data.set('wallets', w); await Data.set('history', h); }
        },
        async render() {
            const s = await Data.get('subs'); const el = document.getElementById('subs-list'); if(!el) return;
            el.innerHTML = s.length ? '' : '<p class="text-muted text-sm">Belum ada tagihan terdaftar.</p>';
            s.forEach(item => {
                el.innerHTML += `<div class="activity-item mb-2"><div class="activity-left"><div class="activity-icon sub"><i class="ph-bold ph-calendar-check"></i></div><div><h4 class="activity-title">${item.name}</h4><span class="activity-date">Tgl ${item.date} • ${item.wallet.toUpperCase()}</span></div></div><div class="activity-amount text-danger">-${formatRp(item.amount).replace(',00','')}</div></div>`;
            });
        }
    };

    const Budget = {
        async save(e) { e.preventDefault(); await Data.set('budget', parseRp(document.getElementById('budget-amount').value)); UI.closeAllSheets(); UI.toast('Batas Anggaran diperbarui'); App.Core.refresh(); },
        async reset() { await Data.set('budget', 0); UI.closeAllSheets(); UI.toast('Anggaran dihapus'); App.Core.refresh(); },
        async refreshUI() {
            const b = await Data.get('budget'); const h = await Data.get('history');
            let exp = 0; h.forEach(t => { if(t.type === 'expense' && new Date(t.date).getMonth() === new Date().getMonth()) exp += t.amount; });
            const info = document.getElementById('budget-info'); const left = document.getElementById('budget-left'); const prog = document.getElementById('budget-progress');
            if (!b) { info.textContent = 'Klik untuk mengatur batas'; left.textContent = 'Belum Diatur'; prog.style.width = '0%'; return; }
            const sisa = b - exp; const pct = Math.min(100, (exp / b) * 100);
            info.textContent = `Dari limit ${formatRp(b).replace(',00','')}`; left.textContent = sisa >= 0 ? formatRp(sisa).replace(',00','') : `Min ${formatRp(Math.abs(sisa)).replace(',00','')}`; left.className = sisa < 0 ? 'text-danger' : 'text-primary';
            prog.style.width = `${pct}%`; prog.className = 'progress-bar-fill ' + (pct >= 90 ? 'bg-danger' : (pct >= 70 ? 'bg-warning' : 'bg-primary'));
        }
    };

    const History = {
        initFilter() {
            const ySel = document.getElementById('history-year'); const mSel = document.getElementById('history-month');
            if(ySel.options.length) return;
            const curr = new Date(); for(let i=0; i<5; i++) ySel.add(new Option(curr.getFullYear()-i, curr.getFullYear()-i));
            ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'].forEach((m, i) => mSel.add(new Option(m, i)));
            mSel.value = curr.getMonth(); this.render();
        },
        async render() {
            const h = await Data.get('history'); const y = parseInt(document.getElementById('history-year').value); const m = parseInt(document.getElementById('history-month').value);
            this.renderList('full-history-list', h.filter(t => new Date(t.date).getFullYear() === y && new Date(t.date).getMonth() === m));
        },
        renderList(id, items, limit=0) {
            const el = document.getElementById(id); if(!el) return;
            el.innerHTML = ''; const list = limit ? items.slice(0, limit) : items;
            if (!list.length) { el.innerHTML = '<p class="text-center text-muted text-sm mt-4">Belum ada transaksi</p>'; return; }
            list.forEach(t => {
                const isInc = t.type === 'income'; const isTrf = t.type === 'transfer';
                const date = new Date(t.date).toLocaleDateString('id-ID', { day:'numeric', month:'short' });
                el.innerHTML += `<li class="activity-item"><div class="activity-left"><div class="activity-icon ${isInc?'income':(isTrf?'wallet':'expense')}"><i class="ph-bold ${isInc?'ph-arrow-down-left':(isTrf?'ph-arrows-left-right':'ph-arrow-up-right')}"></i></div><div style="overflow:hidden"><h4 class="activity-title">${t.note}</h4><span class="activity-date">${date} • ${t.category} • ${t.wallet.toUpperCase()}</span></div></div><div class="activity-amount ${isInc?'text-success':(isTrf?'text-primary':'text-danger')}">${isInc?'+':(isTrf?'':'-')}${formatRp(t.amount).replace(',00','')}</div></li>`;
            });
        }
    };

    const Analytics = {
        init() { this.switchTab('harian'); },
        switchTab(tab) {
            document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.analytics-tab').forEach(t => t.classList.remove('active'));
            if(event) event.target.classList.add('active');
            else document.querySelector('.seg-btn').classList.add('active');
            document.getElementById(`tab-${tab}`).classList.add('active');
            if(tab === 'harian') this.renderDynamicChart('minggu'); 
            if(tab === 'kategori') this.renderKategori();
            if(tab === 'anomali') { this.populateAnomaliFilter(); this.renderAnomali(); }
            if(tab === 'prediksi') this.renderPrediksi();
            if(tab === 'rapor') { this.initRapor(); }
        },
        createChart(id, type, data, options) {
            if(charts[id]) charts[id].destroy();
            const ctx = document.getElementById(id).getContext('2d');
            charts[id] = new Chart(ctx, { type, data, options });
        },
        async renderDynamicChart(period) {
            document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
            if(event) event.target.classList.add('active');
            else document.querySelector(`[onclick="App.Analytics.renderDynamicChart('${period}')"]`).classList.add('active');

            const h = await Data.get('history');
            const exp = h.filter(t => t.type === 'expense');
            const now = new Date();
            let labels = [], data = []; const grouped = {};
            
            if (period === 'hari') {
                document.getElementById('chart-dynamic-title').textContent = 'Arus Kas Hari Ini';
                const todayExp = exp.filter(t => {
                    const d = new Date(t.date);
                    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                });
                for(let i=0; i<=23; i+=4) labels.push(`${i.toString().padStart(2,'0')}:00`);
                labels.forEach(l => grouped[l] = 0);
                todayExp.forEach(t => {
                    const hour = new Date(t.date).getHours();
                    const slot = Math.floor(hour/4)*4;
                    grouped[`${slot.toString().padStart(2,'0')}:00`] += t.amount;
                });
                data = labels.map(l => grouped[l]);

            } else if (period === 'minggu') {
                document.getElementById('chart-dynamic-title').textContent = 'Arus Kas 7 Hari';
                const days = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
                for(let i=6; i>=0; i--) {
                    const d = new Date(); d.setDate(now.getDate() - i);
                    const label = `${days[d.getDay()]} ${d.getDate()}`;
                    labels.push(label);
                    grouped[d.toISOString().split('T')[0]] = 0;
                }
                const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(now.getDate() - 7);
                exp.filter(t => new Date(t.date) > sevenDaysAgo).forEach(t => {
                    const key = new Date(t.date).toISOString().split('T')[0];
                    if(grouped[key] !== undefined) grouped[key] += t.amount;
                });
                data = Object.values(grouped);

            } else if (period === 'bulan') {
                document.getElementById('chart-dynamic-title').textContent = 'Arus Kas Bulan Ini';
                labels = ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4', 'Minggu 5'];
                labels.forEach(l => grouped[l] = 0);
                exp.filter(t => new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear()).forEach(t => {
                    const date = new Date(t.date).getDate();
                    const week = Math.ceil(date/7) - 1;
                    grouped[labels[week]] += t.amount;
                });
                data = labels.map(l => grouped[l]);

            } else if (period === 'tahun') {
                document.getElementById('chart-dynamic-title').textContent = 'Arus Kas Tahun Ini';
                labels = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
                labels.forEach(l => grouped[l] = 0);
                exp.filter(t => new Date(t.date).getFullYear() === now.getFullYear()).forEach(t => {
                    const m = new Date(t.date).getMonth();
                    grouped[labels[m]] += t.amount;
                });
                data = labels.map(l => grouped[l]);
            }

            const total = data.reduce((a,b)=>a+b,0);
            const validData = data.filter(v=>v>0);
            document.getElementById('stat-dyn-total').textContent = formatRp(total).replace(',00','');
            document.getElementById('stat-dyn-avg').textContent = formatRp(total/labels.length).replace(',00','');
            document.getElementById('stat-dyn-max').textContent = formatRp(Math.max(...data, 0)).replace(',00','');
            document.getElementById('stat-dyn-min').textContent = validData.length ? formatRp(Math.min(...validData)).replace(',00','') : 'Rp 0';

            const ctx = document.getElementById('chart-harian').getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 250);
            gradient.addColorStop(0, 'rgba(79, 70, 229, 0.4)');
            gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');

            this.createChart('chart-harian', 'line', {
                labels: labels,
                datasets: [{ 
                    label: 'Pengeluaran', data: data, fill: true,
                    backgroundColor: gradient, borderColor: '#4F46E5', borderWidth: 3, tension: 0.4,
                    pointBackgroundColor: '#FFFFFF', pointBorderColor: '#4F46E5', pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 7,
                    datalabels: {
                        display: function(context) { return context.dataset.data[context.dataIndex] > 0; },
                        align: 'top', anchor: 'end', offset: 4,
                        color: document.body.classList.contains('dark-theme') ? '#F8FAFC' : '#0F172A',
                        font: { weight: 'bold', size: 10 },
                        formatter: function(value) { return formatK(value); }
                    }
                }]
            }, { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 20 } }, plugins: { legend: { display: false } }, scales: { x: { grid: {display:false} }, y: { display: false, beginAtZero: true } } });
        },

        async renderKategori() {
            const exp = (await Data.get('history')).filter(t => t.type === 'expense' && new Date(t.date).getMonth() === new Date().getMonth());
            const cat = {}; exp.forEach(t => { cat[t.category] = (cat[t.category] || 0) + t.amount; });
            const colors = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
            this.createChart('chart-kategori', 'doughnut', {
                labels: Object.keys(cat),
                datasets: [{ data: Object.values(cat), backgroundColor: colors, borderWidth: 0, hoverOffset: 8, datalabels: { display: false } }]
            }, { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: {usePointStyle: true} } } });

            const list = document.getElementById('list-kategori-breakdown'); list.innerHTML = '';
            Object.entries(cat).sort((a,b)=>b[1]-a[1]).forEach(([k,v], i) => {
                list.innerHTML += `<li class="activity-item" style="display:flex; justify-content:space-between; align-items:center; padding: 12px 0;"><div class="activity-left" style="overflow:hidden; flex-grow:1; display:flex; align-items:center; min-width:0;"><div class="activity-icon flex-shrink-0" style="background:${colors[i%colors.length]}20; color:${colors[i%colors.length]};"><i class="ph-bold ph-tag"></i></div><div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:12px;"><h4 class="activity-title" style="margin:0; text-overflow:ellipsis; overflow:hidden;">${k}</h4></div></div><div class="activity-amount text-main flex-shrink-0" style="font-weight:700;">${formatRp(v).replace(',00','')}</div></li>`;
            });
        },
        async populateAnomaliFilter() {
            const h = await Data.get('history');
            const sel = document.getElementById('anomali-filter'); sel.innerHTML = '<option value="semua">Semua Kategori</option>';
            [...new Set(h.filter(t=>t.type === 'expense').map(t=>t.category))].forEach(c => sel.add(new Option(c, c)));
        },
        async renderAnomali() {
            const filter = document.getElementById('anomali-filter').value;
            let allExp = (await Data.get('history')).filter(t => t.type === 'expense');
            const currMonth = new Date().getMonth();
            const currYear = new Date().getFullYear();
            
            let exp = allExp;
            if (filter !== 'semua') exp = exp.filter(t => t.category === filter);
            const currExp = exp.filter(t => new Date(t.date).getMonth() === currMonth && new Date(t.date).getFullYear() === currYear);
            
            if (currExp.length < 3) {
                document.getElementById('anomali-insights').innerHTML = '<p class="text-center text-muted">Data bulan ini belum cukup untuk mendeteksi anomali.</p>';
                if(charts['chart-anomali']) charts['chart-anomali'].destroy(); return;
            }

            // Real Anomaly Logic: Compare against historical average + standard deviation
            const histExp = exp.filter(t => new Date(t.date).getMonth() !== currMonth || new Date(t.date).getFullYear() !== currYear);
            
            let upperLimit = 150000; // Default if no history
            if(histExp.length >= 3) {
                const amounts = histExp.map(t => t.amount).sort((a,b)=>a-b);
                const q1 = amounts[Math.floor(amounts.length * 0.25)];
                const q3 = amounts[Math.floor(amounts.length * 0.75)];
                const iqr = q3 - q1;
                upperLimit = q3 + (iqr === 0 ? q3 * 0.5 : iqr * 1.5);
            } else {
                // If no past history, use current month's IQR
                const amounts = currExp.map(t => t.amount).sort((a,b)=>a-b);
                const q1 = amounts[Math.floor(amounts.length * 0.25)];
                const q3 = amounts[Math.floor(amounts.length * 0.75)];
                const iqr = q3 - q1;
                upperLimit = q3 + (iqr === 0 ? q3 * 0.5 : iqr * 1.5);
                upperLimit = Math.max(upperLimit, 50000); // Minimum threshold
            }

            const norm=[], anom=[];
            let anomHtml = '';
            currExp.forEach(t => {
                const pt = { x: new Date(t.date).getDate(), y: t.amount, note: t.note };
                if (t.amount > upperLimit) {
                    anom.push(pt);
                    anomHtml += `<div class="activity-item mb-2" style="border-left: 4px solid var(--danger);"><div class="activity-left"><div><h4 class="activity-title text-danger">${t.category} Melonjak!</h4><span class="activity-date">${t.note}</span></div></div><div class="activity-amount text-danger">${formatRp(t.amount).replace(',00','')}</div></div>`;
                } else {
                    norm.push(pt);
                }
            });

            if(anom.length > 0) {
                document.getElementById('anomali-insights').innerHTML = `<p class="text-sm mb-3">Batas Wajar Kategori Ini: <strong>${formatRp(upperLimit).replace(',00','')}</strong>. Terdeteksi <strong>${anom.length}</strong> transaksi aneh.</p>${anomHtml}`;
            } else {
                document.getElementById('anomali-insights').innerHTML = `<p class="text-sm text-success text-center mt-4"><i class="ph-fill ph-check-circle text-xl mb-2"></i><br>Pengeluaran terpantau aman dan sesuai kebiasaan.</p>`;
            }
            
            this.createChart('chart-anomali', 'scatter', {
                datasets: [
                    { label: 'Normal', data: norm, backgroundColor: 'rgba(6, 182, 212, 0.4)', pointBorderColor: '#06B6D4', pointRadius: 5, datalabels: {display:false} },
                    { label: 'Anomali', data: anom, backgroundColor: '#EF4444', pointBackgroundColor: '#EF4444', pointBorderColor: '#FFFFFF', pointBorderWidth: 2, pointRadius: 8, pointHoverRadius: 10, pointStyle: 'circle', datalabels: {display:false} }
                ]
            }, { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.raw.note}: ${formatRp(ctx.raw.y)}` } } }, scales: { x: { grid: {display:false} } } });
        },
        async renderPrediksi() {
            const now = new Date();
            const currDate = now.getDate();
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            
            if(document.getElementById('chart-prediksi')) document.getElementById('chart-prediksi').parentElement.style.display = 'block';

            const exp = (await Data.get('history')).filter(t => t.type === 'expense' && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear());
            const budget = await Data.get('budget');
            
            let totalSpent = 0;
            exp.forEach(t => totalSpent += t.amount);
            
            if (currDate < 2) {
                document.getElementById('prediksi-insights').innerHTML = `<div class="info-card flex-row gap-3 mt-2 shadow-sm" style="border-left: 4px solid var(--primary); background: var(--surface)"><div class="icon-circle bg-primary-10 text-primary"><i class="ph-bold ph-info text-2xl"></i></div><div><p class="text-sm font-weight-bold text-primary">Data Belum Cukup</p><p class="text-xs mt-1" style="color:var(--text-main)">Sistem AI membutuhkan setidaknya 2 hari data pengeluaran di bulan berjalan ini untuk memberikan proyeksi yang akurat.</p></div></div>`;
                if(document.getElementById('chart-prediksi')) document.getElementById('chart-prediksi').parentElement.style.display = 'none';
                return;
            }

            if(document.getElementById('chart-prediksi')) document.getElementById('chart-prediksi').parentElement.style.display = 'block';

            const dailyAvg = totalSpent / currDate;
            const remainingDays = lastDay - currDate;
            const projectedSpent = dailyAvg * remainingDays;
            const finalProjection = totalSpent + projectedSpent;
            
            let insightHtml = '';
            let isDanger = false;
            
            if (budget > 0) {
                if (finalProjection > budget) {
                    isDanger = true;
                    insightHtml = `<div class="info-card flex-row gap-3 mt-2 shadow-sm" style="border-left: 4px solid var(--danger); background: var(--surface)"><div class="icon-circle bg-danger-10 text-danger"><i class="ph-bold ph-warning-octagon text-2xl"></i></div><div><p class="text-sm font-weight-bold text-danger">Bahaya Over-budget!</p><p class="text-xs mt-1" style="color:var(--text-main)">Kecepatan jajan: <strong>${formatRp(dailyAvg).replace(',00','')} / hari</strong>. Proyeksi akhir bulan: <strong>${formatRp(finalProjection).replace(',00','')}</strong> (Lebih ${formatRp(finalProjection-budget).replace(',00','')}).<br><br>Saran: Batasi maks <strong>${formatRp(Math.max(0,(budget-totalSpent)/Math.max(1,remainingDays))).replace(',00','')}/hari</strong>.</p></div></div>`;
                } else {
                    insightHtml = `<div class="info-card flex-row gap-3 mt-2 shadow-sm" style="border-left: 4px solid var(--success); background: var(--surface)"><div class="icon-circle bg-success-10 text-success"><i class="ph-bold ph-check-circle text-2xl"></i></div><div><p class="text-sm font-weight-bold text-success">Jalur Aman!</p><p class="text-xs mt-1" style="color:var(--text-main)">Kecepatan jajan terkendali. Akhir bulan diperkirakan sisa: <strong>${formatRp(budget - finalProjection).replace(',00','')}</strong>.</p></div></div>`;
                }
            } else {
                insightHtml = `<div class="info-card flex-row gap-3 mt-2 shadow-sm" style="border-left: 4px solid var(--primary); background: var(--surface)"><div class="icon-circle bg-primary-10 text-primary"><i class="ph-bold ph-trend-up text-2xl"></i></div><div><p class="text-sm font-weight-bold text-primary">Proyeksi Pengeluaran</p><p class="text-xs mt-1" style="color:var(--text-main)">Proyeksi akhir bulanmu: <strong>${formatRp(finalProjection).replace(',00','')}</strong>. Atur batas anggaran di Beranda untuk mendapatkan pengingat cerdas.</p></div></div>`;
            }

            document.getElementById('prediksi-insights').innerHTML = insightHtml;

            // Draw simple projection chart
            const labels = [`Berjalan (Tgl 1-${currDate})`, `Proyeksi (Tgl ${currDate+1}-${lastDay})`];
            const data = [totalSpent, projectedSpent];

            const ctx = document.getElementById('chart-prediksi').getContext('2d');
            this.createChart('chart-prediksi', 'bar', {
                labels: labels,
                datasets: [{ label: 'Nominal', data: data, borderRadius: 8, backgroundColor: ['#4F46E5', isDanger ? '#EF4444' : '#10B981'], datalabels: { display: false } }]
            }, { responsive: true, maintainAspectRatio: false, scales: { x:{grid:{display:false}}, y:{grid:{color:'rgba(0,0,0,0.05)'}} } });
        },
        
        async initRapor() {
            const ySel = document.getElementById('rapor-year'); const mSel = document.getElementById('rapor-month');
            if(ySel.options.length === 0) {
                const curr = new Date(); for(let i=0; i<5; i++) ySel.add(new Option(curr.getFullYear()-i, curr.getFullYear()-i));
                ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'].forEach((m, i) => mSel.add(new Option(m, i)));
                mSel.value = curr.getMonth(); 
            }
            this.renderRapor();
        },
        
        async renderRapor() {
            const y = parseInt(document.getElementById('rapor-year').value); 
            const m = parseInt(document.getElementById('rapor-month').value);
            const h = await Data.get('history');
            const budget = await Data.get('budget');
            
            const currExpList = h.filter(t => new Date(t.date).getFullYear() === y && new Date(t.date).getMonth() === m && t.type === 'expense');
            const prevM = m === 0 ? 11 : m - 1;
            const prevY = m === 0 ? y - 1 : y;
            const prevExpList = h.filter(t => new Date(t.date).getFullYear() === prevY && new Date(t.date).getMonth() === prevM && t.type === 'expense');

            if(currExpList.length === 0) {
                document.getElementById('rapor-content').innerHTML = '<div class="text-center p-4 text-muted"><i class="ph-fill ph-empty text-xl mb-2"></i><br>Belum ada data untuk bulan ini.</div>';
                return;
            }

            let currTotal = 0; currExpList.forEach(t => currTotal += t.amount);
            let prevTotal = 0; prevExpList.forEach(t => prevTotal += t.amount);

            // 1. Status Verdict (Card 1)
            let verdictHtml = '';
            if(budget > 0) {
                const pct = Math.round((currTotal / budget) * 100);
                if(currTotal > budget) verdictHtml = `<div class="rapor-verdict danger pulse-anim"><div class="text-xs font-weight-bold mb-1" style="color:inherit">STATUS ANGGARAN</div>OVER BUDGET<br><span class="text-sm font-weight-normal mt-1 d-block">Terlewat ${formatRp(currTotal - budget).replace(',00','')} 😱 (Realisasi: ${pct}%)</span></div>`;
                else verdictHtml = `<div class="rapor-verdict safe pop-in"><div class="text-xs font-weight-bold mb-1" style="color:inherit">STATUS ANGGARAN</div>ON TARGET<br><span class="text-sm font-weight-normal mt-1 d-block">Tersisa ${formatRp(budget - currTotal).replace(',00','')} 🥳 (Realisasi: ${pct}%)</span></div>`;
            } else {
                verdictHtml = `<div class="rapor-verdict safe" style="color:var(--primary); background:var(--primary-10)"><div class="text-xs font-weight-bold mb-1" style="color:inherit">TOTAL PENGELUARAN</div><span>${formatRp(currTotal).replace(',00','')}</span></div>`;
            }

            // 2. MoM Shift (Bulan vs Bulan)
            let momHtml = '';
            if(prevTotal > 0) {
                const diff = currTotal - prevTotal;
                const pct = Math.abs(Math.round((diff / prevTotal) * 100));
                if(diff > 0) momHtml = `<div class="rapor-insight card-slide-up" style="animation-delay: 0.1s;"><div class="icon-circle bg-danger-10 text-danger"><i class="ph-bold ph-trend-up"></i></div><div class="rapor-insight-text"><p>Pengeluaranmu <strong>naik ${pct}%</strong> dari bulan lalu. Hati-hati inflasi gaya hidup ya!</p></div></div>`;
                else momHtml = `<div class="rapor-insight card-slide-up" style="animation-delay: 0.1s;"><div class="icon-circle bg-success-10 text-success"><i class="ph-bold ph-trend-down"></i></div><div class="rapor-insight-text"><p>Keren! Pengeluaranmu <strong>turun ${pct}%</strong> dari bulan lalu. Pertahankan prestasimu!</p></div></div>`;
            }

            // 3. Bocor Halus (Small Transactions)
            let bocorCount = 0; let bocorTotal = 0;
            currExpList.forEach(t => { if(t.amount <= 25000) { bocorCount++; bocorTotal += t.amount; } });
            let bocorHtml = '';
            if(bocorCount >= 3) {
                bocorHtml = `<div class="rapor-insight card-slide-up" style="animation-delay: 0.2s;"><div class="icon-circle bg-warning-10 text-warning"><i class="ph-bold ph-drop"></i></div><div class="rapor-insight-text"><p><strong>Waspada Bocor Halus!</strong> Ada ${bocorCount} jajan kecil (≤ 25rb) yang nilainya mencapai <strong>${formatRp(bocorTotal).replace(',00','')}</strong>.</p></div></div>`;
            } else {
                bocorHtml = `<div class="rapor-insight card-slide-up" style="animation-delay: 0.2s;"><div class="icon-circle bg-primary-10 text-primary"><i class="ph-bold ph-shield-check"></i></div><div class="rapor-insight-text"><p>Kamu cukup kebal dari <strong>bocor halus</strong> bulan ini. Pengeluaran recehmu terkontrol dengan baik!</p></div></div>`;
            }

            // 4. Danger Day
            const dayTotals = {0:0,1:0,2:0,3:0,4:0,5:0,6:0};
            currExpList.forEach(t => { dayTotals[new Date(t.date).getDay()] += t.amount; });
            let dangerDay = 0; let maxDayAmt = 0;
            for(let d in dayTotals) { if(dayTotals[d] > maxDayAmt) { maxDayAmt = dayTotals[d]; dangerDay = d; } }
            const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
            const dangerHtml = `<div class="rapor-insight card-slide-up" style="animation-delay: 0.3s;"><div class="icon-circle bg-danger-10 text-danger"><i class="ph-bold ph-calendar-x"></i></div><div class="rapor-insight-text"><p>Kamu paling banyak menghamburkan uang di hari <strong>${dayNames[dangerDay]}</strong>, total menembus <strong>${formatRp(maxDayAmt).replace(',00','')}</strong>.</p></div></div>`;
            
            // 5. Top Category
            const catMap = {};
            currExpList.forEach(t => { catMap[t.category] = (catMap[t.category]||0) + t.amount; });
            let topCat = ''; let maxCat = 0;
            for(let c in catMap) { if(catMap[c] > maxCat) { maxCat = catMap[c]; topCat = c; } }
            let catHtml = '';
            if(topCat) catHtml = `<div class="rapor-insight card-slide-up" style="animation-delay: 0.4s;"><div class="icon-circle bg-primary-10 text-primary"><i class="ph-bold ph-crown"></i></div><div class="rapor-insight-text"><p>Juara pengeluaran bulan ini adalah <strong>${topCat}</strong>, menghabiskan dana sebesar <strong>${formatRp(maxCat).replace(',00','')}</strong>.</p></div></div>`;

            // Compile
            document.getElementById('rapor-content').innerHTML = `
                <div class="rapor-card p-4 rounded-xl border border-light" style="background: linear-gradient(145deg, #ffffff, #f9fbfd); box-shadow: 0 10px 30px rgba(0,0,0,0.05); overflow: hidden;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h2 style="font-weight: 800; font-size: 1.5rem; background: linear-gradient(90deg, var(--primary), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Ringkasan Spesialmu</h2>
                        <p class="text-sm text-muted mt-1">Edisi ${document.getElementById('rapor-month').options[m].text} ${y}</p>
                    </div>
                    ${verdictHtml}
                    <div class="mt-4">
                        ${momHtml}
                        ${catHtml}
                        ${dangerHtml}
                        ${bocorHtml}
                    </div>
                </div>
            `;
        }
    };

    const Export = {
        async exportPDF(e) {
            e.preventDefault(); const { jsPDF } = window.jspdf; const doc = new jsPDF();
            const y = parseInt(document.getElementById('pdf-year').value); const m = parseInt(document.getElementById('pdf-month').value);
            const filtered = (await Data.get('history')).filter(t => new Date(t.date).getFullYear() === y && new Date(t.date).getMonth() === m && t.type === 'expense').reverse();
            doc.setFontSize(18); doc.text('Laporan Mumy Finance', 14, 20); doc.setFontSize(10);
            doc.text(`Periode: ${document.getElementById('pdf-month').options[m].text} ${y}`, 14, 30);
            doc.autoTable({ startY: 40, head: [['No', 'Tanggal', 'Keterangan', 'Kategori', 'Nominal']], body: filtered.map((t, i) => [i+1, new Date(t.date).toLocaleDateString(), t.note, t.category, formatRp(t.amount).replace(',00','')]), headStyles: { fillColor: [79, 70, 229] } });
            doc.save(`Mumy_Laporan_${y}_${m+1}.pdf`); UI.closeAllSheets(); UI.toast('PDF Diunduh!');
        },
        async exportExcel() {
            const data = (await Data.get('history')).map(t => ({ Tanggal: new Date(t.date).toLocaleString(), Tipe: t.type, Kategori: t.category, Keterangan: t.note, Dompet: t.wallet, Nominal: t.amount }));
            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Data");
            XLSX.writeFile(wb, `Mumy_Dataset_${Date.now()}.xlsx`); UI.toast('Excel Diunduh!');
        }
    };



    const Core = {
        async renderCategories() {
            const select = document.getElementById('exp-category');
            if(!select) return;
            const customCats = await Data.get('custom_categories') || [];
            const defaultCats = Object.keys(ML.keywords);
            let html = '';
            defaultCats.forEach(cat => { html += `<option value="${cat}">${cat}</option>`; });
            customCats.forEach(cat => { html += `<option value="${cat}">${cat}</option>`; });
            html += `<option value="new_category" class="text-primary font-weight-bold">+ Buat Kategori Baru...</option>`;
            select.innerHTML = html;
        },
        async init() {
            await Data.init();
            await UI.loadAvatar();
            await Auth.check();
            await Subs.checkDues();
            await this.renderCategories();
            
            const expCat = document.getElementById('exp-category');
            if(expCat) {
                expCat.addEventListener('change', async (e) => {
                    if (e.target.value === 'new_category') {
                        e.target.value = 'Lainnya'; // Temp revert
                        App.UI.openSheet('sheet-custom-category');
                    }
                });
            }
            const curr = new Date(); const ys=document.getElementById('pdf-year'), ms=document.getElementById('pdf-month');
            for(let i=0; i<5; i++) ys.add(new Option(curr.getFullYear()-i, curr.getFullYear()-i));
            ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'].forEach((m, i) => ms.add(new Option(m, i)));
            ms.value = curr.getMonth();
        },
        async refresh() {
            const w = await Data.get('wallets'); const total = w.tunai + w.bank;
            document.getElementById('home-total-balance').textContent = formatRp(total).replace(',00','');
            const tunaiEl = document.getElementById('home-tunai-balance');
            const bankEl = document.getElementById('home-bank-balance');
            if(tunaiEl) tunaiEl.textContent = formatRp(w.tunai).replace(',00','');
            if(bankEl) bankEl.textContent = formatRp(w.bank).replace(',00','');
            
            const ratioTunai = total > 0 ? (w.tunai / total) * 100 : 0;
            const wProg = document.getElementById('wallet-progress-tunai');
            if(wProg) { wProg.style.width = `${ratioTunai}%`; document.getElementById('wallet-ratio-tunai').textContent = `${Math.round(ratioTunai)}%`; }
            
            History.renderList('home-activity-list', await Data.get('history'), 4);
            Budget.refreshUI(); Goals.render(); Subs.render();
        }
    };

    const Profile = {
        async initHistoryFilter() {
            const yEl = document.getElementById('profile-hist-year');
            const mEl = document.getElementById('profile-hist-month');
            if(!yEl || yEl.options.length > 0) return;
            const now = new Date();
            for(let i=0; i<5; i++) yEl.add(new Option(now.getFullYear()-i, now.getFullYear()-i));
            ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'].forEach((m,i)=>mEl.add(new Option(m,i)));
            mEl.value = now.getMonth();
        },
        async renderHistory() {
            this.initHistoryFilter();
            const y = parseInt(document.getElementById('profile-hist-year').value);
            const m = parseInt(document.getElementById('profile-hist-month').value);
            const h = await Data.get('history');
            const exp = h.filter(t => t.type === 'expense' && new Date(t.date).getFullYear() === y && new Date(t.date).getMonth() === m);
            
            const wrapper = document.getElementById('profile-hist-wrapper');
            const summary = document.getElementById('profile-hist-summary');
            
            if(exp.length === 0) {
                wrapper.style.display = 'none';
                summary.innerHTML = '<p class="text-center text-muted">Belum ada data di bulan ini.</p>';
                return;
            }
            
            wrapper.style.display = 'block';
            let total = 0; const catMap = {};
            exp.forEach(t => {
                total += t.amount;
                catMap[t.category] = (catMap[t.category]||0) + t.amount;
            });
            
            const labels = Object.keys(catMap);
            const data = Object.values(catMap);
            const bg = ['#4F46E5','#06B6D4','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899'];
            
            App.Analytics.createChart('chart-profile-hist', 'doughnut', {
                labels, datasets: [{ data, backgroundColor: bg, borderWidth: 0, hoverOffset: 4 }]
            }, {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } }, datalabels: { display: false } }
            });
            
            let avg = total / exp.length;
            let maxAmt = Math.max(...data);
            let minAmt = Math.min(...data);
            summary.innerHTML = `
                <div class="stats-grid mt-2">
                    <div class="stat-box" style="padding: 12px 8px;"><p style="font-size: 0.7rem">Total</p><h5 class="text-danger" style="font-size: 0.9rem">${formatRp(total).replace(',00','')}</h5></div>
                    <div class="stat-box" style="padding: 12px 8px;"><p style="font-size: 0.7rem">Rata-rata</p><h5 style="font-size: 0.9rem">${formatRp(avg).replace(',00','')}</h5></div>
                    <div class="stat-box" style="padding: 12px 8px;"><p style="font-size: 0.7rem">Tertinggi</p><h5 style="font-size: 0.9rem">${formatRp(maxAmt).replace(',00','')}</h5></div>
                    <div class="stat-box" style="padding: 12px 8px;"><p style="font-size: 0.7rem">Terendah</p><h5 style="font-size: 0.9rem">${formatRp(minAmt).replace(',00','')}</h5></div>
                </div>
            `;
        }
    };

    return { init: () => Core.init(), UI, Data, Auth, Story, Transactions, Budget, History, Analytics, Export, Goals, Subs, ML, Core, Profile };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
