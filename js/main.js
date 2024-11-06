import { ImageConverter } from './converters/ImageConverter.js';
import { HtmlConverter } from './converters/HtmlConverter.js';
import { SvgConverter } from './converters/SvgConverter.js';

(() => {
    const SUPPORTED_FORMATS = {
        images: ['jpg', 'jpeg', 'png'],
        html: ['html', 'htm'],
        vector: ['svg']
    };

    const MAX_PARALLEL_CONVERSIONS = 3;
    const MAX_FILES = 10;
    let mobileQueue = [];
    let convertersRef;

    document.addEventListener('DOMContentLoaded', () => {
        initializeApp();
        setupPullToRefresh();
        setupMobileBrowserHandling();
    });

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

        setupDownloadTriggers(dropZone);
    }

    async function handleFiles(files, converters) {
        if (!files?.length) return;
        
        const fileArray = Array.from(files);
        if (fileArray.length > MAX_FILES) {
            showNotification(`Maximal ${MAX_FILES} Dateien erlaubt`, 'error');
            return;
        }

        const chunks = chunkArray(fileArray, MAX_PARALLEL_CONVERSIONS);
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        convertersRef = converters;

        showProgress(true);

        try {
            if (isMobile) {
                const mobileContainer = getMobileFilesContainer();
                
                for (const chunk of chunks) {
                    const results = await Promise.all(chunk.map(async file => {
                        const result = await convertFile(file, converters);
                        return { file, ...result };
                    }));
                    mobileQueue.push(...results);
                }
                
                updateMobileFilesList(mobileContainer);
            } else {
                const container = document.createElement('div');
                container.style.display = 'none';
                document.body.appendChild(container);

                try {
                    for (const chunk of chunks) {
                        const results = await Promise.all(chunk.map(async file => {
                            const result = await convertFile(file, converters);
                            return result;
                        }));

                        const links = results.map(item => {
                            const link = document.createElement('a');
                            link.href = item.url;
                            link.download = `${item.fileName}_converted.pdf`;
                            container.appendChild(link);
                            return { link, url: item.url };
                        });

                        if (links.length > 0) {
                            links[0].link.click();
                            await new Promise(resolve => setTimeout(resolve, 500));

                            for (let i = 1; i < links.length; i++) {
                                links[i].link.click();
                                await new Promise(resolve => setTimeout(resolve, 200));
                            }

                            links.forEach(({ url }) => URL.revokeObjectURL(url));
                        }
                    }
                    showNotification('Konvertierung erfolgreich!', 'success');
                } finally {
                    document.body.removeChild(container);
                }
            }
        } catch (error) {
            console.error('Fehler bei der Dateiverarbeitung:', error);
            showNotification(error.message, 'error');
        } finally {
            showProgress(false);
        }
    }

    async function convertFile(file, converters) {
        const extension = file.name.split('.').pop().toLowerCase();
        let converter;
        
        if (SUPPORTED_FORMATS.images.includes(extension)) converter = converters.image;
        else if (SUPPORTED_FORMATS.html.includes(extension)) converter = converters.html;
        else if (SUPPORTED_FORMATS.vector.includes(extension)) converter = converters.svg;
        else throw new Error(`Nicht unterstütztes Dateiformat: ${extension}`);

        const pdf = await converter.convertToPdf(file);
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        
        return { 
            fileName: file.name.replace(/\.[^/.]+$/,""),
            url,
            originalName: file.name 
        };
    }

    function getMobileFilesContainer() {
        let container = document.querySelector('.mobile-files-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'mobile-files-container';
            container.style.cssText = 'margin-top: 20px; padding: 15px; background: var(--secondary-bg); border-radius: var(--border-radius);';
            document.getElementById('dropZone').after(container);
        }
        return container;
    }

    function updateMobileFilesList(container) {
        const oldList = container.querySelector('.mobile-files-list');
        if (oldList) oldList.remove();

        const list = document.createElement('div');
        list.className = 'mobile-files-list';
        list.style.cssText = 'margin-top: 15px;';

        mobileQueue.forEach((item, index) => {
            const fileItem = document.createElement('div');
            fileItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid rgba(0,0,0,0.1);';
            fileItem.innerHTML = `
                <span>${item.originalName}</span>
                <button class="download-btn" style="background: none; border: none; color: var(--accent-color); cursor: pointer; padding: 12px;">
                    <i class="fi fi-rr-download" style="font-size: 20px;"></i>
                </button>
            `;

            fileItem.querySelector('.download-btn').onclick = () => downloadFile(item);
            list.appendChild(fileItem);
        });

        container.appendChild(list);
    }

    async function downloadFile(item) {
        const container = document.createElement('div');
        container.style.display = 'none';
        document.body.appendChild(container);

        try {
            const link = document.createElement('a');
            link.href = item.url;
            link.download = `${item.fileName}_converted.pdf`;
            container.appendChild(link);
            link.click();
        } finally {
            document.body.removeChild(container);
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

    function setupDownloadTriggers(dropZone) {
        document.addEventListener('paste', async (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            const files = [];
            
            for (const item of items) {
                if (item.kind === 'file') {
                    files.push(item.getAsFile());
                }
            }
            
            if (files.length > 0) {
                e.preventDefault();
                await handleFiles(files, converters);
            }
        });
    }

    // Neue Funktion für Pull-to-Refresh
    function setupPullToRefresh() {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (!isMobile) return;

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            (window.navigator.standalone || false);

        const header = document.querySelector('.header');
        if (!header) return;

        // Für Standalone Apps und mobile Browser
        if (isStandalone) {
            // Füge den nativen Pull-to-Refresh Container hinzu
            const pullIndicator = document.createElement('div');
            pullIndicator.className = 'pull-to-refresh-indicator';
            header.prepend(pullIndicator);
        }

        document.documentElement.style.overscrollBehavior = 'auto';
        header.style.overscrollBehavior = 'contain';

        let startY = 0;
        let isPulling = false;

        header.addEventListener('touchstart', e => {
            if (window.scrollY <= 0) {
                startY = e.touches[0].pageY;
                isPulling = true;
            }
        }, { passive: true });

        header.addEventListener('touchmove', e => {
            if (!isPulling) return;
            
            const pullDistance = e.touches[0].pageY - startY;
            if (pullDistance > 0 && window.scrollY <= 0) {
                document.documentElement.style.overscrollBehavior = 'auto';
                if (isStandalone) {
                    const indicator = document.querySelector('.pull-to-refresh-indicator');
                    if (indicator) {
                        indicator.classList.add('visible');
                    }
                }
            }
        }, { passive: true });

        header.addEventListener('touchend', () => {
            if (isPulling && window.scrollY <= 0) {
                const indicator = document.querySelector('.pull-to-refresh-indicator');
                if (indicator) {
                    indicator.classList.add('refreshing');
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                } else {
                    window.location.reload();
                }
            }
            isPulling = false;
        }, { passive: true });
    }

    // Neue Funktion für das Neuladen der Seite
    async function reloadPage() {
        try {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Animation Zeit
            window.location.reload();
        } catch (error) {
            console.error('Fehler beim Neuladen:', error);
        }
    }

    // Neue Funktion für Browser/App-spezifische Anpassungen
    function setupMobileBrowserHandling() {
        const ua = navigator.userAgent;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
        
        if (!isMobile) return;

        // Meta-Tags für verschiedene Browser/Apps
        const metaTags = [
            { name: 'apple-mobile-web-app-capable', content: 'yes' },
            { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
            { name: 'format-detection', content: 'telephone=no' },
            { name: 'mobile-web-app-capable', content: 'yes' },
            { name: 'theme-color', content: '#ffffff' }
        ];

        metaTags.forEach(tag => {
            const meta = document.createElement('meta');
            meta.name = tag.name;
            meta.content = tag.content;
            document.head.appendChild(meta);
        });

        // Standalone App Erkennung
        if (window.matchMedia('(display-mode: standalone)').matches) {
            document.body.classList.add('standalone-app');
        }

        // Browser-spezifische Anpassungen
        if (/CriOS/i.test(ua)) {
            // Chrome auf iOS
            document.body.classList.add('chrome-ios');
        } else if (/FxiOS/i.test(ua)) {
            // Firefox auf iOS
            document.body.classList.add('firefox-ios');
        } else if (/EdgiOS/i.test(ua)) {
            // Edge auf iOS
            document.body.classList.add('edge-ios');
        }
    }
})();