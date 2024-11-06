import { ImageConverter } from './converters/ImageConverter.js';
import { HtmlConverter } from './converters/HtmlConverter.js';
import { SvgConverter } from './converters/SvgConverter.js';

const mobileDownloadQueue = {
    items: [],
    isProcessing: false,
    
    add(item) {
        this.items.push(item);
        if (!this.isProcessing) {
            this.processNext();
        }
    },
    
    async processNext() {
        if (this.items.length === 0) {
            this.isProcessing = false;
            return;
        }
        
        this.isProcessing = true;
        const nextItem = this.items[0];
        
        try {
            await this.processDownload(nextItem);
        } catch (error) {
            console.error('Download-Fehler:', error);
        }
        
        // Warte 1.5 Sekunden nach jedem Download
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        this.items.shift(); // Entferne verarbeitetes Item
        this.processNext(); // Verarbeite nächstes Item
    },
    
    async processDownload({ pdf, fileName }) {
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}_converted.pdf`;
        link.style.display = 'none';
        link.target = '_self';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }
};

(() => {
    const SUPPORTED_FORMATS = {
        images: ['jpg', 'jpeg', 'png'],
        html: ['html', 'htm'],
        vector: ['svg']
    };

    const MAX_PARALLEL_CONVERSIONS = 3;

    document.addEventListener('DOMContentLoaded', initializeApp);

    function initializeApp() {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            console.error('jsPDF nicht geladen');
            return;
        }

        const dropZone = document.getElementById('dropZone');
        const convertButton = dropZone.querySelector('.convert-button');
        const converters = {
            image: new ImageConverter(jsPDF),
            html: new HtmlConverter(jsPDF),
            svg: new SvgConverter(jsPDF)
        };

        setupEventListeners(dropZone, convertButton, converters);
    }

    function setupEventListeners(dropZone, convertButton, converters) {
        const dropEvents = ['dragenter', 'dragover', 'dragleave', 'drop'];
        
        dropEvents.forEach(event => {
            dropZone.addEventListener(event, preventDefault);
            document.body.addEventListener(event, preventDefault);
        });

        ['dragenter', 'dragover'].forEach(event => 
            dropZone.addEventListener(event, () => dropZone.classList.add('drag-over'))
        );

        ['dragleave', 'drop'].forEach(event => 
            dropZone.addEventListener(event, () => dropZone.classList.remove('drag-over'))
        );

        dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files, converters));
        convertButton.addEventListener('click', () => createFileInput(converters));
    }

    async function handleFiles(files, converters) {
        if (!files?.length) return;

        const fileArray = Array.from(files);
        const chunks = chunkArray(fileArray, MAX_PARALLEL_CONVERSIONS);

        showProgress(true);

        try {
            for (const chunk of chunks) {
                await Promise.all(chunk.map(file => processFile(file, converters)));
            }
        } catch (error) {
            console.error('Fehler bei der Dateiverarbeitung:', error);
            showNotification(error.message, 'error');
        } finally {
            showProgress(false);
        }
    }

    async function processFile(file, converters) {
        const extension = file.name.split('.').pop().toLowerCase();
        let converter;
        
        if (SUPPORTED_FORMATS.images.includes(extension)) converter = converters.image;
        else if (SUPPORTED_FORMATS.html.includes(extension)) converter = converters.html;
        else if (SUPPORTED_FORMATS.vector.includes(extension)) converter = converters.svg;
        else throw new Error(`Nicht unterstütztes Dateiformat: ${extension}`);

        try {
            const pdf = await converter.convertToPdf(file);
            const fileName = file.name.replace(/\.[^/.]+$/,"");
            
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            
            if (isMobile) {
                // Füge Download zur Queue hinzu
                mobileDownloadQueue.add({
                    pdf,
                    fileName
                });
            } else {
                // Für Desktop: Normal speichern mit Notification
                await pdf.save(`${fileName}_converted.pdf`);
                showNotification('Konvertierung erfolgreich!', 'success');
            }
        } catch (error) {
            if (!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                showNotification(`Fehler bei ${file.name}: ${error.message}`, 'error');
            }
            console.error('Konvertierungsfehler:', error);
        }
    }

    function createFileInput(converters) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.jpg,.jpeg,.png,.html,.htm,.svg,image/jpeg,image/png,text/html,image/svg+xml';
        input.multiple = true;
        input.addEventListener('change', e => handleFiles(e.target.files, converters), { once: true });
        input.click();
    }

    function showProgress(show) {
        const existingProgress = document.querySelector('.progress');
        
        if (show && !existingProgress) {
            const progress = document.createElement('div');
            progress.className = 'progress';
            progress.innerHTML = '<div class="progress-bar"><div class="progress-fill"></div></div>';
            document.getElementById('dropZone').appendChild(progress);
        } else if (!show && existingProgress) {
            existingProgress.remove();
        }
    }

    function showNotification(message, type) {
        requestAnimationFrame(() => {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            document.body.appendChild(notification);

            requestAnimationFrame(() => {
                notification.classList.add('show');
                setTimeout(() => {
                    notification.classList.remove('show');
                    setTimeout(() => notification.remove(), 300);
                }, 3000);
            });
        });
    }

    function preventDefault(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
})();