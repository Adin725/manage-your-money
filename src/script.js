const App = (() => {
    const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
    const parseRp = (str) => parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
    const formatK = (num) => num >= 1000 ? (num/1000).toFixed(num%1000 !== 0 ? 1 : 0) + 'k' : num;
    
    let db, charts = {};
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.color = '#94A3B8';
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
            Swal.fire({
                title: 'Reset Semua Data?',
                text: "Aksi ini akan menghapus permanen seluruh data transaksi, dompet, dan pengaturan. Anda akan diminta mendaftar ulang. Apakah Anda yakin?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#EF4444',
                cancelButtonColor: '#64748B',
                confirmButtonText: 'Ya, Hapus Permanen',
                cancelButtonText: 'Batal',
                background: document.body.classList.contains('dark-theme') ? '#1E293B' : '#FFFFFF',
                color: document.body.classList.contains('dark-theme') ? '#F8FAFC' : '#1E293B'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await db.clear(); await this.init();
                    localStorage.removeItem('story_last_shown');
                    Swal.fire({ title: 'Berhasil!', text: 'Semua data telah direset.', icon: 'success', timer: 1500, showConfirmButton: false }).then(() => window.location.reload());
                }
            });
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
                password: document.getElementById('reg-password').value 
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
            const today = new Date().toISOString().split('T')[0];
            const lastShown = localStorage.getItem('story_last_shown');
            
            if (lastShown === today) {
                document.getElementById('screen-register-profile').classList.remove('active');
                document.getElementById('screen-register-pin').classList.remove('active');
                document.getElementById('screen-login').classList.remove('active');     
                Auth.navTo('screen-app');
                return;
            }
            
            localStorage.setItem('story_last_shown', today);

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
        playTing() {
            try {
                // Using a valid CDN URL for a professional UI success chime
                const a = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3");
                a.volume = 0.6; 
                a.play().catch(e=>console.log('Audio autoplay prevented or failed:', e));
            } catch(err){}
        },

        showSuccessSwal(title) {
            this.playTing();
            Swal.fire({
                title: title,
                icon: 'success',
                showConfirmButton: false,
                timer: 1500,
                backdrop: `rgba(0,0,0,0.4)`,
                customClass: { popup: 'rounded-xl' }
            });
        },
        showSendingMoneyAnimation() {
            // Disabled in favor of SweetAlert2
        },
        switchView(id) {
            document.querySelectorAll('.view, .nav-item').forEach(el => el.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            const nav = document.querySelector(`[data-target="${id}"]`);
            if (nav) nav.classList.add('active');
            if (id === 'view-analytics') App.Analytics.init();
            if (id === 'view-history') App.History.initFilter();
        },
        openSheet(id) {
            document.getElementById('overlay').classList.add('show');
            document.getElementById(id).classList.add('show');
            
            if (id === 'sheet-add-expense' || id === 'sheet-add-income') {
                const now = new Date();
                const d = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
                const t = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
                if(id === 'sheet-add-expense') { 
                    const dEl = document.getElementById('exp-date'); if(dEl && !dEl.value) dEl.value = d; 
                    const tEl = document.getElementById('exp-time'); if(tEl && !tEl.value) tEl.value = t; 
                }
                if(id === 'sheet-add-income') { 
                    const dEl = document.getElementById('inc-date'); if(dEl && !dEl.value) dEl.value = d; 
                    const tEl = document.getElementById('inc-time'); if(tEl && !tEl.value) tEl.value = t; 
                }
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
        fullscreenChart(id) {
            const modal = document.getElementById('modal-chart');
            modal.classList.add('show');
            if (charts['fs']) charts['fs'].destroy();
            const orig = charts[id];
            if (!orig) return;
            
            const newData = {
                labels: orig.data.labels ? [...orig.data.labels] : [],
                datasets: orig.data.datasets.map(ds => {
                    let newDs = Object.assign({}, ds);
                    if(Array.isArray(ds.data)) newDs.data = [...ds.data];
                    if(Array.isArray(ds.backgroundColor)) newDs.backgroundColor = [...ds.backgroundColor];
                    delete newDs._meta; // Safely remove Chart.js internal bindings
                    return newDs;
                })
            };
            
            charts['fs'] = new Chart(document.getElementById('fs-chart-canvas'), {
                type: orig.config.type,
                data: newData,
                options: Object.assign({}, orig.config.options, { maintainAspectRatio: false, responsive: true })
            });
        },
        closeFullscreenChart() {
            document.getElementById('modal-chart').classList.remove('show');
            if (charts['fs']) { charts['fs'].destroy(); delete charts['fs']; }
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
            UI.closeAllSheets(); 
            UI.showSuccessSwal('Berhasil dicatat!'); 
            App.Core.refresh();
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
            UI.closeAllSheets(); 
            UI.showSuccessSwal('Mutasi berhasil!'); 
            App.Core.refresh();
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
            const pctText = document.getElementById('budget-pct');
            if (!b) { info.textContent = 'Klik untuk mengatur batas'; left.textContent = 'Belum Diatur'; prog.style.width = '0%'; if(pctText) pctText.style.display='none'; return; }
            const sisa = b - exp; const pct = Math.min(100, (exp / b) * 100);
            info.textContent = `Dari limit ${formatRp(b).replace(',00','')}`; 
            left.textContent = sisa >= 0 ? formatRp(sisa).replace(',00','') : `Min ${formatRp(Math.abs(sisa)).replace(',00','')}`; 
            left.className = sisa < 0 ? 'text-danger' : 'text-primary';
            if(pctText) {
                pctText.style.display = 'inline-block';
                pctText.textContent = `${Math.round((exp / b) * 100)}% Terpakai`;
                pctText.style.color = (pct >= 90) ? 'var(--danger)' : ((pct >= 70) ? 'var(--warning)' : 'var(--success)');
                pctText.style.background = (pct >= 90) ? 'rgba(239, 68, 68, 0.1)' : ((pct >= 70) ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)');
            }
            prog.style.width = `${pct}%`; prog.className = 'progress-bar-fill ' + (pct >= 90 ? 'bg-danger' : (pct >= 70 ? 'bg-warning' : 'bg-primary'));
        }
    };

    const History = {
        async initFilter() {
            const h = await Data.get('history');
            const ySel = document.getElementById('history-year'); const mSel = document.getElementById('history-month');
            if(ySel.options.length) return;
            
            let uniqueYears = [...new Set(h.map(t => new Date(t.date).getFullYear()))].sort((a,b)=>b-a);
            let uniqueMonths = [...new Set(h.map(t => new Date(t.date).getMonth()))].sort((a,b)=>a-b);
            
            if (uniqueYears.length === 0) uniqueYears = [new Date().getFullYear()];
            if (uniqueMonths.length === 0) uniqueMonths = [new Date().getMonth()];
            
            uniqueYears.forEach(y => ySel.add(new Option(y, y)));
            const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
            uniqueMonths.forEach(m => mSel.add(new Option(monthNames[m], m)));
            
            const curr = new Date();
            if(uniqueYears.includes(curr.getFullYear())) ySel.value = curr.getFullYear();
            if(uniqueMonths.includes(curr.getMonth())) mSel.value = curr.getMonth();
            this.render();
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

            let periodText = '';
            if(period === 'hari') periodText = 'Jam';
            else if(period === 'minggu') periodText = 'Harian';
            else if(period === 'bulan') periodText = 'Mingguan';
            else if(period === 'tahun') periodText = 'Bulanan';
            
            const total = data.reduce((a,b)=>a+b,0);
            const validData = data.filter(v=>v>0);
            document.getElementById('stat-dyn-total').textContent = formatRp(total).replace(',00','');
            document.getElementById('stat-dyn-avg').textContent = formatRp(total/labels.length).replace(',00','');
            
            const maxLabel = document.getElementById('label-dyn-max');
            const minLabel = document.getElementById('label-dyn-min');
            if (maxLabel) maxLabel.textContent = `Tertinggi ${periodText}`;
            if (minLabel) minLabel.textContent = `Terendah ${periodText}`;
            
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
            const totalExp = exp.reduce((a, b) => a + b.amount, 0);
            const colors = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
            this.createChart('chart-kategori', 'doughnut', {
                labels: Object.keys(cat),
                datasets: [{ data: Object.values(cat), backgroundColor: colors, borderWidth: 0, hoverOffset: 8, datalabels: { display: false } }]
            }, { 
                responsive: true, maintainAspectRatio: false, cutout: '75%', 
                onClick: (e, elements) => {
                    if (elements && elements.length > 0) {
                        const idx = elements[0].index;
                        const categoryName = Object.keys(cat)[idx];
                        const items = exp.filter(t => t.category === categoryName);
                        const pct = ((cat[categoryName] / totalExp) * 100).toFixed(1);
                        let html = `<div style="text-align:left; max-height: 50vh; overflow-y: auto; padding: 10px;">
                                      <p class="text-sm text-muted mb-3">Total ${items.length} transaksi (${pct}% dari pengeluaran).</p>`;
                        items.forEach(t => {
                            const d = new Date(t.date).toLocaleDateString('id-ID', {day:'numeric', month:'short'});
                            html += `<div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:12px; align-items:center;">
                                        <div><strong style="color:var(--text-main); font-size:1rem;">${t.note}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">${d}</span></div>
                                        <div style="font-weight:700; color:var(--text-main); font-size:1.05rem;">${formatRp(t.amount).replace(',00','')}</div>
                                     </div>`;
                        });
                        html += `</div>`;
                        Swal.fire({
                            title: categoryName,
                            html: html,
                            background: document.body.classList.contains('dark-theme') ? '#1E293B' : '#FFFFFF',
                            color: document.body.classList.contains('dark-theme') ? '#F8FAFC' : '#1E293B',
                            showCloseButton: true,
                            showConfirmButton: false
                        });
                    }
                },
                plugins: { 
                    legend: { position: 'right', labels: {usePointStyle: true, color: document.body.classList.contains('dark-theme') ? '#F8FAFC' : '#64748B'} },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let value = context.raw || 0;
                                let percentage = totalExp > 0 ? ((value / totalExp) * 100).toFixed(1) + '%' : '0%';
                                return ` ${context.label}: ${formatRp(value).replace(',00', '')} (${percentage})`;
                            }
                        }
                    }
                } 
            });

            const breakdownHtml = `
            <details class="modern-details mt-4">
                <summary class="text-adaptive-primary" style="font-weight: 600;">Lihat Detail Kategori</summary>
                <div class="mt-2">
                    ${Object.keys(cat).sort((a,b) => cat[b] - cat[a]).map(k => `
                        <div class="activity-item mb-2" style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; background: var(--surface);">
                            <div class="activity-left">
                                <div class="activity-icon category-icon" style="border-radius: 12px;"><i class="ph-bold ph-tag"></i></div>
                                <div><h4 class="activity-title text-adaptive-primary" style="margin-bottom:2px; font-size: 1.05rem; font-weight: 700;">${k}</h4><span class="activity-date">${((cat[k]/totalExp)*100).toFixed(1)}% dari total</span></div>
                            </div>
                            <div class="activity-amount" style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">${formatRp(cat[k]).replace(',00', '')}</div>
                        </div>
                    `).join('')}
                </div>
            </details>`;
            document.getElementById('list-kategori-breakdown').innerHTML = breakdownHtml;
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

            // Real Anomaly Logic: Compare against historical + current month mixed
            let upperLimit = 50000;
            if(exp.length >= 5) {
                const amounts = exp.map(t => t.amount).sort((a,b)=>a-b);
                // Proper percentile interpolation
                const getPercentile = (arr, p) => {
                    const idx = (arr.length - 1) * p; const lower = Math.floor(idx); const frac = idx - lower;
                    if(lower >= arr.length - 1) return arr[lower];
                    return arr[lower] + frac * (arr[lower+1] - arr[lower]);
                };
                const q1 = getPercentile(amounts, 0.25);
                const q3 = getPercentile(amounts, 0.75);
                const iqr = q3 - q1;
                upperLimit = Math.max(q3 + (1.5 * iqr), 50000);
            } else if(currExp.length >= 3) {
                // Fallback to mean + 1.5 * stddev
                const mean = currExp.reduce((a,b)=>a+b.amount,0) / currExp.length;
                const variance = currExp.reduce((a,b)=>a+Math.pow(b.amount-mean,2),0) / currExp.length;
                upperLimit = Math.max(mean + (1.5 * Math.sqrt(variance)), mean * 2.5, 50000);
            }

            const norm=[], anom=[];
            let anomHtml = '';
            currExp.forEach(t => {
                const pt = { x: new Date(t.date).getDate(), y: t.amount, note: t.note };
                if (t.amount > upperLimit) {
                    anom.push(pt);
                    anomHtml += `<div class="insight-card-modern" style="border: 1px solid var(--primary); padding: 16px; border-radius: var(--radius-md); box-shadow: none; background: var(--surface); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;"><div class="insight-text-modern"><strong class="text-adaptive-primary" style="font-size:1rem; display: block; margin-bottom: 4px;">${t.category} Melonjak!</strong><span class="text-muted text-sm">${t.note}</span></div><div class="text-danger font-weight-bold ml-auto" style="font-size:1.1rem;">${formatRp(t.amount).replace(',00','')}</div></div>`;
                } else {
                    norm.push(pt);
                }
            });

            if(anom.length > 0) {
                document.getElementById('anomali-insights').innerHTML = `<div class="text-sm mb-4" style="color: var(--text-main);">Batas Wajar Kategori Ini: <strong>${formatRp(upperLimit).replace(',00','')}</strong>. Terdeteksi <strong>${anom.length}</strong> transaksi aneh.</div><details class="modern-details"><summary class="text-adaptive-primary" style="font-weight: 600;">Lihat Detail Transaksi Aneh</summary><div class="mt-2">${anomHtml}</div></details>`;
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
            
            if (currDate <= 1) {
                document.getElementById('prediksi-insights').innerHTML = `<div class="flex-center flex-column text-center p-4"><i class="ph-fill ph-calendar text-xl text-primary mb-2"></i><p class="text-sm">Silakan catat pengeluaran hari ini terlebih dahulu untuk memulai perhitungan prediksi.</p></div>`;
                if(charts['chart-prediksi']) {
                    document.getElementById('chart-prediksi').parentElement.style.display = 'none';
                }
                return;
            }
            
            if(document.getElementById('chart-prediksi')) document.getElementById('chart-prediksi').parentElement.style.display = 'block';

            const exp = (await Data.get('history')).filter(t => t.type === 'expense' && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear());
            const budget = await Data.get('budget');
            
            let totalSpent = 0;
            exp.forEach(t => totalSpent += t.amount);
            
            // Weighted moving average for daily rate (last 7 days have more weight)
            let recentSum = 0; let recentWeight = 0;
            for(let i=0; i<currDate; i++) {
                const dayExp = exp.filter(t => new Date(t.date).getDate() === (i+1)).reduce((a,b)=>a+b.amount,0);
                const weight = i >= currDate - 7 ? 2 : 1;
                recentSum += dayExp * weight;
                recentWeight += weight;
            }
            
            const dailyAvg = recentSum / recentWeight;
            const remainingDays = lastDay - currDate;
            const projectedSpent = dailyAvg * remainingDays;
            const finalProjection = totalSpent + projectedSpent;
            
            let insightHtml = '';
            let isDanger = false;

            if (budget > 0) {
                if (finalProjection > budget) {
                    isDanger = true;
                    insightHtml = `
                    <div class="insight-card-modern" style="position: relative; overflow: hidden; border: 1px solid var(--border-color); background: var(--surface); align-items: flex-start; padding: 24px; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column;">
                        <div class="circle circle-1 floating-slow" style="position: absolute; top: -80px; right: -50px; width: 180px; height: 180px;"></div>
                        <div class="circle circle-2 floating-fast" style="position: absolute; bottom: -40px; left: -40px; width: 120px; height: 120px;"></div>
                        
                        <div style="z-index: 1; display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 16px;">
                            <span style="font-size: 1rem; opacity: 0.9; color: var(--text-main);">Peringatan</span>
                            <i class="ph-fill ph-warning" style="font-size: 1.5rem; color: var(--danger);"></i>
                        </div>
                        <h2 class="text-danger" style="z-index: 1; font-size: 1.8rem; font-weight: 800; margin-bottom: 16px; text-transform: uppercase;">OVERBUDGET!</h2>
                        <p style="z-index: 1; font-size: 0.95rem; color: var(--text-main); line-height: 1.6; margin-bottom: 24px;">Kecepatan jajanmu <strong class="text-danger">${formatRp(dailyAvg).replace(',00','')} / hari</strong>. Di akhir bulan kamu akan tembus <strong class="text-danger">${formatRp(finalProjection).replace(',00','')}</strong>.</p>
                        <div style="z-index: 1; background: #0F172A; padding: 12px 16px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; width: 100%; color: #FFFFFF;"><span class="text-danger">Saran:</span> Batasi maks ${formatRp((budget-totalSpent)/remainingDays).replace('Rp','').replace(',00','')}/hari mulai besok.</div>
                    </div>`;
                } else {
                    insightHtml = `
                    <div class="insight-card-modern" style="position: relative; overflow: hidden; border: 1px solid var(--border-color); background: var(--surface); align-items: flex-start; padding: 24px; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column;">
                        <div class="circle circle-1 floating-slow" style="position: absolute; top: -80px; right: -50px; width: 180px; height: 180px;"></div>
                        <div class="circle circle-2 floating-fast" style="position: absolute; bottom: -40px; left: -40px; width: 120px; height: 120px;"></div>
                        
                        <div style="z-index: 1; display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 16px;">
                            <span style="font-size: 1rem; opacity: 0.9; color: var(--text-main);">Sistem Analisis</span>
                            <i class="ph-fill ph-robot" style="font-size: 1.5rem; color: var(--success);"></i>
                        </div>
                        <h2 class="text-success" style="z-index: 1; font-size: 1.8rem; font-weight: 800; margin-bottom: 12px; text-transform: uppercase;">JALUR AMAN</h2>
                        <p style="z-index: 1; font-size: 0.95rem; color: var(--text-main); line-height: 1.6;">Kecepatan jajan terkendali. Sisa prediksi <strong class="text-success">Rp ${formatRp(budget - finalProjection).replace('Rp','').replace(',00','')}</strong></p>
                    </div>`;
                }
            } else {
                insightHtml = `
                <div class="insight-card-modern" style="border: 1px solid var(--primary); background: var(--surface); align-items: flex-start; padding: 20px; box-shadow: none; border-radius: var(--radius-md);">
                    <div class="insight-icon-modern" style="color:var(--primary); background:rgba(59, 130, 246, 0.1); width: 44px; height: 44px; font-size: 1.5rem; border-radius: 50%;"><i class="ph-bold ph-info"></i></div>
                    <div class="insight-text-modern" style="color: var(--text-main);">
                        <p class="opacity-90 text-sm mb-0" style="line-height: 1.6;">Proyeksi pengeluaran akhir bulanmu mencapai <strong class="text-primary">${formatRp(finalProjection).replace(',00','')}</strong>. Atur batas anggaran di Beranda untuk mendapatkan peringatan cerdas.</p>
                    </div>
                </div>`;
            }

            document.getElementById('prediksi-insights').innerHTML = insightHtml;
            document.getElementById('prediksi-insights').className = `mt-4 rounded-lg`;
            document.getElementById('prediksi-insights').style.backgroundColor = 'transparent';
            document.getElementById('prediksi-insights').style.border = 'none';
            document.getElementById('prediksi-insights').style.padding = '0';

            // Draw simple projection chart
            const labels = ['Selesai (Tgl 1-'+currDate+')', 'Proyeksi (Tgl '+(currDate+1)+'-'+lastDay+')'];
            const data = [totalSpent, projectedSpent];

            const ctx = document.getElementById('chart-prediksi').getContext('2d');
            this.createChart('chart-prediksi', 'bar', {
                labels: labels,
                datasets: [{ label: 'Nominal', data: data, borderRadius: 8, backgroundColor: ['#4F46E5', isDanger ? '#EF4444' : '#10B981'], datalabels: { display: false } }]
            }, { responsive: true, maintainAspectRatio: false, scales: { x:{grid:{display:false}}, y:{grid:{color:'rgba(0,0,0,0.05)'}} } });
        },
        
        async initRapor() {
            const h = await Data.get('history');
            const ySel = document.getElementById('rapor-year'); const mSel = document.getElementById('rapor-month');
            if(ySel.options.length === 0) {
                let uniqueYears = [...new Set(h.map(t => new Date(t.date).getFullYear()))].sort((a,b)=>b-a);
                let uniqueMonths = [...new Set(h.map(t => new Date(t.date).getMonth()))].sort((a,b)=>a-b);
                
                if (uniqueYears.length === 0) uniqueYears = [new Date().getFullYear()];
                if (uniqueMonths.length === 0) uniqueMonths = [new Date().getMonth()];
                
                uniqueYears.forEach(y => ySel.add(new Option(y, y)));
                const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
                uniqueMonths.forEach(m => mSel.add(new Option(monthNames[m], m)));
                
                const curr = new Date();
                if(uniqueYears.includes(curr.getFullYear())) ySel.value = curr.getFullYear();
                if(uniqueMonths.includes(curr.getMonth())) mSel.value = curr.getMonth();
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

            // 1. Status Verdict
            let verdictHtml = '';
            if(budget > 0) {
                if(currTotal > budget) verdictHtml = `<div class="rapor-verdict danger">OVER BUDGET<br><span class="text-sm font-weight-normal">Lebih ${formatRp(currTotal - budget).replace(',00','')}</span></div>`;
                else verdictHtml = `<div class="rapor-verdict safe">ON TARGET<br><span class="text-sm font-weight-normal">Sisa ${formatRp(budget - currTotal).replace(',00','')}</span></div>`;
            } else {
                verdictHtml = `<div class="rapor-verdict safe" style="color:var(--primary); background:var(--bg-color)">TOTAL PENGELUARAN<br><span>${formatRp(currTotal).replace(',00','')}</span></div>`;
            }

            // 2. MoM Shift (Bulan vs Bulan)
            let momHtml = '';
            if(prevTotal > 0) {
                const diff = currTotal - prevTotal;
                const pct = Math.abs(Math.round((diff / prevTotal) * 100));
                if(diff > 0) momHtml = `<div class="insight-card-modern"><div class="insight-icon-modern" style="color:var(--primary); background:rgba(59, 130, 246, 0.1);"><i class="ph-bold ph-trend-up"></i></div><div class="insight-text-modern">Pengeluaranmu <strong>Naik ${pct}%</strong> dibanding bulan lalu. Hati-hati inflasi gaya hidup!</div></div>`;
                else momHtml = `<div class="insight-card-modern"><div class="insight-icon-modern" style="color:var(--primary); background:rgba(59, 130, 246, 0.1);"><i class="ph-bold ph-trend-down"></i></div><div class="insight-text-modern">Hebat! Pengeluaranmu <strong>Turun ${pct}%</strong> dibanding bulan lalu.</div></div>`;
            }

            // 3. Bocor Halus (Small Transactions)
            let bocorCount = 0; let bocorTotal = 0;
            currExpList.forEach(t => { if(t.amount <= 20000) { bocorCount++; bocorTotal += t.amount; } });
            let bocorHtml = '';
            if(bocorCount >= 5) {
                bocorHtml = `<div class="insight-card-modern"><div class="insight-icon-modern" style="color:var(--primary); background:rgba(59, 130, 246, 0.1);"><i class="ph-bold ph-drop"></i></div><div class="insight-text-modern"><strong>Bocor Halus:</strong> Ada ${bocorCount} transaksi kecil (≤ Rp 20rb) yang kalau ditotal mencapai <strong style="color:var(--primary)">${formatRp(bocorTotal).replace(',00','')}</strong>.</div></div>`;
            } else {
                bocorHtml = `<div class="insight-card-modern"><div class="insight-icon-modern" style="color:var(--primary); background:rgba(59, 130, 246, 0.1);"><i class="ph-bold ph-shield-check"></i></div><div class="insight-text-modern">Kamu cukup kebal dari <strong style="color:var(--primary)">bocor halus</strong> bulan ini. Pengeluaran recehmu terkontrol dengan baik!</div></div>`;
            }

            // 4. Danger Day
            const dayTotals = {0:0,1:0,2:0,3:0,4:0,5:0,6:0};
            currExpList.forEach(t => { dayTotals[new Date(t.date).getDay()] += t.amount; });
            let dangerDay = 0; let maxDayAmt = 0;
            for(let d in dayTotals) { if(dayTotals[d] > maxDayAmt) { maxDayAmt = dayTotals[d]; dangerDay = d; } }
            const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
            const dangerHtml = `<div class="insight-card-modern"><div class="insight-icon-modern" style="color:var(--primary); background:rgba(59, 130, 246, 0.1);"><i class="ph-bold ph-calendar-x"></i></div><div class="insight-text-modern">Kamu paling banyak menghamburkan uang di hari <strong style="color:var(--primary)">${dayNames[dangerDay]}</strong>, total menembus <strong style="color:var(--primary)">${formatRp(maxDayAmt).replace(',00','')}</strong>.</div></div>`;

            // 5. Kategori Juara
            let catTotals = {};
            currExpList.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
            let maxCat = ''; let maxCatAmt = 0;
            for(let c in catTotals) { if(catTotals[c] > maxCatAmt) { maxCatAmt = catTotals[c]; maxCat = c; } }
            const juaraHtml = maxCatAmt > 0 ? `<div class="insight-card-modern"><div class="insight-icon-modern" style="color:var(--primary); background:rgba(59, 130, 246, 0.1);"><i class="ph-bold ph-crown"></i></div><div class="insight-text-modern">Juara pengeluaran bulan ini adalah <strong style="color:var(--primary)">${maxCat}</strong>, menghabiskan dana sebesar <strong style="color:var(--primary)">${formatRp(maxCatAmt).replace(',00','')}</strong>.</div></div>` : '';

            // Compile
            const pctCapai = budget > 0 ? Math.round((currTotal / budget) * 100) : 0;
            const balanceTitle = budget > 0 ? (currTotal > budget ? 'OVER BUDGET' : pctCapai + '% TERCAPAI') : 'TOTAL PENGELUARAN';
            
            document.getElementById('rapor-content').innerHTML = `
                <div class="balance-card mb-4 mt-2" style="background: linear-gradient(135deg, var(--primary), var(--secondary)); border-radius: var(--radius-lg); padding: 24px;">
                    <div class="card-top">
                        <span class="card-label text-white opacity-75">Sistem Analisis</span>
                        <i class="ph-fill ph-robot text-white"></i>
                    </div>
                    <h2 class="card-balance text-white mt-2" style="font-size:2rem;">${balanceTitle}</h2>
                    <div class="card-bottom mt-2">
                        <div class="card-number text-white opacity-75">${budget > 0 ? (currTotal > budget ? 'Lebih ' + formatRp(currTotal - budget).replace(',00','') : 'Sisa ' + formatRp(budget - currTotal).replace(',00','')) : formatRp(currTotal).replace(',00','')}</div>
                    </div>
                    <div class="circle circle-1 floating-slow"></div>
                    <div class="circle circle-2 floating-fast"></div>
                </div>
                
                ${juaraHtml}
                ${dangerHtml}
                ${bocorHtml}
                ${momHtml}
            `;
        }
    };

    const Profile = {
        async renderHistory() {
            const mSel = document.getElementById('profile-hist-month');
            const ySel = document.getElementById('profile-hist-year');
            const curr = new Date();
            
            if(ySel.options.length === 0) {
                for(let i=0; i<5; i++) ySel.add(new Option(curr.getFullYear()-i, curr.getFullYear()-i));
                ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'].forEach((m, i) => mSel.add(new Option(m, i)));
                mSel.value = curr.getMonth(); 
            }
            
            const m = parseInt(mSel.value);
            const y = parseInt(ySel.value);
            const exp = (await Data.get('history')).filter(t => t.type === 'expense' && new Date(t.date).getMonth() === m && new Date(t.date).getFullYear() === y);
            
            if (exp.length === 0) {
                document.getElementById('profile-hist-donut-wrapper').style.display = 'none';
                document.getElementById('profile-hist-daily-wrapper').style.display = 'none';
                document.getElementById('profile-hist-summary').innerHTML = '<div class="text-center p-4 text-muted"><i class="ph-fill ph-empty text-xl mb-2"></i><br>Tidak ada transaksi.</div>';
                return;
            }

            document.getElementById('profile-hist-donut-wrapper').style.display = 'block';
            document.getElementById('profile-hist-daily-wrapper').style.display = 'block';

            const cat = {}; exp.forEach(t => { cat[t.category] = (cat[t.category] || 0) + t.amount; });
            const totalExp = exp.reduce((a, b) => a + b.amount, 0);
            const colors = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
            
            Analytics.createChart('chart-profile-hist', 'doughnut', {
                labels: Object.keys(cat),
                datasets: [{ data: Object.values(cat), backgroundColor: colors, borderWidth: 0, hoverOffset: 4, datalabels: { display: false } }]
            }, { 
                responsive: true, maintainAspectRatio: false, cutout: '70%', 
                plugins: { 
                    legend: { position: 'right', labels: {usePointStyle: true, color: document.body.classList.contains('dark-theme') ? '#F8FAFC' : '#64748B', font: {size: 10}} },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let val = context.raw || 0;
                                let pct = totalExp > 0 ? ((val / totalExp) * 100).toFixed(1) + '%' : '0%';
                                return ` ${context.label}: ${formatRp(val).replace(',00', '')} (${pct})`;
                            }
                        }
                    }
                } 
            });

            // Calc stats
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const dailyAvg = totalExp / daysInMonth;
            
            // Daily array
            const data = new Array(daysInMonth).fill(0);
            exp.forEach(t => { data[new Date(t.date).getDate() - 1] += t.amount; });
            
            const highest = Math.max(...data);
            const lowestVal = data.some(d => d > 0) ? Math.min(...data.filter(d => d > 0)) : 0;

            const summaryHtml = `
            <div class="grid-2 mt-4 mb-4" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="stat-box" style="background: var(--surface); border: 1px solid var(--border-color); padding: 16px; border-radius: var(--radius-md); box-shadow: none;">
                    <div class="text-xs text-muted mb-1">Total Pengeluaran</div>
                    <div class="text-danger font-weight-bold" style="font-size: 1.1rem;">${formatRp(totalExp).replace(',00','')}</div>
                </div>
                <div class="stat-box" style="background: var(--surface); border: 1px solid var(--border-color); padding: 16px; border-radius: var(--radius-md); box-shadow: none;">
                    <div class="text-xs text-muted mb-1">Rata-rata Harian</div>
                    <div class="text-primary font-weight-bold" style="font-size: 1.1rem;">${formatRp(dailyAvg).replace(',00','')}</div>
                </div>
                <div class="stat-box" style="background: var(--surface); border: 1px solid var(--border-color); padding: 16px; border-radius: var(--radius-md); box-shadow: none;">
                    <div class="text-xs text-muted mb-1">Harian Tertinggi</div>
                    <div class="text-main font-weight-bold" style="font-size: 1.1rem;">${formatRp(highest).replace(',00','')}</div>
                </div>
                <div class="stat-box" style="background: var(--surface); border: 1px solid var(--border-color); padding: 16px; border-radius: var(--radius-md); box-shadow: none;">
                    <div class="text-xs text-muted mb-1">Harian Terendah</div>
                    <div class="text-success font-weight-bold" style="font-size: 1.1rem;">${formatRp(lowestVal).replace(',00','')}</div>
                </div>
            </div>`;
            
            document.getElementById('profile-hist-summary').innerHTML = summaryHtml;

            // Daily Line Chart
            const labels = Array.from({length: daysInMonth}, (_, i) => i + 1);
            
            const ctx = document.getElementById('chart-profile-hist-daily').getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 180);
            gradient.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
            gradient.addColorStop(1, 'rgba(6, 182, 212, 0)');

            Analytics.createChart('chart-profile-hist-daily', 'line', {
                labels: labels,
                datasets: [{ 
                    label: 'Harian', data: data, fill: true,
                    backgroundColor: gradient, borderColor: '#06B6D4', borderWidth: 2, tension: 0.3,
                    pointBackgroundColor: '#FFFFFF', pointBorderColor: '#06B6D4', pointRadius: 2, datalabels: { display: false }
                }]
            }, { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: {display:false}, ticks: {font:{size:9}} }, y: { display: false, beginAtZero: true } } });
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
            
            // Refined Asset Calculation (consider upcoming subs)
            const subs = await Data.get('subs') || [];
            const today = new Date();
            const remainingSubs = subs.filter(s => s.date > today.getDate() && s.lastPaid !== `${today.getFullYear()}-${today.getMonth()}`).reduce((a,b)=>a+b.amount, 0);
            const safeTotal = total - remainingSubs;

            // Flip Card Updates
            const bB = document.getElementById('home-bank-balance'); if(bB) bB.textContent = formatRp(w.bank).replace(',00','');
            const cB = document.getElementById('home-cash-balance'); if(cB) cB.textContent = formatRp(w.tunai).replace(',00','');

            // Detailed Wallet Cards Updates (Dompet Fisik & Batas Aman Jajan)
            const wtTotal = document.getElementById('w-tunai-total');
            if(wtTotal) {
                const h = await Data.get('history') || [];
                const expTunai = h.filter(t => t.type === 'expense' && t.wallet === 'tunai' && new Date(t.date).getMonth() === today.getMonth()).reduce((a,b)=>a+b.amount, 0);
                const initialTunai = w.tunai + expTunai;
                
                wtTotal.textContent = formatRp(initialTunai).replace(',00','');
                document.getElementById('w-tunai-spent').textContent = '- ' + formatRp(expTunai).replace(',00','');
                document.getElementById('w-tunai-left').textContent = formatRp(w.tunai).replace(',00','');
                
                const pct = initialTunai > 0 ? Math.round((expTunai / initialTunai) * 100) : 0;
                document.getElementById('w-tunai-pct').textContent = pct;
                document.getElementById('w-tunai-bar').style.width = pct + '%';

                const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                const daysLeft = daysInMonth - today.getDate() + 1;
                const safeDaily = safeTotal > 0 ? safeTotal / daysLeft : 0;
                document.getElementById('w-safe-daily').textContent = formatRp(Math.floor(safeDaily)).replace(',00','');
            }
            History.renderList('home-activity-list', await Data.get('history'), 4);
            Budget.refreshUI(); Goals.render(); Subs.render();
        }
    };

    return { init: () => Core.init(), UI, Data, Auth, Story, Transactions, Budget, History, Analytics, Export, Goals, Subs, ML, Core, Profile };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
