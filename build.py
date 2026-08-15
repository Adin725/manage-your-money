import re
import os

with open('script.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. SPLASH SCREEN
# Replace the timeout switchScreen
js = re.sub(
    r"setTimeout\(\(\) => \{ UI\.switchScreen\('screen-app'\); \}, 2000\);",
    """if(localStorage.getItem('welcome_done')) {
                        document.getElementById('screen-welcome').classList.remove('active');
                        document.getElementById('screen-app').classList.add('active');
                    } else {
                        setTimeout(() => { UI.switchScreen('screen-app'); localStorage.setItem('welcome_done', 'true'); }, 2000);
                    }""",
    js
)

# 2. AUDIO & ANIMATION IN UI
ui_inject = """
        playTing() {
            try {
                const snd = new Audio("data:audio/mpeg;base64,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");
                snd.volume = 0.5;
                snd.play().catch(e=>console.log(e));
            } catch(e) {}
        },
        showSendingMoneyAnimation(text, cb) {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; transition: opacity 0.3s;';
            overlay.innerHTML = `<div style="font-size: 80px; animation: bounce 1s infinite;"><i class="ph-fill ph-money"></i></div><h2 class="mt-4" style="font-family:'Plus Jakarta Sans'; font-weight:700; color:#fff; text-align:center;">${text}</h2>`;
            document.body.appendChild(overlay);
            
            if(!document.getElementById('bounce-anim')) {
                const style = document.createElement('style');
                style.id = 'bounce-anim';
                style.innerHTML = `@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }`;
                document.head.appendChild(style);
            }

            setTimeout(() => {
                overlay.style.opacity = '0';
                setTimeout(() => { document.body.removeChild(overlay); cb(); }, 300);
            }, 1200);
        },
"""
js = js.replace('        toast(msg) {', ui_inject + '\n        toast(msg) {')

# 3. TRANSACTIONS
js = re.sub(r"UI\.toast\('Pengeluaran berhasil dicatat'\);", "UI.playTing(); UI.toast('Pengeluaran berhasil dicatat');", js)

js = js.replace("UI.toast('Pemasukan berhasil dicatat');", 
                "UI.showSendingMoneyAnimation('Memproses Pemasukan...', () => { UI.playTing(); UI.toast('Pemasukan berhasil dicatat'); });")

js = js.replace("UI.toast('Mutasi berhasil!');", 
                "UI.showSendingMoneyAnimation('Mengirim Uang...', () => { UI.playTing(); UI.toast('Mutasi berhasil!'); });")


# 4. KATEGORI DONUT TOOLTIP AND REMOVE LIST
# Find renderKategori
js = js.replace("return ` ${ctx.label}: Rp ${ctx.raw.toLocaleString('id-ID')}`;",
                "const total = ctx.chart._metasets[ctx.datasetIndex].total; const pct = Math.round((ctx.raw / total) * 100); return ` ${ctx.label}: Rp ${ctx.raw.toLocaleString('id-ID')} (${pct}%)`;")

# Remove the category list logic in renderKategori
js = re.sub(
    r"let catHtml = '';.*?listEl\.innerHTML = catHtml;",
    "listEl.innerHTML = '';",
    js, flags=re.DOTALL
)

# 5. PROFILE HISTORY (Donut Tooltip + Daily Line Chart)
js = js.replace("""charts.profileHist = new Chart(canvas, {""", """charts.profileHist = new Chart(canvas, {""")

# We need to inject the line chart in renderHistory
hist_injection = """
            if(charts.profileHist) charts.profileHist.destroy();
            charts.profileHist = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(catData),
                    datasets: [{ data: Object.values(catData), backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'], borderWidth:0 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '75%',
                    plugins: {
                        legend: { position: 'right', labels: { color: '#94A3B8', boxWidth: 12, font: {size: 11} } },
                        tooltip: {
                            callbacks: {
                                label: function(ctx) {
                                    const val = ctx.raw;
                                    const total = ctx.chart._metasets[ctx.datasetIndex].total;
                                    const pct = Math.round((val / total) * 100);
                                    return ` ${ctx.label}: Rp ${val.toLocaleString('id-ID')} (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });

            const dailyCanvas = document.getElementById('chart-profile-hist-daily');
            const dailyWrapper = document.getElementById('profile-hist-daily-wrapper');
            if(dailyCanvas && dailyWrapper) {
                dailyWrapper.style.display = 'block';
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const dailyLabels = Array.from({length: daysInMonth}, (_, i) => i + 1);
                const dailyData = Array(daysInMonth).fill(0);
                
                filtered.forEach(t => {
                    if(t.type === 'expense') {
                        const day = new Date(t.date).getDate();
                        dailyData[day - 1] += t.amount;
                    }
                });

                if(charts.profileHistDaily) charts.profileHistDaily.destroy();
                charts.profileHistDaily = new Chart(dailyCanvas, {
                    type: 'line',
                    data: {
                        labels: dailyLabels,
                        datasets: [{
                            label: 'Pengeluaran Harian',
                            data: dailyData,
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            pointRadius: 0,
                            pointHitRadius: 10
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
                            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: function(v) { return 'Rp ' + formatK(v); } } }
                        }
                    }
                });
            }
"""

js = re.sub(
    r"if\(charts\.profileHist\) charts\.profileHist\.destroy\(\);.*?\}\);",
    hist_injection,
    js, flags=re.DOTALL
)

# 6. EXPORT PDF AND EXCEL
export_logic = """
    const Export = {
        async exportPDF(e) {
            e.preventDefault();
            const month = parseInt(document.getElementById('pdf-month').value);
            const year = parseInt(document.getElementById('pdf-year').value);
            const title = document.getElementById('pdf-title').value;
            const saldoAwal = parseInt(document.getElementById('pdf-saldo').value) || 0;
            
            const hList = await Data.get('history');
            const data = hList.filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === month && d.getFullYear() === year;
            });
            let totalInc = 0, totalExp = 0;
            const rows = data.map(t => {
                if(t.type==='income') totalInc += t.amount; else totalExp += t.amount;
                return `<tr><td>${new Date(t.date).toLocaleDateString('id-ID')}</td><td>${t.type==='income'?'Masuk':'Keluar'}</td><td>${t.category}</td><td>${t.note}</td><td>${formatRp(t.amount)}</td></tr>`;
            }).join('');
            
            const saldoAkhir = saldoAwal + totalInc - totalExp;
            
            const printWin = window.open('', '', 'width=800,height=900');
            printWin.document.write(`
                <html><head><title>${title}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #111827; }
                    h1 { color: #4f46e5; text-align: center; margin-bottom: 5px; }
                    .period { text-align: center; color: #6b7280; margin-bottom: 30px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                    th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
                    th { background: #f3f4f6; color: #374151; }
                    .summary { display: flex; justify-content: space-between; margin-top: 30px; font-weight: bold; background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
                    .summary div { text-align: center; }
                    .summary span { display: block; font-size: 12px; color: #6b7280; font-weight: normal; margin-bottom: 4px; }
                    .watermark { text-align: center; margin-top: 60px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                </style>
                </head><body>
                    <h1>${title}</h1>
                    <div class="period">Periode: Bulan ${month + 1} Tahun ${year}</div>
                    <div class="summary">
                        <div><span>Saldo Awal</span> ${formatRp(saldoAwal)}</div>
                        <div><span>Total Masuk</span> <span style="color:#10b981; font-weight:bold; font-size:16px; margin:0;">+${formatRp(totalInc)}</span></div>
                        <div><span>Total Keluar</span> <span style="color:#ef4444; font-weight:bold; font-size:16px; margin:0;">-${formatRp(totalExp)}</span></div>
                        <div><span>Saldo Akhir</span> ${formatRp(saldoAkhir)}</div>
                    </div>
                    <table>
                        <thead><tr><th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Keterangan</th><th>Nominal</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="watermark">Manage Your Money<br>Dikembangkan oleh Rijaluddin Abdul Ghani<br>&copy; 2026 Hak Cipta Dilindungi.</div>
                </body></html>
            `);
            printWin.document.close();
            printWin.focus();
            setTimeout(() => { printWin.print(); printWin.close(); }, 500);
            App.UI.closeAllSheets();
            App.UI.toast('Membuka PDF...');
        },
        async exportExcel() {
            const data = (await Data.get('history')).map(t => ({ Tanggal: new Date(t.date).toLocaleString('id-ID'), Tipe: t.type, Kategori: t.category, Keterangan: t.note, Dompet: t.wallet, Nominal: t.amount }));
            
            const csvRows = [];
            const headers = Object.keys(data[0] || { Tanggal:'', Tipe:'', Kategori:'', Keterangan:'', Dompet:'', Nominal:'' });
            csvRows.push(headers.join(','));
            
            for (const row of data) {
                const values = headers.map(header => {
                    const escaped = (''+row[header]).replace(/"/g, '""');
                    return `"${escaped}"`;
                });
                csvRows.push(values.join(','));
            }
            
            const csvContent = "data:text/csv;charset=utf-8," + "\\uFEFF" + csvRows.join('\\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Laporan_ManageYourMoney_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            App.UI.closeAllSheets();
            App.UI.toast('Excel (CSV) Diunduh!');
        }
    };
"""

js = re.sub(
    r"const Export = \{.*?\n    \};\n",
    lambda m: export_logic + "\n",
    js, flags=re.DOTALL
)

# 7. WALLET INSIGHTS (Mahasiswa Style vertically stacked)
wallet_logic = """
            const hList = await Data.get('history');
            const now = new Date();
            let tunaiSpentThisMonth = 0;
            hList.forEach(t => {
                if(t.type === 'expense' && t.wallet === 'tunai' && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear()) {
                    tunaiSpentThisMonth += t.amount;
                }
            });
            const tunaiTotalAwal = w.tunai + tunaiSpentThisMonth;
            const tunaiPct = tunaiTotalAwal > 0 ? (tunaiSpentThisMonth / tunaiTotalAwal) * 100 : 0;

            const currDate = now.getDate();
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const remainingDays = Math.max(1, lastDay - currDate + 1);
            const safeDaily = Math.floor(total / remainingDays);

            const insightContainer = document.getElementById('wallet-insights');
            if(insightContainer) {
                insightContainer.innerHTML = `
                    <div class="mt-2 shadow-sm" style="border-left: 4px solid var(--success); background: var(--surface); padding: 16px; border-radius: 12px; margin-bottom: 12px;">
                        <p class="text-sm font-weight-bold text-success mb-3"><i class="ph-bold ph-wallet mr-1"></i> Laporan Dompet Fisik</p>
                        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom: 12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span class="text-xs text-muted">Total Awal Bulan</span>
                                <span class="text-sm font-weight-bold">${formatRp(tunaiTotalAwal).replace(',00','')}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span class="text-xs text-muted">Terpakai (${Math.round(tunaiPct)}%)</span>
                                <span class="text-sm font-weight-bold text-danger">- ${formatRp(tunaiSpentThisMonth).replace(',00','')}</span>
                            </div>
                        </div>
                        <div class="progress-bar-bg w-100 mb-3"><div class="progress-bar-fill ${tunaiPct > 80 ? 'bg-danger' : 'bg-success'}" style="width: ${tunaiPct}%"></div></div>
                        <div style="display:flex; justify-content:space-between; align-items:center; padding-top: 12px; border-top: 1px dashed var(--border);">
                            <span class="text-xs font-weight-bold">Sisa di Dompet</span>
                            <span class="text-sm font-weight-bold text-success">${formatRp(w.tunai).replace(',00','')}</span>
                        </div>
                    </div>
                    
                    <div class="shadow-sm" style="border-left: 4px solid var(--primary); background: var(--surface); padding: 16px; border-radius: 12px;">
                        <p class="text-sm font-weight-bold text-primary mb-2"><i class="ph-bold ph-pizza mr-1"></i> Batas Aman Jajan</p>
                        <div style="display:flex; flex-direction:column; gap: 4px;">
                            <h2 class="text-primary mb-0" style="font-size: 1.8rem; margin:0;">${formatRp(safeDaily).replace(',00','')}</h2>
                            <span class="text-xs text-muted">Maksimal per hari hingga akhir bulan.</span>
                        </div>
                    </div>
                `;
            }
"""
js = re.sub(
    r"const ratioTunai = total > 0 \? \(w\.tunai \/ total\) \* 100 : 0;.*?document\.getElementById\('wallet-ratio-tunai'\)\.textContent = `\$\{Math\.round\(ratioTunai\)\}%`; \}",
    wallet_logic,
    js, flags=re.DOTALL
)

# 8. BUDGET PERCENTAGE BADGE
budget_logic = """
            const pctBadge = document.getElementById('budget-percentage');
            if (!b) { 
                info.textContent = 'Klik untuk mengatur batas'; left.textContent = 'Belum Diatur'; prog.style.width = '0%'; 
                if(pctBadge) pctBadge.style.display = 'none';
                return; 
            }
            const sisa = b - exp; const pct = Math.min(100, (exp / b) * 100);
            info.textContent = `Dari limit ${formatRp(b).replace(',00','')}`; left.textContent = sisa >= 0 ? formatRp(sisa).replace(',00','') : `Min ${formatRp(Math.abs(sisa)).replace(',00','')}`; left.className = sisa < 0 ? 'text-danger' : 'text-primary';
            prog.style.width = `${pct}%`; prog.className = 'progress-bar-fill ' + (pct >= 90 ? 'bg-danger' : (pct >= 70 ? 'bg-warning' : 'bg-primary'));
            if(pctBadge) {
                pctBadge.style.display = 'inline-block';
                pctBadge.textContent = `Terpakai ${Math.round(pct)}%`;
                pctBadge.style.background = pct >= 90 ? 'var(--danger-10)' : (pct >= 70 ? 'var(--warning-10)' : 'var(--primary-10)');
                pctBadge.style.color = pct >= 90 ? 'var(--danger)' : (pct >= 70 ? 'var(--warning)' : 'var(--primary)');
            }
"""
js = re.sub(
    r"if \(!b\) \{ info\.textContent = 'Klik untuk mengatur batas'; left\.textContent = 'Belum Diatur'; prog\.style\.width = '0%'; return; \}.*?prog\.style\.width = `\$\{pct\}%`; prog\.className = 'progress-bar-fill ' \+ \(pct >= 90 \? 'bg-danger' : \(pct >= 70 \? 'bg-warning' : 'bg-primary'\)\);",
    budget_logic,
    js, flags=re.DOTALL
)


with open('script.js', 'w', encoding='utf-8') as f:
    f.write(js)
