class ImageConverter {
    constructor(e) {
        this.supportedFormats = ["jpg", "jpeg", "png"];
        this.maxFileSize = 10485760;
        this.jsPDF = e;
    }

    async convertToPdf(e) {
        return new Promise((t, s) => {
            if (!this.isValidFile(e)) {
                return void s(new Error("Ungültiges Dateiformat oder Dateigröße"));
            }
            const i = e.name.split(".").pop().toLowerCase();
            switch (i) {
                case "png":
                    this.convertPngToPdf(e, t, s);
                    break;
                case "jpg":
                case "jpeg":
                    this.convertJpgToPdf(e, t, s);
                    break;
                default:
                    s(new Error("Nicht unterstütztes Dateiformat"));
            }
        });
    }

    async convertPngToPdf(e, t, s) {
        const i = new FileReader;
        i.onload = async e => {
            try {
                const i = new Image;
                i.src = e.target.result;
                await new Promise((e, t) => {
                    i.onload = e;
                    i.onerror = () => t(new Error("Fehler beim Laden des PNG-Bildes"));
                });
                const r = document.createElement("canvas");
                r.width = i.width;
                r.height = i.height;
                const a = r.getContext("2d");
                a.fillStyle = "#FFFFFF";
                a.fillRect(0, 0, r.width, r.height);
                a.drawImage(i, 0, 0);
                const n = r.toDataURL("image/png");
                const o = this.createPdfWithImage(i, n, "PNG");
                t(o);
            } catch (e) {
                s(new Error(`PNG-Konvertierungsfehler: ${e.message}`));
            }
        };
        i.onerror = () => s(new Error("Fehler beim Lesen der PNG-Datei"));
        i.readAsDataURL(e);
    }

    async convertJpgToPdf(e, t, s) {
        const i = new FileReader;
        i.onload = async e => {
            try {
                const i = new Image;
                i.src = e.target.result;
                await new Promise((e, t) => {
                    i.onload = e;
                    i.onerror = () => t(new Error("Fehler beim Laden des JPEG-Bildes"));
                });
                const r = this.createPdfWithImage(i, e.target.result, "JPEG");
                t(r);
            } catch (e) {
                s(new Error(`JPEG-Konvertierungsfehler: ${e.message}`));
            }
        };
        i.onerror = () => s(new Error("Fehler beim Lesen der JPEG-Datei"));
        i.readAsDataURL(e);
    }

    createPdfWithImage(e, t, s) {
        const i = 210;
        const r = 297;
        const a = 10;
        const n = i - 2 * a;
        const o = r - 2 * a;
        const h = e.width / e.height;
        const d = n / o;
        let l, g;
        
        if (h > d) {
            l = n;
            g = n / h;
        } else {
            g = o;
            l = o * h;
        }

        const c = h > 1 ? "landscape" : "portrait";
        const m = new this.jsPDF({
            orientation: c,
            unit: "mm",
            format: "a4"
        });
        const p = ("portrait" === c ? i : r) - l;
        const u = ("portrait" === c ? r : i) - g;

        m.addImage(t, s, p/2, u/2, l, g, void 0, "FAST");
        return m;
    }

    isValidFile(e) {
        return this.supportedFormats.includes(e.name.split(".").pop().toLowerCase()) && e.size <= this.maxFileSize;
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

export { ImageConverter };