class HtmlConverter {
    constructor(t) {
        this.supportedFormats = ["html", "htm"];
        this.maxFileSize = 10485760;
        this.jsPDF = t;
    }

    async convertToPdf(t) {
        return new Promise((e, i) => {
            if (!this.isValidFile(t)) {
                return void i(new Error("Ungültiges Dateiformat oder Dateigröße"));
            }

            const n = new FileReader;
            n.onload = async t => {
                try {
                    const n = document.createElement("iframe");
                    n.style.position = "absolute";
                    n.style.left = "-9999px";
                    n.style.width = "1200px";
                    document.body.appendChild(n);

                    const s = n.contentWindow.document;
                    s.open();
                    s.write(`<!DOCTYPE html>
                        <html>
                            <head>
                                <meta charset="utf-8">
                                <meta name="viewport" content="width=device-width,initial-scale=1">
                                <style>
                                    body {
                                        margin: 0;
                                        padding: 20px;
                                        font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
                                        line-height: 1.5;
                                        color: #000;
                                        background: #fff;
                                        max-width: 1200px;
                                        margin: 0 auto
                                    }
                                    * {
                                        box-sizing: border-box
                                    }
                                    img,svg {
                                        max-width: 100%;
                                        height: auto
                                    }
                                    table {
                                        width: 100%;
                                        border-collapse: collapse
                                    }
                                    td,th {
                                        padding: 8px;
                                        border: 1px solid #ddd
                                    }
                                    pre,code {
                                        white-space: pre-wrap
                                    }
                                </style>
                            </head>
                            <body>${t.target.result}</body>
                        </html>`);
                    s.close();

                    await new Promise(t => setTimeout(t, 1e3));
                    await Promise.all([
                        new Promise(t => {
                            "complete" === s.readyState ? t() : n.onload = t
                        }),
                        ...Array.from(s.images).map(t => new Promise(e => {
                            t.complete ? e() : (t.onload = e, t.onerror = e)
                        })),
                        s.fonts?.ready || Promise.resolve()
                    ]);

                    const a = s.body;
                    const o = a.scrollWidth;
                    const r = a.scrollHeight;
                    const d = await html2canvas(a, {
                        scale: 2,
                        useCORS: !0,
                        allowTaint: !0,
                        logging: !1,
                        width: o,
                        height: r,
                        windowWidth: o,
                        windowHeight: r,
                        backgroundColor: "#ffffff",
                        onclone: t => {
                            const e = t.createElement("style");
                            e.textContent = "*{-webkit-font-smoothing:antialiased!important;text-rendering:optimizeLegibility!important}img{image-rendering:-webkit-optimize-contrast!important}";
                            t.head.appendChild(e);
                        }
                    });

                    const l = 595.28;
                    const h = 841.89;
                    const c = l/h;
                    const m = o/r;
                    let g, w;

                    if (m > c) {
                        g = Math.min(o, 1200);
                        w = g/m;
                    } else {
                        w = Math.min(r, 1700);
                        g = w*m;
                    }

                    const p = new this.jsPDF({
                        orientation: m > 1 ? "landscape" : "portrait",
                        unit: "pt",
                        format: [g, w],
                        hotfixes: ["px_scaling"]
                    });

                    p.addImage(d.toDataURL("image/jpeg", 1), "JPEG", 0, 0, g, w, void 0, "FAST");
                    document.body.removeChild(n);
                    e(p);
                } catch(t) {
                    i(new Error(`HTML-Konvertierungsfehler: ${t.message}`));
                }
            };
            n.onerror = () => i(new Error("Fehler beim Lesen der HTML-Datei"));
            n.readAsText(t);
        });
    }

    isValidFile(t) {
        const e = t.name.split(".").pop().toLowerCase();
        return this.supportedFormats.includes(e) && t.size <= this.maxFileSize;
    }

    download(filename, blob) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;

        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            link.target = '_self';
            link.rel = 'noopener noreferrer';
        }

        link.click();
        URL.revokeObjectURL(link.href);
    }
}

export { HtmlConverter };